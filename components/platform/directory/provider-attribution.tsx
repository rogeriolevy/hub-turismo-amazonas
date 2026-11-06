import { providerSource, type DirectoryCategory } from "@/server/cadastur/public-directory";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/messages";

export async function ProviderAttribution({
  category,
  includesHub = false,
}: {
  category: DirectoryCategory;
  includesHub?: boolean;
}) {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return (
    <div className="provider-attribution">
      <span>
        {t("directory.source")}{" "}
        <a href={providerSource(category)} target="_blank" rel="noreferrer">
          Cadastur · Ministério do Turismo
        </a>{" "}
        {t("directory.license")}{" "}
        <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">
          ODbL 1.0
        </a>
        .{includesHub && " " + t("directory.extraHubContent")}
      </span>
      <a href={"/api/diretorio?categoria=" + category}>{t("directory.openData")}</a>
    </div>
  );
}
