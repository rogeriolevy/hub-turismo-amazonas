import { ProviderDirectory } from "@/components/platform/provider-directory";
import type { DirectorySearch } from "@/server/cadastur/public-directory";
export const dynamic = "force-dynamic";
export const metadata = { title: "Gastronomia", alternates: { canonical: "/gastronomia" } };
export default async function Page({ searchParams }: { searchParams: Promise<DirectorySearch> }) {
  return <ProviderDirectory category="gastronomia" search={await searchParams} />;
}
