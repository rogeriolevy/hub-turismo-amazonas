import { GuideEditor, TourEditor } from "../panel-forms";
import { PaginationNavigation } from "../pagination-navigation";
import { PageIntro } from "../shared";
import { money } from "@/lib/platform-schema/format";
import type { InventoryPage } from "@/server/inventory-read-service";
import type { Guide, Tour } from "@/server/platform-models";

export function TourGuideManagement({
  companyId,
  companyName,
  toursPage,
  guidesPage,
  guideOptions,
  tourHrefForPage,
  guideHrefForPage,
}: {
  companyId: string;
  companyName: string;
  toursPage: InventoryPage<Tour>;
  guidesPage: InventoryPage<Guide>;
  guideOptions: Pick<Guide, "id" | "name">[];
  tourHrefForPage: (page: number) => string;
  guideHrefForPage: (page: number) => string;
}) {
  return (
    <>
      <PageIntro
        eyebrow={companyName}
        title="Experiências"
        description="Cadastre passeios e roteiros, e apresente os profissionais que os conduzem."
      />
      <h2 className="subheading">Passeios e roteiros</h2>
      <details className="editor-card">
        <summary>Cadastrar passeio ou roteiro</summary>
        <TourEditor companyId={companyId} guides={guideOptions} />
      </details>
      {toursPage.items.map((tour) => (
        <details className="editor-card" key={tour.id}>
          <summary>
            <span>
              {tour.name}
              <small>
                {tour.city} · {tour.duration_minutes} min · {money(tour.price_cents)}
              </small>
            </span>
            <span>{tour.published ? "Publicado" : "Rascunho"}</span>
          </summary>
          <TourEditor companyId={companyId} guides={guideOptions} tour={tour} />
        </details>
      ))}
      <PaginationNavigation
        page={toursPage.page}
        totalPages={toursPage.totalPages}
        hrefForPage={tourHrefForPage}
      />
      <h2 className="subheading">Guias de turismo</h2>
      <details className="editor-card">
        <summary>Cadastrar guia</summary>
        <GuideEditor companyId={companyId} />
      </details>
      {guidesPage.items.map((guide) => (
        <details className="editor-card" key={guide.id}>
          <summary>
            <span>
              {guide.name}
              <small>{guide.languages}</small>
            </span>
            <span>{guide.published ? "Publicado" : "Rascunho"}</span>
          </summary>
          <GuideEditor companyId={companyId} guide={guide} />
        </details>
      ))}
      <PaginationNavigation
        page={guidesPage.page}
        totalPages={guidesPage.totalPages}
        hrefForPage={guideHrefForPage}
      />
    </>
  );
}
