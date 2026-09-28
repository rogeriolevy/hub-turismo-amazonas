"use client";
import { useRef, useState } from "react";
import { ArrowUpRight, CheckCircle2, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { contactSchema, interests } from "@/lib/contact-schema";
type Errors = Record<string, string[] | undefined>;
export function ContactForm() {
  const [interest, setInterest] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState("");
  const key = useRef<string | null>(null);
  const feedback = useRef<HTMLDivElement>(null);
  function fieldError(name: string) {
    return errors[name] ? (
      <span className="field-error" id={name + "-error"}>
        {errors[name]?.[0]}
      </span>
    ) : null;
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "loading") return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const result = contactSchema.safeParse({ ...data, interest, consent });
    if (!result.success) {
      setErrors(result.error.flatten().fieldErrors);
      setStatus("error");
      setMessage("Confira os campos destacados para enviar.");
      requestAnimationFrame(() =>
        (form.querySelector('[aria-invalid="true"]') as HTMLElement)?.focus(),
      );
      return;
    }
    setErrors({});
    setStatus("loading");
    setMessage("");
    key.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/contatos", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key.current },
        body: JSON.stringify(result.data),
        signal: AbortSignal.timeout(15000),
      });
      const payload = (await response.json()) as {
        error?: { fields?: Errors; message?: string };
        data: { message: string };
      };
      if (!response.ok) {
        setErrors(payload.error?.fields || {});
        if (response.status === 409) key.current = null;
        throw new Error(payload.error?.message || "Não foi possível enviar. Tente novamente.");
      }
      setStatus("success");
      setMessage(payload.data.message);
      form.reset();
      setInterest("");
      setConsent(false);
      key.current = null;
      requestAnimationFrame(() => feedback.current?.focus());
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error && error.name !== "TimeoutError" && error.name !== "TypeError"
          ? error.message
          : "Não foi possível conectar. Seus dados foram mantidos. Tente novamente.",
      );
    }
  }
  return (
    <div className="contact-card">
      {status === "success" ? (
        <div className="form-success" ref={feedback} tabIndex={-1} role="status">
          <CheckCircle2 size={42} />
          <h3>Conversa iniciada!</h3>
          <p>{message}</p>
          <p>
            Sua mensagem está disponível para nossa equipe. O retorno será pelo e-mail informado.
          </p>
          <button
            className="button button-dark"
            onClick={() => {
              setStatus("idle");
              setMessage("");
            }}
          >
            Enviar outra mensagem
          </button>
        </div>
      ) : (
        <>
          <h3>Faça parte dessa conversa</h3>
          <p className="form-intro">
            Conte um pouco sobre você. Todos os campos são obrigatórios, exceto a organização.
          </p>
          <form noValidate onSubmit={submit} aria-busy={status === "loading"}>
            <div className="field">
              <label htmlFor="name">Seu nome</label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                maxLength={100}
                required
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "name-error" : undefined}
                placeholder="Como podemos chamar você?"
              />
              {fieldError("name")}
            </div>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                placeholder="voce@exemplo.com"
              />
              {fieldError("email")}
            </div>
            <div className="field">
              <label htmlFor="organization">
                Hotel, pousada ou organização <span>(opcional)</span>
              </label>
              <input
                id="organization"
                name="organization"
                autoComplete="organization"
                maxLength={120}
                aria-invalid={!!errors.organization}
                aria-describedby={errors.organization ? "organization-error" : undefined}
                placeholder="Nome do seu negócio"
              />
              {fieldError("organization")}
            </div>
            <div className="field">
              <label htmlFor="interest">Sobre o que vamos conversar?</label>
              <Select value={interest} onValueChange={setInterest}>
                <SelectTrigger
                  id="interest"
                  aria-required="true"
                  aria-invalid={!!errors.interest}
                  aria-describedby={errors.interest ? "interest-error" : undefined}
                  className="form-select"
                >
                  <SelectValue placeholder="Selecione um assunto" />
                </SelectTrigger>
                <SelectContent>
                  {interests.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError("interest")}
            </div>
            <div className="field">
              <label htmlFor="message">Sua mensagem</label>
              <textarea
                id="message"
                name="message"
                rows={4}
                maxLength={2000}
                required
                aria-invalid={!!errors.message}
                aria-describedby={errors.message ? "message-error" : "message-help"}
                placeholder="Como podemos contribuir com sua jornada?"
              />
              <span className="field-help" id="message-help">
                De 10 a 2.000 caracteres. Não envie dados sensíveis.
              </span>
              {fieldError("message")}
            </div>
            <div className="honeypot" aria-hidden="true">
              <label htmlFor="website">Deixe este campo em branco</label>
              <input id="website" name="website" tabIndex={-1} autoComplete="off" />
            </div>
            <div className="consent">
              <Checkbox
                id="consent"
                checked={consent}
                onCheckedChange={(value) => setConsent(value === true)}
                aria-required="true"
                aria-invalid={!!errors.consent}
                aria-describedby={errors.consent ? "consent-error" : undefined}
              />
              <label htmlFor="consent">
                Autorizo o uso dos meus dados para responder a este contato, conforme o{" "}
                <a href="/privacidade" target="_blank" rel="noreferrer">
                  aviso de privacidade (nova aba)
                </a>
                .
              </label>
            </div>
            {fieldError("consent")}
            {status === "error" && (
              <p className="form-error" role="alert">
                {message}
              </p>
            )}
            <button
              className="button button-dark submit-button"
              type="submit"
              disabled={status === "loading"}
            >
              {status === "loading" ? (
                <>
                  Enviando mensagem <Loader2 className="animate-spin" size={18} />
                </>
              ) : (
                <>
                  Enviar mensagem <ArrowUpRight size={18} />
                </>
              )}
            </button>
            <span className="sr-only" role="status">
              {status === "loading" ? "Aguarde, enviando sua mensagem." : ""}
            </span>
          </form>
        </>
      )}
    </div>
  );
}
