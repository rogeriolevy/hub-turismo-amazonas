import { DepartureEditor } from "../panel-forms";
import { PaginationNavigation } from "../pagination-navigation";
import { PageIntro, PortalNotice } from "../shared";
import { displayTime } from "@/lib/platform-schema/format";
import type { InventoryPage } from "@/server/inventory-read-service";
import type { Departure, Tour } from "@/server/platform-models";

export function DepartureManagement({
  companyId,
  companyName,
  departuresPage,
  tourOptions,
  hrefForPage,
}: {
  companyId: string;
  companyName: string;
  departuresPage: InventoryPage<Departure & { tour_name: string }>;
  tourOptions: Pick<Tour, "id" | "name">[];
  hrefForPage: (page: number) => string;
}) {
  return (
    <>
      <PageIntro
        eyebrow={companyName}
        title="Agenda de saídas"
        description="Horários no fuso de Manaus. Controle a capacidade de cada saída."
      />
      {tourOptions.length ? (
        <details className="editor-card">
          <summary>Criar saída</summary>
          <DepartureEditor companyId={companyId} tours={tourOptions} />
        </details>
      ) : (
        <PortalNotice>Cadastre um passeio antes de abrir a agenda.</PortalNotice>
      )}
      {departuresPage.items.map((departure) => (
        <details className="editor-card" key={departure.id}>
          <summary>
            <span>
              {departure.tour_name}
              <small>
                {displayTime(departure.starts_at)} · {departure.reserved || 0}/{departure.capacity}{" "}
                vagas confirmadas
              </small>
            </span>
            <span>{departure.active ? "Aberta" : "Fechada"}</span>
          </summary>
          <DepartureEditor companyId={companyId} tours={tourOptions} departure={departure} />
        </details>
      ))}
      <PaginationNavigation
        page={departuresPage.page}
        totalPages={departuresPage.totalPages}
        hrefForPage={hrefForPage}
      />
    </>
  );
}
