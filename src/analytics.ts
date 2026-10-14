import type { Dataset, Product } from "./data";
export type Filters = {
  search: string;
  suppliers: string[];
  status: string;
  category?: string;
  from: number;
  to: number;
};
export function toggleSupplierSelection(selected: string[], name: string) {
  return selected.includes(name)
    ? selected.filter((value) => value !== name)
    : [...selected, name];
}
export type ProductView = Product & {
  periodUnits: number;
  periodAmount: number;
};
export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
export function selectProducts(
  dataset: Dataset,
  filters: Filters,
): ProductView[] {
  const query = filters.search.trim().toLocaleLowerCase("fr");
  const suppliers = new Set(filters.suppliers);
  return dataset.products
    .filter(
      (p) =>
        (!query ||
          `${p.title} ${p.sku} ${p.supplier}`
            .toLocaleLowerCase("fr")
            .includes(query)) &&
        (suppliers.size === 0 || suppliers.has(p.supplier)) &&
        (!filters.category || p.categories.includes(filters.category)) &&
        (!filters.status || p.status === filters.status),
    )
    .map((p) => ({
      ...p,
      periodUnits: sum(p.units.slice(filters.from, filters.to + 1)),
      periodAmount: sum(p.amounts.slice(filters.from, filters.to + 1)),
    }));
}
export function summarize(products: ProductView[]) {
  return {
    count: products.length,
    units: sum(products.map((p) => p.periodUnits)),
    amount: sum(products.map((p) => p.periodAmount)),
    stock: sum(products.map((p) => p.stock)),
    out: products.filter((p) => p.status === "Rupture").length,
    near: products.filter((p) => p.status === "Presque rupture").length,
  };
}
export function makeTrend(
  dataset: Dataset,
  products: ProductView[],
  from: number,
  to: number,
) {
  return dataset.months.slice(from, to + 1).map((month, offset) => ({
    month: month.label,
    long: month.long,
    index: from + offset,
    amount: sum(products.map((p) => p.amounts[from + offset])),
    units: sum(products.map((p) => p.units[from + offset])),
  }));
}
export function groupSuppliers(
  products: ProductView[],
  metric: "amount" | "units",
) {
  const map = new Map<string, number>();
  products.forEach((p) =>
    map.set(
      p.supplier,
      (map.get(p.supplier) || 0) +
        (metric === "amount" ? p.periodAmount : p.periodUnits),
    ),
  );
  return Array.from(map, ([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);
}
export function statusDistribution(products: ProductView[]) {
  const map = new Map<string, number>();
  products.forEach((p) => map.set(p.status, (map.get(p.status) || 0) + 1));
  return Array.from(map, ([name, value]) => ({ name, value }));
}
export function categoryDistribution(products: ProductView[]) {
  const map = new Map<string, number>();
  products.forEach((p) =>
    p.categories.forEach((name) => map.set(name, (map.get(name) || 0) + 1)),
  );
  return Array.from(map, ([name, value]) => ({ name, value })).sort(
    (a, b) => b.value - a.value,
  );
}
export const formatNumber = (n: number, decimals = 0) =>
  new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(n);
export const compactNumber = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
