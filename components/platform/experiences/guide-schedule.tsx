import { displayTime } from "@/lib/platform-schema/format";
import type { InventoryPage } from "@/server/inventory-read-service";
import type { Departure } from "@/server/platform-models";
import { PaginationNavigation } from "../pagination-navigation";
import { PageIntro } from "../shared";

export function GuideSchedule({
  companyName,
  departuresPage,
  hrefForPage,
}: {
  companyName: string;
  departuresPage: InventoryPage<Departure & { tour_name: string }>;
  hrefForPage: (page: number) => string;
}) {
  return (
    <>
      <PageIntro
        eyebrow={companyName}
        title="Minhas saídas"
        description="Agenda somente dos passeios vinculados ao seu cadastro de guia."
      />
      {departuresPage.items.length ? (
        <div className="resource-list">
          {departuresPage.items.map((departure) => (
            <article key={departure.id}>
              <div>
                <h3>{departure.tour_name}</h3>
                <p>
                  {displayTime(departure.starts_at)} · {departure.reserved || 0}/
                  {departure.capacity} vagas confirmadas
                </p>
              </div>
              <span className="status-pill">{departure.active ? "Aberta" : "Fechada"}</span>
            </article>
          ))}
        </div>
      ) : (
        <div className="room-status-empty">
          <p>Não há saídas vinculadas ao seu cadastro de guia.</p>
        </div>
      )}
      <PaginationNavigation
        page={departuresPage.page}
        totalPages={departuresPage.totalPages}
        hrefForPage={hrefForPage}
      />
    </>
  );
}
