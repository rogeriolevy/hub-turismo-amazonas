import type { MessageKey } from "./i18n/messages";

export type PanelArea = "hotel" | "passeios" | "plataforma";

type PanelAreaDefinition = {
  titleKey: MessageKey;
  companyKind: "hotel" | "operator" | null;
  sections: readonly { path: string; labelKey: MessageKey }[];
  routeOnlySections: readonly string[];
  aliases: Readonly<Record<string, string>>;
  externalLinks: readonly { href: string; labelKey: MessageKey }[];
};

export const panelAreas = {
  hotel: {
    titleKey: "panel.hotel",
    companyKind: "hotel",
    sections: [
      { path: "", labelKey: "panel.overview" },
      { path: "quartos", labelKey: "panel.rooms" },
      { path: "reservas", labelKey: "panel.bookings" },
      { path: "fnrh", labelKey: "panel.stays" },
    ],
    routeOnlySections: [],
    aliases: {},
    externalLinks: [],
  },
  passeios: {
    titleKey: "panel.experiences",
    companyKind: "operator",
    sections: [
      { path: "", labelKey: "panel.overview" },
      { path: "experiencias", labelKey: "panel.experiencesTab" },
      { path: "agenda", labelKey: "panel.schedule" },
      { path: "vagas", labelKey: "panel.availability" },
    ],
    routeOnlySections: ["reservas"],
    aliases: { guias: "experiencias", passeios: "experiencias" },
    externalLinks: [],
  },
  plataforma: {
    titleKey: "panel.platform",
    companyKind: null,
    sections: [
      { path: "", labelKey: "panel.overview" },
      { path: "empresas", labelKey: "panel.companies" },
      { path: "acessos", labelKey: "panel.permissions" },
      { path: "cadastur", labelKey: "panel.directory" },
      { path: "conteudos", labelKey: "panel.content" },
      { path: "notificacoes-email", labelKey: "panel.emailOperations" },
      { path: "auditoria", labelKey: "panel.audit" },
    ],
    routeOnlySections: [],
    aliases: {},
    externalLinks: [{ href: "/painel/contato", labelKey: "panel.contacts" }],
  },
} as const satisfies Record<PanelArea, PanelAreaDefinition>;

export function isPanelArea(value: string): value is PanelArea {
  return Object.hasOwn(panelAreas, value);
}

export function isPanelSection(area: PanelArea, section: string) {
  const definition = panelAreas[area];
  return (
    definition.sections.some((item) => item.path === section) ||
    (definition.routeOnlySections as readonly string[]).includes(section)
  );
}

export function panelSectionAlias(area: PanelArea, section: string) {
  return (panelAreas[area].aliases as Readonly<Record<string, string>>)[section];
}
