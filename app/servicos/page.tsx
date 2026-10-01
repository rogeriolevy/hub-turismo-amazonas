import { ProviderDirectory } from "@/components/platform/provider-directory";
import type { DirectorySearch } from "@/server/cadastur/public-directory";
export const dynamic = "force-dynamic";
export const metadata = { title: "Serviços turísticos", alternates: { canonical: "/servicos" } };
export default async function Page({ searchParams }: { searchParams: Promise<DirectorySearch> }) {
  return <ProviderDirectory category="servicos" search={await searchParams} />;
}
