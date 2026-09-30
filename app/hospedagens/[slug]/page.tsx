import { HotelDetail } from "@/components/platform/catalog-pages";
import { getDatabase } from "@/db";
import { publicHotel } from "@/server/catalog-service";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = publicHotel(getDatabase(), slug);
  return {
    title: item?.name || "Hospedagem",
    description: item?.description.slice(0, 160),
    alternates: { canonical: "/hospedagens/" + slug },
  };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <HotelDetail slug={(await params).slug} />;
}
