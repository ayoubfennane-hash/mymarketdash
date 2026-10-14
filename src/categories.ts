import index from "./category-source.json";

export const CATEGORY_SOURCE = index.source;
export const MISSING_TYPE = "Type non renseigné";
export const ABSENT_FROM_CSV = "Absent du CSV";
export const AMBIGUOUS_TYPE = "Type ambigu";
export type CategoryMethod =
  | "sku"
  | "title"
  | "missing"
  | "unmatched"
  | "ambiguous";
export type CategoryMatch = {
  categories: string[];
  category: string;
  categoryMethod: CategoryMethod;
};
type Entry = { sku: string; title: string; categories: string[] };
export const normalizeTitle = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function classified(
  category: string,
  categoryMethod: CategoryMethod,
): CategoryMatch {
  return { categories: [category], category, categoryMethod };
}
// Exporté pour tester les cas ambigus sans modifier l'index de production.
export function createCategoryMatcher(entries: Entry[]) {
  const skuMap = new Map<string, Entry[]>();
  const titleMap = new Map<string, Entry[]>();
  const add = (map: Map<string, Entry[]>, key: string, entry: Entry) => {
    if (!key || key === "0" || key === "—") return;
    map.set(key, [...(map.get(key) || []), entry]);
  };
  entries.forEach((p) => {
    add(skuMap, p.sku.trim(), p);
    add(titleMap, normalizeTitle(p.title), p);
  });
  const resolve = (matches: Entry[], method: "sku" | "title") => {
    const types = [...new Set(matches.flatMap((p) => p.categories))];
    if (types.length > 1) return classified(AMBIGUOUS_TYPE, "ambiguous");
    if (!types.length) return classified(MISSING_TYPE, "missing");
    return classified(types[0], method);
  };
  return (sku: string, title: string): CategoryMatch => {
    const bySku = skuMap.get(sku.trim());
    // Un SKU présent mais sans type reste non renseigné ; pas de remplissage par le site.
    if (bySku?.length) return resolve(bySku, "sku");
    const byTitle = titleMap.get(normalizeTitle(title));
    if (byTitle?.length) return resolve(byTitle, "title");
    return classified(ABSENT_FROM_CSV, "unmatched");
  };
}
export const matchCategory = createCategoryMatcher(index.products);
export function isAssignedCategory(method: CategoryMethod) {
  return method === "sku" || method === "title";
}
export function categoryExplanation(method: CategoryMethod) {
  switch (method) {
    case "sku":
      return "Type de produit du CSV · correspondance SKU exacte";
    case "title":
      return "Type de produit du CSV · correspondance de titre exact normalisé";
    case "missing":
      return "Produit présent dans le CSV, mais le champ « Type de produit » est vide";
    case "ambiguous":
      return "Plusieurs types distincts dans le CSV pour cette identité ; attribution suspendue";
    default:
      return "Aucune correspondance SKU ou titre dans le CSV fourni";
  }
}
