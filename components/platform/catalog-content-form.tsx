"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, LoaderCircle, Trash2, Upload, X } from "lucide-react";
import { catalogItemSchema } from "@/lib/platform-schema";
import {
  catalogCategoryLabels,
  type CatalogCategory,
  type CatalogItem,
  type CatalogSourceEntry,
} from "@/lib/catalog-content";

function sourceSlug(source: CatalogSourceEntry) {
  const name = source.name
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  return `${name || "cadastur"}-${source.id.slice(0, 6)}`;
}

export function CatalogContentForm({
  category,
  item,
  sourceEntry,
}: {
  category: CatalogCategory;
  item?: CatalogItem;
  sourceEntry?: CatalogSourceEntry;
}) {
  const router = useRouter();
  const prefix = item?.id || sourceEntry?.id || "novo-" + category;
  const fileRef = useRef<HTMLInputElement>(null);
  const [imagesText, setImagesText] = useState(item?.image_urls.join("\n") || "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const images = imagesText
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);

  async function uploadImages(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    input.value = "";
    if (!files.length) return;
    const form = new FormData();
    files.forEach((file) => form.append("images", file));
    setUploading(true);
    setFeedback("");
    try {
      const response = await fetch("/api/plataforma/conteudos/imagens", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(60000),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error?.message || "Não foi possível enviar as imagens.");
      const uploaded = payload.data?.images;
      if (
        !Array.isArray(uploaded) ||
        !uploaded.every((value: unknown) => typeof value === "string")
      )
        throw new Error("O servidor não retornou as imagens enviadas.");
      setImagesText((current) =>
        [
          ...new Set([
            ...current
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
            ...uploaded,
          ]),
        ].join("\n"),
      );
      setFeedback(
        `${uploaded.length} imagem(ns) adicionada(s). Salve o cadastro para publicar as alterações.`,
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao enviar as imagens.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "");
    const candidate = {
      ...(item ? { id: item.id } : {}),
      source_entry_id: item?.source_entry_id || sourceEntry?.id || null,
      category,
      name: value("name"),
      slug: value("slug"),
      city: value("city"),
      subtype: value("subtype"),
      summary: value("summary"),
      description: value("description"),
      details: value("details"),
      address: value("address"),
      phone: value("phone"),
      email: value("email"),
      website: value("website"),
      image_urls: images,
      status: value("status"),
    };
    if (images.length > 8) {
      setFeedback("O cadastro aceita até 8 imagens.");
      return;
    }
    const parsed = catalogItemSchema.safeParse(candidate);
    if (!parsed.success) {
      setFeedback(parsed.error.issues.map((issue) => issue.message).join(" "));
      return;
    }
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch("/api/plataforma/conteudos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(20000),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível salvar.");
      setFeedback("Cadastro salvo.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao salvar o cadastro.");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem() {
    if (
      !item ||
      deleting ||
      !window.confirm(
        item.source_entry_id
          ? `Excluir o complemento editorial de “${item.name}”? O registro oficial do Cadastur permanecerá no diretório.`
          : `Excluir “${item.name}” do catálogo?`,
      )
    )
      return;
    setDeleting(true);
    setFeedback("");
    try {
      const response = await fetch("/api/plataforma/excluir-conteudo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
        signal: AbortSignal.timeout(20000),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível excluir.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao excluir o cadastro.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form className="catalog-content-form" onSubmit={submit}>
      <div className="catalog-content-form-grid">
        <label htmlFor={`${prefix}-name`}>
          Nome público
          <input
            id={`${prefix}-name`}
            name="name"
            required
            minLength={2}
            maxLength={120}
            defaultValue={item?.name ?? sourceEntry?.name}
          />
        </label>
        <label htmlFor={`${prefix}-slug`}>
          Endereço curto
          <input
            id={`${prefix}-slug`}
            name="slug"
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            maxLength={80}
            defaultValue={item?.slug ?? (sourceEntry ? sourceSlug(sourceEntry) : undefined)}
            placeholder="pousada-do-rio"
          />
        </label>
        <label htmlFor={`${prefix}-city`}>
          Município
          <input
            id={`${prefix}-city`}
            name="city"
            required
            minLength={2}
            maxLength={100}
            defaultValue={item?.city ?? sourceEntry?.city}
          />
        </label>
        <label htmlFor={`${prefix}-subtype`}>
          Tipo ou especialidade
          <input
            id={`${prefix}-subtype`}
            name="subtype"
            maxLength={100}
            defaultValue={item?.subtype ?? sourceEntry?.subtype}
            placeholder={catalogCategoryLabels[category]}
          />
        </label>
        <label className="catalog-content-wide" htmlFor={`${prefix}-summary`}>
          Chamada curta
          <input
            id={`${prefix}-summary`}
            name="summary"
            required
            minLength={15}
            maxLength={260}
            defaultValue={item?.summary}
            placeholder="Uma frase para apresentar este cadastro."
          />
        </label>
        <label className="catalog-content-wide" htmlFor={`${prefix}-description`}>
          Apresentação
          <textarea
            id={`${prefix}-description`}
            name="description"
            required
            minLength={20}
            maxLength={5000}
            rows={4}
            defaultValue={item?.description}
          />
        </label>
        <label className="catalog-content-wide" htmlFor={`${prefix}-details`}>
          Informações adicionais
          <textarea
            id={`${prefix}-details`}
            name="details"
            maxLength={5000}
            rows={4}
            defaultValue={item?.details}
            placeholder="Serviços, acessibilidade, horários, estrutura, roteiros ou outras informações úteis."
          />
        </label>
        <label className="catalog-content-wide" htmlFor={`${prefix}-address`}>
          Endereço ou ponto de atendimento
          <input
            id={`${prefix}-address`}
            name="address"
            maxLength={300}
            defaultValue={item?.address ?? sourceEntry?.address}
          />
        </label>
        <label htmlFor={`${prefix}-phone`}>
          Telefone ou WhatsApp
          <input
            id={`${prefix}-phone`}
            name="phone"
            maxLength={40}
            defaultValue={item?.phone ?? sourceEntry?.phone}
          />
        </label>
        <label htmlFor={`${prefix}-email`}>
          E-mail público
          <input
            id={`${prefix}-email`}
            name="email"
            type="email"
            maxLength={254}
            defaultValue={item?.email ?? sourceEntry?.email}
          />
        </label>
        <label className="catalog-content-wide" htmlFor={`${prefix}-website`}>
          Site ou página de contato
          <input
            id={`${prefix}-website`}
            name="website"
            type="url"
            maxLength={500}
            defaultValue={item?.website ?? sourceEntry?.website}
            placeholder="https://"
          />
        </label>
        <label htmlFor={`${prefix}-status`}>
          Visibilidade
          <select id={`${prefix}-status`} name="status" defaultValue={item?.status || "draft"}>
            <option value="draft">Rascunho — não aparece no site</option>
            <option value="published">Publicado — visível no catálogo</option>
          </select>
        </label>
      </div>

      <div className="catalog-content-images">
        <div className="catalog-content-images-heading">
          <div>
            <strong>Imagens</strong>
            <p>
              Envie JPEG, PNG ou WebP (até 5 MB por imagem) ou informe links HTTPS, um por linha.
              Até 8 imagens.
            </p>
          </div>
          <label className="button button-outline catalog-upload-button">
            {uploading ? <LoaderCircle size={16} className="catalog-spin" /> : <Upload size={16} />}
            {uploading ? "Enviando…" : "Enviar imagens"}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={uploading || busy}
              onChange={uploadImages}
            />
          </label>
        </div>
        <label htmlFor={`${prefix}-images`}>
          Links e imagens enviadas
          <textarea
            id={`${prefix}-images`}
            rows={3}
            value={imagesText}
            onChange={(event) => setImagesText(event.target.value)}
            placeholder="https://exemplo.com/imagem.webp"
          />
        </label>
        {!!images.length && (
          <div className="catalog-content-image-preview" aria-label="Prévia das imagens">
            {images.map((image, index) => (
              <div key={image}>
                <img src={image} alt={`Prévia ${index + 1}`} />
                <button
                  type="button"
                  aria-label={`Remover imagem ${index + 1}`}
                  onClick={() => setImagesText(images.filter((_, i) => i !== index).join("\n"))}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="catalog-content-form-actions">
        <button className="button button-dark" type="submit" disabled={busy || uploading}>
          {busy ? <LoaderCircle size={16} className="catalog-spin" /> : <ImagePlus size={16} />}
          {busy ? "Salvando…" : item ? "Salvar alterações" : "Cadastrar conteúdo"}
        </button>
        {item && (
          <button
            className="button button-danger-outline"
            type="button"
            onClick={removeItem}
            disabled={deleting || busy}
          >
            {deleting ? <LoaderCircle size={16} className="catalog-spin" /> : <Trash2 size={16} />}
            {deleting ? "Excluindo…" : "Excluir do catálogo"}
          </button>
        )}
        {feedback && (
          <p className="catalog-content-feedback" role="status">
            {feedback}
          </p>
        )}
      </div>
    </form>
  );
}
