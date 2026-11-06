import type { ImportHistory, RegistryEntry } from "@/lib/cadastur-schema";

export type CadasturDirectoryState = {
  entries: RegistryEntry[];
  total: number;
  page: number;
  history: ImportHistory[];
};
