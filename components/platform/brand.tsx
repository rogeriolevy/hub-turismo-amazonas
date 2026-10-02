"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Waves } from "lucide-react";
export function PlatformBrand() {
  const path = usePathname();
  const area = path.startsWith("/minha-conta")
    ? "usuário"
    : path.startsWith("/hospedagens") || path.startsWith("/painel/hotel")
      ? "hospedagem"
      : path.startsWith("/guias")
        ? "guias"
        : path.startsWith("/gastronomia")
          ? "gastronomia"
          : path.startsWith("/agencias")
            ? "agências"
            : path.startsWith("/servicos")
              ? "serviços"
              : path.startsWith("/passeios") || path.startsWith("/painel/passeios")
                ? "passeios"
                : path.startsWith("/navegacao")
                  ? "navegação"
                  : path.startsWith("/painel/plataforma") ||
                      path.startsWith("/painel/contato") ||
                      path === "/admin"
                    ? "gestão"
                    : "turismo";
  return (
    <Link className="brand platform-brand" href="/" aria-label="Hub Turismo Amazonas, início">
      <Waves className="brand-mark" size={37} strokeWidth={2} />
      <strong>
        hub<span className="brand-dot">.</span>
      </strong>
      <em className="brand-context" key={area}>
        {area}
      </em>
    </Link>
  );
}
