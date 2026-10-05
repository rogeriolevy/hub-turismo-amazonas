import { TourDetail } from "@/components/platform/catalog-pages";
import { getDatabase } from "@/db";
import { publicTour } from "@/server/catalog-service";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await publicTour(getDatabase(), slug);
  return {
    title: item?.name || "Passeio",
    description: item?.description.slice(0, 160),
    alternates: { canonical: "/passeios/" + slug },
  };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <TourDetail slug={(await params).slug} />;
}
