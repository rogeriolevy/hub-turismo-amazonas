import Link from "next/link";
import { BedDouble, Ship } from "lucide-react";
import "./travel-search.css";

export type TravelSearchMode = "hospedagens" | "navegacao";

export function TravelSearchPanel({
  active,
  children,
}: {
  active: TravelSearchMode;
  children: React.ReactNode;
}) {
  return (
    <div className="travel-search-panel">
      <nav className="travel-search-tabs" aria-label="Tipo de busca">
        <Link href="/hospedagens" aria-current={active === "hospedagens" ? "page" : undefined}>
          <BedDouble size={18} aria-hidden="true" />
          Hospedagens
        </Link>
        <Link href="/navegacao" aria-current={active === "navegacao" ? "page" : undefined}>
          <Ship size={18} aria-hidden="true" />
          Navegações
        </Link>
      </nav>
      {children}
    </div>
  );
}
