import { GuideDetail } from "@/components/platform/catalog-pages";
import { getDatabase } from "@/db";
import { publicGuide } from "@/server/catalog-service";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return {
    title: (await publicGuide(getDatabase(), slug))?.name || "Guia",
    alternates: { canonical: "/guias/" + slug },
  };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <GuideDetail slug={(await params).slug} />;
}
