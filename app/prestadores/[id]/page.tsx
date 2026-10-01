import { ProviderDetail } from "@/components/platform/provider-directory";
import { getDatabase } from "@/db";
import { publicProvider } from "@/server/cadastur/public-directory";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = publicProvider(getDatabase(), id);
  return {
    title: entry?.name || "Prestador não encontrado",
    alternates: { canonical: "/prestadores/" + id },
  };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ProviderDetail id={(await params).id} />;
}
