import type { RegistryData, RegistryEntry } from "../../lib/cadastur-schema.ts";

export type Existing = RegistryEntry & { data_hash: string };

export type Staged = {
  record: RegistryData;
  hash: string;
  previous: string | null;
  previousPeriod: string | null;
  action: "added" | "updated" | "unchanged";
};
