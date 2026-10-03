import { HotelDetail } from "@/components/platform/catalog-pages";
import { getDatabase } from "@/db";
import { publicHotel } from "@/server/catalog-service";
import { normalizeStaySearch } from "@/lib/stay-search";
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
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    entrada?: string | string[];
    saida?: string | string[];
    pessoas?: string | string[];
  }>;
}) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  return <HotelDetail slug={slug} search={normalizeStaySearch(search)} />;
}
