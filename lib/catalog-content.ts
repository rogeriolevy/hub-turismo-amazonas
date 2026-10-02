export const catalogCategories = [
  "hospedagens",
  "gastronomia",
  "passeios",
  "guias",
  "agencias",
  "servicos",
  "navegacao",
] as const;

export type CatalogCategory = (typeof catalogCategories)[number];

export const catalogCategoryLabels: Record<CatalogCategory, string> = {
  hospedagens: "Hospedagens",
  gastronomia: "Gastronomia",
  passeios: "Passeios",
  guias: "Guias",
  agencias: "Agências",
  servicos: "Serviços turísticos",
  navegacao: "Navegação",
};

export type CatalogItem = {
  id: string;
  source_entry_id: string | null;
  category: CatalogCategory;
  name: string;
  slug: string;
  city: string;
  subtype: string;
  summary: string;
  description: string;
  details: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  image_urls: string[];
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
};

export type CatalogSourceEntry = {
  id: string;
  category: CatalogCategory;
  name: string;
  city: string;
  subtype: string;
  phone: string;
  email: string;
  address: string;
  website: string;
};
