import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseWorkbook } from "../src/data";
import {
  CATEGORY_SOURCE,
  matchCategory,
  createCategoryMatcher,
  MISSING_TYPE,
  ABSENT_FROM_CSV,
} from "../src/categories";
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

describe("Catégories du CSV fourni", () => {
  it("utilise exclusivement le champ Type de produit du rapport fourni", () => {
    expect(CATEGORY_SOURCE.fileName).toBe(
      "Ventestotalesparvariantedeproduit-2026-01-01-2026-10-14.csv",
    );
    expect(CATEGORY_SOURCE.sourceField).toBe("Type de produit");
    expect(CATEGORY_SOURCE.reportRows).toBe(9273);
    expect(CATEGORY_SOURCE.uniqueProducts).toBe(3411);
    expect(CATEGORY_SOURCE.categoryLabels).toHaveLength(13);
    expect(CATEGORY_SOURCE.conflictingProducts).toBe(0);
    expect(
      data.products.every(
        (p) =>
          CATEGORY_SOURCE.categoryLabels.some((c) => c.name === p.category) ||
          [MISSING_TYPE, ABSENT_FROM_CSV].includes(p.category),
      ),
    ).toBe(true);
  });
  it("retrouve la couverture réelle du classeur, en distinguant types vides et absents", () => {
    expect(
      data.products.filter((p) => p.categoryMethod === "sku"),
    ).toHaveLength(1943);
    expect(
      data.products.filter((p) => p.categoryMethod === "title"),
    ).toHaveLength(19);
    expect(
      data.products.filter((p) => p.categoryMethod === "missing"),
    ).toHaveLength(102);
    expect(
      data.products.filter((p) => p.categoryMethod === "unmatched"),
    ).toHaveLength(548);
  });
  it("remplace les sous-rayons du site par le Type de produit CSV des références réelles", () => {
    const banana = data.products.find((p) => p.title === "Banane Import 1Kg")!;
    expect(banana.categories).toEqual(["Alimentation"]);
    const juice = data.products.find(
      (p) => p.title === "Jus essentiel white guava Valencia 1L",
    )!;
    expect(juice.categories).toEqual(["Alimentation"]);
    expect(juice.categoryMethod).toBe("sku");
  });
  it("ne comble pas avec les données web les types vides dans le CSV", () => {
    const missing = data.products.find(
      (p) => p.title === "Lipton Ice Tea fruits rouges 50cl",
    )!;
    expect(missing.category).toBe(MISSING_TYPE);
    expect(missing.categoryMethod).toBe("missing");
    expect(matchCategory("SKU_inexistant", "Produit non référencé zz")).toEqual(
      {
        category: ABSENT_FROM_CSV,
        categories: [ABSENT_FROM_CSV],
        categoryMethod: "unmatched",
      },
    );
  });
  it("préserve les SKU alphanumériques et leurs zéros initiaux", () => {
    const matcher = createCategoryMatcher([
      { sku: "0012345", title: "Produit A", categories: ["Alimentation"] },
      { sku: "P0670S", title: "Produit B", categories: [] },
    ]);
    expect(matcher("0012345", "Autre titre").categoryMethod).toBe("sku");
    expect(matcher("12345", "Autre titre").categoryMethod).toBe("unmatched");
    expect(matcher("P0670S", "Produit B").categoryMethod).toBe("missing");
  });
  it("n’utilise aucun titre approximatif et suspend un rapprochement ambigu", () => {
    const matcher = createCategoryMatcher([
      { sku: "a", title: "Crème de test 200 g", categories: ["Alimentation"] },
      { sku: "b", title: "Identique", categories: ["Animaux"] },
      { sku: "c", title: "Identique", categories: ["Bébé"] },
    ]);
    expect(matcher("", "CREME DE TEST 200 G").categoryMethod).toBe("title");
    expect(matcher("", "Crème de test 201 g").categoryMethod).toBe("unmatched");
    expect(matcher("", "Identique").categoryMethod).toBe("ambiguous");
    expect(matcher("b", "Identique").category).toBe("Animaux");
  });
  it("regroupe bébé/Bébé sans remapper les autres libellés du fichier", () => {
    expect(CATEGORY_SOURCE.categoryLabels.map((c) => c.name)).toContain("Bébé");
    expect(CATEGORY_SOURCE.categoryLabels.map((c) => c.name)).not.toContain(
      "bébé",
    );
    expect(CATEGORY_SOURCE.categoryLabels.map((c) => c.name)).toContain(
      "product",
    );
    expect(CATEGORY_SOURCE.categoryLabels.map((c) => c.name)).toContain(
      "matérnité",
    );
  });
  it("combine type produit, fournisseur et période", () => {
    const products = selectProducts(data, {
      ...base,
      category: "Alimentation",
      supplier: "Valencia",
      from: 0,
      to: 0,
    });
    expect(products.length).toBeGreaterThan(0);
    expect(
      products.every(
        (p) => p.category === "Alimentation" && p.supplier === "Valencia",
      ),
    ).toBe(true);
    expect(summarize(products).units).toBe(
      products.reduce((a, p) => a + p.units[0], 0),
    );
  });
  it("conserve les ventes, quantités et stocks du classeur et produit une partition exhaustive", () => {
    const products = selectProducts(data, base);
    const stats = summarize(products);
    expect(stats.count).toBe(2612);
    expect(stats.amount).toBeCloseTo(1524463.81, 2);
    expect(stats.units).toBe(44059);
    expect(stats.stock).toBe(64437);
    expect(products.every((p) => p.categories.length === 1)).toBe(true);
    const distribution = categoryDistribution(products);
    expect(distribution.find((d) => d.name === "Alimentation")?.value).toBe(
      1241,
    );
    expect(distribution.find((d) => d.name === MISSING_TYPE)?.value).toBe(102);
    expect(distribution.find((d) => d.name === ABSENT_FROM_CSV)?.value).toBe(
      548,
    );
    expect(distribution.reduce((a, d) => a + d.value, 0)).toBe(products.length);
  });
});
