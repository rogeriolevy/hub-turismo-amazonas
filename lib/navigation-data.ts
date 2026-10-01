export const navigationReviewedAt = "2026-10-01";

export const navigationCities = ["Maués", "Manaus", "Parintins", "Boa Vista do Ramos"] as const;
export type NavigationCity = (typeof navigationCities)[number];
export type TransportMode = "fluvial" | "aereo";
export type NavigationSource = {
  name: string;
  url: string;
  note: string;
};

export const navigationSources = {
  folha: {
    name: "Folha de Maués · roteiro enviado",
    url: "/images/navegacao/roteiro-folha-de-maues.png",
    note: "Cartaz fornecido pelo usuário, sem data de publicação ou validade. Horários e contatos transcritos em 01/10/2026; confirmar com a embarcação.",
  },
  pp: {
    name: "Navegação PP · cartaz enviado",
    url: "/images/navegacao/roteiro-navegacao-pp.png",
    note: "Cartaz fornecido pelo usuário, sem validade informada. Confere com os horários da PP no roteiro da Folha de Maués; não informa preços.",
  },
  navegamManaus: {
    name: "Navegam · Manaus → Maués",
    url: "https://navegam.com.br/busca?ida=2026-10-02&type=ida-volta&volta=2026-10-12&origem=1&destino=39&passageiros=1",
    note: "Consulta em 01/10/2026: passagem cheia de ida no Almirante Dinelson, em 02/10/2026 às 18h, por R$ 220. O valor não inclui automaticamente a volta.",
  },
  navegamParintins: {
    name: "Navegam · Maués → Parintins",
    url: "https://navegam.com.br/busca?ida=2026-10-02&type=ida&origem=39&destino=27&passageiros=1",
    note: "Consulta em 01/10/2026 para 02/10/2026 sem passagens exibidas. Isso não comprova ausência de transporte local ou em outras datas.",
  },
  navegamRamos: {
    name: "Navegam · Maués → Boa Vista do Ramos",
    url: "https://navegam.com.br/busca?ida=2026-10-02&type=ida&origem=39&destino=29&passageiros=1",
    note: "Consulta em 01/10/2026 para 02/10/2026 sem passagens exibidas. Programação, embarcação e preço dependem de confirmação local.",
  },
  azul: {
    name: "Azul · Manaus → Parintins",
    url: "https://passagens.voeazul.com.br/pt/voos-de-manaus-para-parintins",
    note: "Página consultada em 01/10/2026: a partir de R$ 571 para 25/11/2026, só ida. A companhia informa coleta nas últimas 48h, sujeita a alteração e extras de bagagem ou serviços.",
  },
  aeroporto: {
    name: "Manaus Airport · destino Maués",
    url: "https://airport-manaus.com.br/pt-br/destinos/maues",
    note: "Maués aparece na página de destinos do aeroporto, consultada em 01/10/2026. A página não confirma malha vigente, operação em uma data, horários ou tarifas.",
  },
  billy: {
    name: "Billy Adventures Amazônia · Maués Experience",
    url: "https://billyadventure.com.br/produtos/maues-experience-g9mfa/",
    note: "Anúncio consultado em 01/10/2026: R$ 4.900 por pessoa e R$ 7.800 por casal, 5 dias e 4 noites. Sem período de viagem definido no anúncio; reconfirmar com a agência.",
  },
} satisfies Record<string, NavigationSource>;

export type SourceId = keyof typeof navigationSources;
export type ReferencePrice = {
  amountCents: number;
  unit: string;
  observedAt: string;
  travelDate?: string;
  from?: boolean;
  note: string;
};
export type NavigationRoute = {
  id: string;
  origin: NavigationCity;
  destination: NavigationCity;
  mode: TransportMode;
  operator: string;
  summary: string;
  schedule: string;
  price: ReferencePrice | null;
  sourceIds: SourceId[];
  action: { label: string; href: string };
};

