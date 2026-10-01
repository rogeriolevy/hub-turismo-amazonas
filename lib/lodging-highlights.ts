// Editorial references from the hotels' own websites, independent of imported Cadastur identities.
export const lodgingHighlights = [
  {
    name: "Hotel Miramar",
    city: "Maués",
    price: null,
    description:
      "Apartamentos Luxo e Suíte Master, ar-condicionado, Wi-Fi e café da manhã regional.",
    terms: "O hotel informa as diárias por consulta.",
    phone: "+5592991463089",
    email: "hotelmiramarmaues@gmail.com",
    address: "Largo Marechal Deodoro, 351 · Centro, Maués",
    source: "https://www.hotelmiramarmaues.com.br/",
    sourceLabel: "Site do hotel",
    checked: "2026-10-01",
  },
  {
    name: "Icamiabas Parintins",
    city: "Parintins",
    price: 330,
    description: "Wi-Fi e estacionamento gratuitos. Entrada a partir das 13h e saída até as 12h.",
    terms:
      "Valor inicial anunciado; impostos e taxas à parte. Consulte as datas e a ocupação no hotel.",
    phone: "+5592992662722",
    email: "",
    address: "Rua Pichita Cohen, 3 · Vitória Régia, Parintins",
    source: "https://book.omnibees.com/chain/5131/hotel/9046",
    sourceLabel: "Reservas do hotel",
    checked: "2026-10-01",
  },
] as const;
