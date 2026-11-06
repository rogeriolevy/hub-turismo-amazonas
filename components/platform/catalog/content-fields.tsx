import {
  catalogCategoryLabels,
  type CatalogCategory,
  type CatalogItem,
  type CatalogSourceEntry,
} from "@/lib/catalog-content";

function sourceSlug(source: CatalogSourceEntry) {
  const name = source.name
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  return `${name || "cadastur"}-${source.id.slice(0, 6)}`;
}

export function CatalogContentFields({
  category,
  item,
  sourceEntry,
}: {
  category: CatalogCategory;
  item?: CatalogItem;
  sourceEntry?: CatalogSourceEntry;
}) {
  const prefix = item?.id || sourceEntry?.id || "novo-" + category;

  return (
    <div className="catalog-content-form-grid">
      <label htmlFor={`${prefix}-name`}>
        Nome público
        <input
          id={`${prefix}-name`}
          name="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={item?.name ?? sourceEntry?.name}
        />
      </label>
      <label htmlFor={`${prefix}-slug`}>
        Endereço curto
        <input
          id={`${prefix}-slug`}
          name="slug"
          required
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          maxLength={80}
          defaultValue={item?.slug ?? (sourceEntry ? sourceSlug(sourceEntry) : undefined)}
          placeholder="pousada-do-rio"
        />
      </label>
      <label htmlFor={`${prefix}-city`}>
        Município
        <input
          id={`${prefix}-city`}
          name="city"
          required
          minLength={2}
          maxLength={100}
          defaultValue={item?.city ?? sourceEntry?.city}
        />
      </label>
      <label htmlFor={`${prefix}-subtype`}>
        Tipo ou especialidade
        <input
          id={`${prefix}-subtype`}
          name="subtype"
          maxLength={100}
          defaultValue={item?.subtype ?? sourceEntry?.subtype}
          placeholder={catalogCategoryLabels[category]}
        />
      </label>
      <label className="catalog-content-wide" htmlFor={`${prefix}-summary`}>
        Chamada curta
        <input
          id={`${prefix}-summary`}
          name="summary"
          required
          minLength={15}
          maxLength={260}
          defaultValue={item?.summary}
          placeholder="Uma frase para apresentar este cadastro."
        />
      </label>
      <label className="catalog-content-wide" htmlFor={`${prefix}-description`}>
        Apresentação
        <textarea
          id={`${prefix}-description`}
          name="description"
          required
          minLength={20}
          maxLength={5000}
          rows={4}
          defaultValue={item?.description}
        />
      </label>
      <label className="catalog-content-wide" htmlFor={`${prefix}-details`}>
        Informações adicionais
        <textarea
          id={`${prefix}-details`}
          name="details"
          maxLength={5000}
          rows={4}
          defaultValue={item?.details}
          placeholder="Serviços, acessibilidade, horários, estrutura, roteiros ou outras informações úteis."
        />
      </label>
      <label className="catalog-content-wide" htmlFor={`${prefix}-address`}>
        Endereço ou ponto de atendimento
        <input
          id={`${prefix}-address`}
          name="address"
          maxLength={300}
          defaultValue={item?.address ?? sourceEntry?.address}
        />
      </label>
      <label htmlFor={`${prefix}-phone`}>
        Telefone ou WhatsApp
        <input
          id={`${prefix}-phone`}
          name="phone"
          maxLength={40}
          defaultValue={item?.phone ?? sourceEntry?.phone}
        />
      </label>
      <label htmlFor={`${prefix}-email`}>
        E-mail público
        <input
          id={`${prefix}-email`}
          name="email"
          type="email"
          maxLength={254}
          defaultValue={item?.email ?? sourceEntry?.email}
        />
      </label>
      <label className="catalog-content-wide" htmlFor={`${prefix}-website`}>
        Site ou página de contato
        <input
          id={`${prefix}-website`}
          name="website"
          type="url"
          maxLength={500}
          defaultValue={item?.website ?? sourceEntry?.website}
          placeholder="https://"
        />
      </label>
      <label htmlFor={`${prefix}-status`}>
        Visibilidade
        <select id={`${prefix}-status`} name="status" defaultValue={item?.status || "draft"}>
          <option value="draft">Rascunho — não aparece no site</option>
          <option value="published">Publicado — visível no catálogo</option>
        </select>
      </label>
    </div>
  );
}
