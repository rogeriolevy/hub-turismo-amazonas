import { getDatabase } from "@/db";
import {
  directoryCategories,
  publicCadasturProviders,
  providerSource,
  type DirectoryCategory,
} from "@/server/cadastur/public-directory";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  const category = new URL(request.url).searchParams.get("categoria") as DirectoryCategory;
  if (!directoryCategories.includes(category))
    return Response.json({ error: "Categoria inválida." }, { status: 400 });
  return Response.json(
    {
      source: providerSource(category),
      license: "https://opendatacommons.org/licenses/odbl/1-0/",
      data: publicCadasturProviders(getDatabase(), category),
    },
    {
      headers: {
        "content-disposition": `attachment; filename="cadastur-am-${category}.json"`,
        "cache-control": "no-store",
      },
    },
  );
}
