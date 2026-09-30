import { ActionForm, type Field } from "./action-form";
import type { Company, Room, Tour, Guide, Departure } from "@/server/platform-models";
const name: Field = { name: "name", label: "Nome", maxLength: 100 };
const slug: Field = {
  name: "slug",
  label: "Identificador na URL",
  maxLength: 80,
  hint: "Letras minúsculas, números e hífens. Exemplo: pousada-do-rio.",
};
const description: Field = {
  name: "description",
  label: "Apresentação",
  type: "textarea",
  maxLength: 2000,
  hint: "De 20 a 2.000 caracteres.",
};
const price: Field = { name: "price_cents", label: "Preço (R$)", type: "currency" };
export function CompanyEditor({ company }: { company?: Company }) {
  return (
    <ActionForm
      action="empresas"
      fixed={company ? { id: company.id, kind: company.kind } : {}}
      initial={company ? { ...company } : { status: "draft" }}
      reset={!company}
      fields={[
        ...(!company
          ? [
              {
                name: "kind",
                label: "Tipo",
                type: "select",
                options: [
                  { value: "hotel", label: "Hotel ou pousada" },
                  { value: "operator", label: "Operador de passeios" },
                ],
              } as Field,
            ]
          : []),
        name,
        slug,
        { name: "city", label: "Cidade", maxLength: 100 },
        description,
        {
          name: "status",
          label: "Situação",
          type: "select",
          options: [
            { value: "draft", label: "Rascunho — fora do catálogo" },
            { value: "published", label: "Publicado — visível no catálogo" },
            { value: "suspended", label: "Suspenso — equipe sem acesso" },
          ],
        },
      ]}
      label={company ? "Salvar empresa" : "Cadastrar empresa"}
    />
  );
}
export function RoomEditor({ companyId, room }: { companyId: string; room?: Room }) {
  return (
    <ActionForm
      action="quartos"
      fixed={{ company_id: companyId, ...(room ? { id: room.id } : {}) }}
      initial={room ? { ...room, active: !!room.active } : { capacity: 2, active: true }}
      reset={!room}
      fields={[
        { name: "code", label: "Número ou código do quarto", maxLength: 30 },
        name,
        { name: "capacity", label: "Capacidade de hóspedes", type: "number", min: 1, max: 20 },
        { ...price, label: "Diária por quarto (R$)" },
        { name: "active", label: "Disponível para novas solicitações", type: "checkbox" },
      ]}
      label={room ? "Salvar quarto" : "Cadastrar quarto"}
    />
  );
}
export function GuideEditor({ companyId, guide }: { companyId: string; guide?: Guide }) {
  return (
    <ActionForm
      action="guias"
      fixed={{ company_id: companyId, ...(guide ? { id: guide.id } : {}) }}
      initial={guide ? { ...guide, published: !!guide.published } : { published: false }}
      reset={!guide}
      fields={[
        name,
        slug,
        { name: "bio", label: "Sobre o guia", type: "textarea", hint: "De 20 a 2.000 caracteres." },
        { name: "languages", label: "Idiomas", maxLength: 150 },
        { name: "published", label: "Publicar perfil", type: "checkbox" },
      ]}
      label={guide ? "Salvar perfil" : "Cadastrar guia"}
    />
  );
}
export function TourEditor({
  companyId,
  tour,
  guides,
}: {
  companyId: string;
  tour?: Tour;
  guides: Guide[];
}) {
  return (
    <ActionForm
      action="passeios"
      fixed={{ company_id: companyId, ...(tour ? { id: tour.id } : {}) }}
      initial={
        tour
          ? { ...tour, guide_id: tour.guide_id || "", published: !!tour.published }
          : { published: false }
      }
      reset={!tour}
      fields={[
        name,
        slug,
        { name: "city", label: "Cidade", maxLength: 100 },
        description,
        {
          name: "duration_minutes",
          label: "Duração em minutos",
          type: "number",
          min: 15,
          max: 1440,
        },
        { ...price, label: "Preço por pessoa (R$)" },
        {
          name: "guide_id",
          label: "Guia responsável",
          type: "select",
          required: false,
          options: [
            { value: "", label: "A definir" },
            ...guides.map((g) => ({ value: g.id, label: g.name })),
          ],
        },
        { name: "published", label: "Publicar passeio", type: "checkbox" },
      ]}
      label={tour ? "Salvar passeio" : "Cadastrar passeio"}
    />
  );
}
export function DepartureEditor({
  companyId,
  tours,
  departure,
}: {
  companyId: string;
  tours: Tour[];
  departure?: Departure;
}) {
  return (
    <ActionForm
      action="saidas"
      fixed={{ company_id: companyId, ...(departure ? { id: departure.id } : {}) }}
      initial={departure ? { ...departure, active: !!departure.active } : { active: true }}
      reset={!departure}
      fields={[
        {
          name: "tour_id",
          label: "Passeio",
          type: "select",
          options: tours.map((t) => ({ value: t.id, label: t.name })),
        },
        {
          name: "starts_at",
          label: "Data e horário da saída",
          type: "datetime-local",
          hint: "Horário de Manaus (UTC−4).",
        },
        { name: "capacity", label: "Total de vagas", type: "number", min: 1, max: 100 },
        { name: "active", label: "Aceitar novas solicitações", type: "checkbox" },
      ]}
      label={departure ? "Salvar saída" : "Criar saída"}
    />
  );
}
