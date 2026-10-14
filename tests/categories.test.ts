import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseWorkbook } from "../src/data";
import { CATEGORY_SOURCE, matchCategory } from "../src/categories";
import {
  selectProducts,
  summarize,
  categoryDistribution,
} from "../src/analytics";
const b = readFileSync("public/MYMARKET_Tableau_de_bord.xlsx");
const data = parseWorkbook(
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer,
  "MYMARKET_Tableau_de_bord.xlsx",
);
const base = {
  search: "",
  supplier: "",
  status: "",
  category: "",
  from: 0,
  to: 9,
};
describe("Catégories MYMARKET.ma", () => {
  it("rapproche 2 531 références réelles et garde 81 références sans correspondance", () => {
    expect(
      data.products.filter((p) => p.categoryMethod === "sku"),
    ).toHaveLength(2506);
    expect(
      data.products.filter((p) => p.categoryMethod === "title"),
    ).toHaveLength(25);
    expect(
      data.products.filter((p) => p.categoryMethod === "unmatched"),
    ).toHaveLength(81);
    expect(CATEGORY_SOURCE.collections).toHaveLength(11);
  });
  it("retrouve les rayons de produits réels et leur fiche officielle", () => {
    const banana = data.products.find((p) => p.title === "Banane Import 1Kg")!;
    expect(banana.categories).toContain("Marché et Boucherie");
    expect(banana.categoryMethod).toBe("sku");
    expect(banana.categoryUrl).toMatch(
      /^https:\/\/www.mymarket.ma\/products\//,
    );
    const juice = data.products.find(
      (p) => p.title === "Jus essentiel white guava Valencia 1L",
    )!;
    expect(juice.categories).toContain("Boissons");
  });
  it("ne devine jamais une catégorie pour un produit absent de l’index", () => {
    expect(
      matchCategory("SKU_inexistant", "Produit jamais publié zzz"),
    ).toEqual({
      category: "À classer",
      categories: ["À classer"],
      categoryMethod: "unmatched",
      categoryUrl: "",
    });
  });
  it("combine catégorie, fournisseur et période", () => {
    const products = selectProducts(data, {
      ...base,
      category: "Boissons",
      supplier: "Valencia",
      from: 0,
      to: 0,
    });
    expect(products.length).toBeGreaterThan(0);
    expect(
      products.every(
        (p) => p.categories.includes("Boissons") && p.supplier === "Valencia",
      ),
    ).toBe(true);
    expect(summarize(products).units).toBe(
      products.reduce((a, p) => a + p.units[0], 0),
    );
  });
  it("ne double compte jamais les produits à plusieurs rayons dans les indicateurs", () => {
    const products = selectProducts(data, base);
    expect(products.some((p) => p.categories.length > 1)).toBe(true);
    expect(summarize(products).amount).toBeCloseTo(1524463.81, 2);
    expect(summarize(products).units).toBe(44059);
    const distribution = categoryDistribution(products);
    expect(distribution.find((d) => d.name === "À classer")?.value).toBe(81);
    expect(distribution.reduce((a, d) => a + d.value, 0)).toBeGreaterThan(
      products.length,
    );
  });
});
