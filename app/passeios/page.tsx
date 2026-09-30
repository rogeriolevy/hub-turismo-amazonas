import { Directory } from "@/components/platform/catalog-pages";
export const dynamic = "force-dynamic";
export const metadata = { title: "Passeios e guias", alternates: { canonical: "/passeios" } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const q = (await searchParams).q;
  return <Directory kind="tour" query={typeof q === "string" ? q.slice(0, 100) : ""} />;
}
