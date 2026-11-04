import { useRef, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import Image from "next/image";
import { LoaderCircle, Upload, X } from "lucide-react";

export function CatalogMediaEditor({
  prefix,
  imagesText,
  onImagesTextChange,
  uploading,
  onUploadingChange,
  busy,
  onFeedback,
}: {
  prefix: string;
  imagesText: string;
  onImagesTextChange: Dispatch<SetStateAction<string>>;
  uploading: boolean;
  onUploadingChange: (value: boolean) => void;
  busy: boolean;
  onFeedback: (value: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
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
    onUploadingChange(true);
    onFeedback("");
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
      onImagesTextChange((current) =>
        [
          ...new Set([
            ...current
              .split("\n")
              .map((value) => value.trim())
              .filter(Boolean),
            ...uploaded,
          ]),
        ].join("\n"),
      );
      onFeedback(
        `${uploaded.length} imagem(ns) adicionada(s). Salve o cadastro para publicar as alterações.`,
      );
    } catch (error) {
      onFeedback(error instanceof Error ? error.message : "Falha ao enviar as imagens.");
    } finally {
      onUploadingChange(false);
    }
  }

  return (
    <div className="catalog-content-images">
      <div className="catalog-content-images-heading">
        <div>
          <strong>Imagens</strong>
          <p>
            Envie JPEG, PNG ou WebP (até 5 MB por imagem; limite total de 4 MB na Vercel e 16 MB
            local) ou informe links HTTPS, um por linha. Até 8 imagens.
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
          onChange={(event) => onImagesTextChange(event.target.value)}
          placeholder="https://exemplo.com/imagem.webp"
        />
      </label>
      {!!images.length && (
        <div className="catalog-content-image-preview" aria-label="Prévia das imagens">
          {images.map((image, index) => (
            <div key={image}>
              <Image
                unoptimized
                src={image}
                alt={`Prévia ${index + 1}`}
                width={208}
                height={152}
                sizes="104px"
              />
              <button
                type="button"
                aria-label={`Remover imagem ${index + 1}`}
                onClick={() => onImagesTextChange(images.filter((_, i) => i !== index).join("\n"))}
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
