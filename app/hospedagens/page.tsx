import { Directory } from "@/components/platform/catalog-pages";
export const dynamic = "force-dynamic";
export const metadata = { title: "Hospedagens", alternates: { canonical: "/hospedagens" } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const q = (await searchParams).q;
  return <Directory kind="hotel" query={typeof q === "string" ? q.slice(0, 100) : ""} />;
}
