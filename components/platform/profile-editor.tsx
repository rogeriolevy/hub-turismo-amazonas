"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, PencilLine } from "lucide-react";
import { profileAvatars, profileAvatarUrl, type ProfileAvatarKey } from "@/lib/profile-avatars";

export function ProfileEditor({
  name: savedName,
  email,
  avatar: savedAvatar,
  defaultOpen = false,
}: {
  name: string;
  email: string;
  avatar: ProfileAvatarKey;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(savedName);
  const [avatar, setAvatar] = useState(savedAvatar);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch("/api/conta/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatar }),
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error?.message || "Não foi possível salvar seu perfil.");
      setSaved(true);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error && cause.name !== "TypeError" && cause.name !== "TimeoutError"
          ? cause.message
          : "Verifique sua conexão e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="account-profile-editor" open={defaultOpen || undefined}>
      <summary>
        <span>
          <PencilLine size={17} aria-hidden="true" /> Editar perfil
        </span>
        <ChevronDown className="account-profile-chevron" size={17} aria-hidden="true" />
      </summary>
      <form onSubmit={submit} aria-busy={busy}>
        <label className="account-profile-name">
          <span>Como podemos chamar você?</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={100}
            required
            autoComplete="name"
            disabled={busy}
          />
        </label>
        <div className="account-avatar-field">
          <span>Escolha seu avatar</span>
          <div
            className="account-avatar-options"
            id="account-avatar-options"
            role="radiogroup"
            aria-label="Avatares"
          >
            {profileAvatars.map((item) => (
              <label
                className={
                  "account-avatar-option" +
                  (avatar === item.key ? " account-avatar-option--selected" : "")
                }
                key={item.key}
              >
                <input
                  type="radio"
                  name="avatar"
                  value={item.key}
                  checked={avatar === item.key}
                  onChange={() => setAvatar(item.key)}
                  disabled={busy}
                />
                <Image src={profileAvatarUrl(item.key)} alt="" width={48} height={48} />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>
        <p className="account-profile-email">
          E-mail de acesso: <strong>{email}</strong>
        </p>
        {error && (
          <p className="account-profile-error" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="account-profile-success" role="status">
            <Check size={16} aria-hidden="true" /> Perfil atualizado.
          </p>
        )}
        <button type="submit" className="account-profile-save" disabled={busy}>
          {busy ? "Salvando…" : "Salvar alterações"}
        </button>
      </form>
    </details>
  );
}