export const navigationRoutes: NavigationRoute[] = [
  {
    id: "manaus-maues-fluvial",
    origin: "Manaus",
    destination: "Maués",
    mode: "fluvial",
    operator: "F/B Almirante Dinelson · Navegam",
    summary:
      "Passagem encontrada no ferryboat. Outras embarcações e os contatos estão no quadro semanal abaixo.",
    schedule: "Saída consultada: 02/10/2026 às 18h",
    price: {
      amountCents: 22000,
      unit: "pessoa · só ida",
      observedAt: navigationReviewedAt,
      travelDate: "2026-10-02",
      note: "Passagem cheia exibida pela Navegam. Confirme acomodação, taxas e serviços antes de comprar. A volta é consultada separadamente.",
    },
    sourceIds: ["navegamManaus", "folha"],
    action: { label: "Consultar na Navegam", href: navigationSources.navegamManaus.url },
  },
  {
    id: "maues-manaus-fluvial",
    origin: "Maués",
    destination: "Manaus",
    mode: "fluvial",
    operator: "Navegação PP, Almirante Dinelson I e Lady Cristina",
    summary:
      "O roteiro enviado reúne saídas de segunda a domingo. Escolha a embarcação e confirme passagem e local de embarque pelo contato do quadro.",
    schedule: "Referência do cartaz: saídas às 12h",
    price: null,
    sourceIds: ["folha", "pp"],
    action: { label: "Ver horários e contatos", href: "#horarios" },
  },
  {
    id: "maues-parintins-fluvial",
    origin: "Maués",
    destination: "Parintins",
    mode: "fluvial",
    operator: "Trecho pesquisado · operador a confirmar",
    summary:
      "A busca para 02/10/2026 não exibiu passagens na Navegam. Verifique outras datas e consulte os operadores locais sobre saída direta ou escalas.",
    schedule: "Horário, duração e embarcação a confirmar",
    price: null,
    sourceIds: ["navegamParintins"],
    action: { label: "Consultar o trecho", href: navigationSources.navegamParintins.url },
  },
  {
    id: "maues-ramos-fluvial",
    origin: "Maués",
    destination: "Boa Vista do Ramos",
    mode: "fluvial",
    operator: "Trecho pesquisado · operador a confirmar",
    summary:
      "Destino no Amazonas. A busca para 02/10/2026 não exibiu passagens na Navegam; consulte a programação local e eventuais escalas.",
    schedule: "Horário, duração e embarcação a confirmar",
    price: null,
    sourceIds: ["navegamRamos"],
    action: { label: "Consultar o trecho", href: navigationSources.navegamRamos.url },
  },
  {
    id: "manaus-parintins-aereo",
    origin: "Manaus",
    destination: "Parintins",
    mode: "aereo",
    operator: "Azul · MAO → PIN",
    summary:
      "Referência de tarifa publicada pela companhia. Consulte o itinerário, o horário e as regras de bagagem para a sua data.",
    schedule: "Data da tarifa: 25/11/2026 · horário a consultar",
    price: {
      amountCents: 57100,
      unit: "pessoa · só ida",
      observedAt: navigationReviewedAt,
      travelDate: "2026-11-25",
      from: true,
      note: "A Azul informa que os preços foram coletados nas últimas 48h e podem mudar. Bagagem e serviços opcionais podem ter cobrança adicional.",
    },
    sourceIds: ["azul"],
    action: { label: "Consultar na Azul", href: navigationSources.azul.url },
  },
  {
    id: "manaus-maues-aereo",
    origin: "Manaus",
    destination: "Maués",
    mode: "aereo",
    operator: "Opção aérea · operação a verificar",
    summary:
      "Maués é divulgado como destino pelo Manaus Airport. Não foi possível confirmar uma oferta aérea atual: verifique a operação com a companhia antes de planejar a viagem.",
    schedule: "Malha, companhia, horário e tarifa a confirmar",
    price: null,
    sourceIds: ["aeroporto"],
    action: { label: "Ver informação do aeroporto", href: navigationSources.aeroporto.url },
  },
];

export const navigationOperators = {
  pp: { name: "Navegação PP", phones: ["92994229763", "92995203514"], whatsapp: "92994229763" },
  dinelson: { name: "Almirante Dinelson I", phones: ["92991517907"], whatsapp: null },
  lady: { name: "Lady Cristina", phones: ["92991169274", "92992989191"], whatsapp: null },
} as const;

export const weekDays = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
] as const;
export type ScheduleDirection = "maues-manaus" | "manaus-maues";
export type VesselSchedule = {
  direction: ScheduleDirection;
  day: number;
  vessel: string;
  time: string;
  operator: keyof typeof navigationOperators;
};

// Monday = 0. Times are transcribed from the undated Folha de Maués poster, not live departures.
export const vesselSchedules: VesselSchedule[] = [
  {
    direction: "maues-manaus",
    day: 0,
    vessel: "F/B Almirante Dinelson I",
    time: "12:00",
    operator: "dinelson",
  },
  { direction: "maues-manaus", day: 1, vessel: "F/B Expresso PP", time: "12:00", operator: "pp" },
  {
    direction: "maues-manaus",
    day: 2,
    vessel: "F/B Estrela PP III",
    time: "12:00",
    operator: "pp",
  },
  {
    direction: "maues-manaus",
    day: 3,
    vessel: "F/B Lady Cristina",
    time: "12:00",
    operator: "lady",
  },
  { direction: "maues-manaus", day: 4, vessel: "F/B Estrela PP II", time: "12:00", operator: "pp" },
  { direction: "maues-manaus", day: 5, vessel: "F/B Expresso PP", time: "12:00", operator: "pp" },
  { direction: "maues-manaus", day: 6, vessel: "F/B Estrela PP IV", time: "12:00", operator: "pp" },
  {
    direction: "manaus-maues",
    day: 0,
    vessel: "F/B Lady Cristina",
    time: "17:00",
    operator: "lady",
  },
  { direction: "manaus-maues", day: 1, vessel: "F/B Estrela PP II", time: "17:00", operator: "pp" },
  { direction: "manaus-maues", day: 2, vessel: "F/B Estrela PP IV", time: "17:00", operator: "pp" },
  { direction: "manaus-maues", day: 3, vessel: "F/B Expresso PP", time: "17:00", operator: "pp" },
  {
    direction: "manaus-maues",
    day: 4,
    vessel: "F/B Almirante Dinelson I",
    time: "18:00",
    operator: "dinelson",
  },
  {
    direction: "manaus-maues",
    day: 5,
    vessel: "F/B Estrela PP III",
    time: "12:00",
    operator: "pp",
  },
  { direction: "manaus-maues", day: 6, vessel: "F/B Expresso PP", time: "17:00", operator: "pp" },
];

export const navigationPackages = [
  {
    id: "maues-experience",
    title: "Maués Experience",
    subtitle: "Cinco dias na Terra do Guaraná",
    provider: "Billy Adventures Amazônia",
    duration: "5 dias · 4 noites",
    sourceId: "billy" as const,
    price: {
      amountCents: 490000,
      unit: "pessoa",
      observedAt: navigationReviewedAt,
      note: "O anúncio também informa R$ 7.800 por casal. Datas, disponibilidade e condições precisam ser confirmadas com a agência.",
    } satisfies ReferencePrice,
    includes:
      "Hospedagem, alimentação, passeios, traslados, guia bilíngue e seguro, conforme o anúncio.",
    excludes:
      "Bebidas extras e despesas pessoais. Passagens para chegar a Maués não estão expressamente incluídas; confirme com a agência.",
  },
];
