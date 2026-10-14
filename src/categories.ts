import catalogue from "./catalog-categories.json";

export const CATEGORY_SOURCE = {
  url: catalogue.source,
  retrievedAt: catalogue.retrievedAt,
  collections: catalogue.collections,
};
export type CategoryMatch = {
  categories: string[];
  category: string;
  categoryMethod: "sku" | "title" | "unmatched";
  categoryUrl: string;
};
type Entry = (typeof catalogue.products)[number];
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const skuMap = new Map<string, Entry[]>();
const titleMap = new Map<string, Entry[]>();
function add(map: Map<string, Entry[]>, key: string, entry: Entry) {
  if (!key || key === "0" || key === "—") return;
  map.set(key, [...(map.get(key) || []), entry]);
}
catalogue.products.forEach((p) => {
  p.skus.forEach((s) => add(skuMap, s.trim(), p));
  add(titleMap, normalize(p.title), p);
});
function sameCategories(entries: Entry[]) {
  return entries.every(
    (p) =>
      [...p.categories].sort().join("|") ===
      [...entries[0].categories].sort().join("|"),
  );
}
export function matchCategory(sku: string, title: string): CategoryMatch {
  const bySku = skuMap.get(sku.trim());
  const byTitle = titleMap.get(normalize(title));
  let matches = bySku;
  let method: CategoryMatch["categoryMethod"] = "sku";
  // Les SKU réutilisés sont désambiguïsés par le titre, jamais par un rapprochement flou.
  if (matches && matches.length > 1 && !sameCategories(matches)) {
    const exact = matches.filter(
      (p) => normalize(p.title) === normalize(title),
    );
    matches = exact.length && sameCategories(exact) ? exact : undefined;
  }
  if (!matches || !matches.length) {
    matches = byTitle;
    method = "title";
  }
  if (!matches?.length || !sameCategories(matches))
    return {
      categories: ["À classer"],
      category: "À classer",
      categoryMethod: "unmatched",
      categoryUrl: "",
    };
  const p = matches[0];
  return {
    categories: [...p.categories],
    category: p.categories.join(" · "),
    categoryMethod: method,
    categoryUrl: `https://www.mymarket.ma/products/${p.handle}`,
  };
}
export function categoryExplanation(method: CategoryMatch["categoryMethod"]) {
  return method === "sku"
    ? "Correspondance SKU avec MYMARKET.ma"
    : method === "title"
      ? "Correspondance exacte de titre avec MYMARKET.ma"
      : "Aucune correspondance fiable dans le catalogue consulté";
}
