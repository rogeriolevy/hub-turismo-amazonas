import { redirect } from "next/navigation";
import type { DirectorySearch } from "@/server/cadastur/public-directory";

export const dynamic = "force-dynamic";
export const metadata = { title: "Experiências no Amazonas" };

export default async function Page({ searchParams }: { searchParams: Promise<DirectorySearch> }) {
  const search = await searchParams;
  const params = new URLSearchParams({ tipo: "guia" });
  for (const key of ["q", "cidade"] as const) {
    const value = search[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first?.trim()) params.set(key, first.trim().slice(0, 100));
  }
  redirect(`/experiencias?${params.toString()}`);
}
