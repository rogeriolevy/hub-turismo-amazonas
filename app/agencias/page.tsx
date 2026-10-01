import { ProviderDirectory } from "@/components/platform/provider-directory";
import type { DirectorySearch } from "@/server/cadastur/public-directory";
export const dynamic = "force-dynamic";
export const metadata = { title: "Agências de turismo", alternates: { canonical: "/agencias" } };
export default async function Page({ searchParams }: { searchParams: Promise<DirectorySearch> }) {
  return <ProviderDirectory category="agencias" search={await searchParams} />;
}
