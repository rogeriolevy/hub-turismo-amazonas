"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { catalogItemSchema } from "@/lib/platform-schema/catalog";
import { LocalizedClientTree } from "@/components/site/localized-client-tree";
import type { CatalogCategory, CatalogItem, CatalogSourceEntry } from "@/lib/catalog-content";
import { CatalogContentFields } from "./catalog/content-fields";
import { CatalogMediaEditor } from "./catalog/media-editor";

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
  const [imagesText, setImagesText] = useState(item?.image_urls.join("\n") || "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const images = imagesText
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);

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
    <LocalizedClientTree>
      <form className="catalog-content-form" onSubmit={submit}>
        <CatalogContentFields category={category} item={item} sourceEntry={sourceEntry} />

        <CatalogMediaEditor
          prefix={prefix}
          imagesText={imagesText}
          onImagesTextChange={setImagesText}
          uploading={uploading}
          onUploadingChange={setUploading}
          busy={busy}
          onFeedback={setFeedback}
        />

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
              {deleting ? (
                <LoaderCircle size={16} className="catalog-spin" />
              ) : (
                <Trash2 size={16} />
              )}
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
    </LocalizedClientTree>
  );
}
