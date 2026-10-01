import { ProviderDirectory } from "@/components/platform/provider-directory";
import type { DirectorySearch } from "@/server/cadastur/public-directory";
export const dynamic = "force-dynamic";
export const metadata = { title: "Guias de turismo", alternates: { canonical: "/guias" } };
export default async function Page({ searchParams }: { searchParams: Promise<DirectorySearch> }) {
  return <ProviderDirectory category="guias" search={await searchParams} />;
}
