import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { getLocale } from "./server";
import { translateText, type Locale } from "./messages";

const translatableProps = new Set([
  "aria-label",
  "aria-description",
  "alt",
  "description",
  "eyebrow",
  "hint",
  "label",
  "placeholder",
  "title",
]);

function localizeFieldValue(value: unknown, locale: Locale): unknown {
  if (typeof value === "string") return translateText(locale, value);
  if (Array.isArray(value)) return value.map((item) => localizeFieldValue(item, locale));
  if (!value || typeof value !== "object") return value;

  const localized = { ...value } as Record<string, unknown>;
  for (const key of ["label", "hint", "title", "description"]) {
    if (typeof localized[key] === "string") {
      localized[key] = translateText(locale, localized[key] as string);
    }
  }
  for (const key of ["options", "fields"]) {
    if (Array.isArray(localized[key])) {
      localized[key] = localized[key].map((item: unknown) => localizeFieldValue(item, locale));
    }
  }
  return localized;
}

function localizeNode(node: ReactNode, locale: Locale): ReactNode {
  if (typeof node === "string") return translateText(locale, node);
  if (Array.isArray(node)) return Children.map(node, (child) => localizeNode(child, locale));
  if (!isValidElement(node)) return node;

  const props = node.props as Record<string, unknown>;
  const localized: Record<string, unknown> = { ...props };
  for (const [key, value] of Object.entries(props)) {
    if (translatableProps.has(key) && typeof value === "string") {
      localized[key] = translateText(locale, value);
    } else if ((key === "fields" || key === "modules") && Array.isArray(value)) {
      localized[key] = value.map((item) => localizeFieldValue(item, locale));
    }
  }
  if ("children" in props) localized.children = localizeNode(props.children as ReactNode, locale);

  return cloneElement(node as ReactElement<Record<string, unknown>>, localized);
}

export async function LocalizedTree({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return localizeNode(children, locale);
}
