import {
  BedDouble,
  BriefcaseBusiness,
  Compass,
  Ship,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";

export const providerDirectoryModules = {
  hospedagens: {
    label: "Hospedagens",
    title: "Encontre seu lugar na Amazônia.",
    description: "Hotéis e pousadas para descansar entre uma descoberta e outra.",
    icon: BedDouble,
  },
  gastronomia: {
    label: "Gastronomia",
    title: "Sabores que contam histórias.",
    description: "Restaurantes, bares e cafeterias para conhecer o Amazonas à mesa.",
    icon: UtensilsCrossed,
  },
  guias: {
    label: "Guias de turismo",
    title: "Conheça o Amazonas com quem é daqui.",
    description: "Encontre profissionais, confira os idiomas e planeje seu roteiro.",
    icon: Compass,
  },
  agencias: {
    label: "Agências de turismo",
    title: "Sua próxima viagem começa aqui.",
    description: "Agências para organizar passeios, pacotes e novas experiências.",
    icon: BriefcaseBusiness,
  },
  servicos: {
    label: "Serviços turísticos",
    title: "Cada detalhe da sua viagem.",
    description: "Encontre prestadores especializados em experiências e serviços turísticos.",
    icon: Sparkles,
  },
  passeios: {
    label: "Experiências",
    title: "Experiências para descobrir o Amazonas.",
    description: "Encontre atividades locais, roteiros e serviços para viver a região.",
    icon: Compass,
  },
  navegacao: {
    label: "Navegação",
    title: "Caminhos que conectam a Amazônia.",
    description: "Conheça operadores, serviços e informações para seguir pelos rios.",
    icon: Ship,
  },
} as const;
