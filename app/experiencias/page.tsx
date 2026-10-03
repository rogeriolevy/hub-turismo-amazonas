import { ExperienceDirectory } from "@/components/platform/experience-directory";
import type { DirectorySearch } from "@/server/cadastur/public-directory";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Experiências no Amazonas",
  description: "Encontre passeios, roteiros e guias de turismo no Amazonas.",
  alternates: { canonical: "/experiencias" },
};

export default async function Page({ searchParams }: { searchParams: Promise<DirectorySearch> }) {
  return <ExperienceDirectory search={await searchParams} />;
}
