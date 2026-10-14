import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseWorkbook } from "../src/data";
import {
  makeTrend,
  selectProducts,
  summarize,
  statusDistribution,
  toggleSupplierSelection,
} from "../src/analytics";
const b = readFileSync(
  new URL("../public/MYMARKET_Tableau_de_bord.xlsx", import.meta.url),
);
const data = parseWorkbook(
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer,
  "MYMARKET_Tableau_de_bord.xlsx",
);
const base = {
  search: "",
  suppliers: [] as string[],
  status: "",
  from: 0,
  to: 9,
};
describe("Données MYMARKET", () => {
  it("lit le classeur réel et ses mois", () => {
    expect(data.products).toHaveLength(2612);
    expect(data.months[0].date).toBe("2026-01-01");
    expect(data.months[9].date).toBe("2026-10-01");
  });
  it("retrouve tous les indicateurs du classeur", () => {
    const s = summarize(selectProducts(data, base));
    expect(s.count).toBe(2612);
    expect(s.units).toBe(44059);
    expect(s.amount).toBeCloseTo(1524463.81, 2);
    expect(s.stock).toBe(64437);
    expect(s.out).toBe(1105);
    expect(s.near).toBe(180);
  });
  it("synchronise la période mensuelle et les totaux", () => {
    const p = selectProducts(data, { ...base, from: 0, to: 0 });
    const s = summarize(p);
    expect(s.units).toBe(1257);
    expect(s.amount).toBeCloseTo(46379.45, 2);
    expect(s.stock).toBe(64437);
    const t = makeTrend(data, p, 0, 0);
    expect(t).toHaveLength(1);
    expect(t[0].units).toBe(s.units);
  });
  it("filtre les états sans perdre le sens du stock", () => {
    const p = selectProducts(data, { ...base, status: "Rupture" });
    expect(p).toHaveLength(1105);
    expect(statusDistribution(p)).toEqual([{ name: "Rupture", value: 1105 }]);
  });
  it("combine fournisseur et recherche insensible à la casse", () => {
    const p = selectProducts(data, {
      ...base,
      suppliers: ["Valencia"],
      search: "GUAVA",
    });
    expect(p.length).toBeGreaterThan(0);
    expect(
      p.every(
        (r) =>
          r.supplier === "Valencia" && r.title.toLowerCase().includes("guava"),
      ),
    ).toBe(true);
  });
  it("gère la sélection vide et les données manquantes explicitement", () => {
    expect(
      summarize(selectProducts(data, { ...base, search: "zzzz_impossible" }))
        .count,
    ).toBe(0);
    expect(data.products.filter((p) => p.missingSupplier)).toHaveLength(552);
    expect(data.products.filter((p) => p.stock < 0)).toHaveLength(20);
    expect(data.warnings.length).toBeGreaterThan(0);
  });
  it("rejette un fichier qui n’est pas un classeur compatible", () => {
    expect(() => parseWorkbook(new ArrayBuffer(0), "invalide.xlsx")).toThrow();
  });
  it("réunit plusieurs fournisseurs sans doublon ni perte des totaux", () => {
    const names = ["Primeur", "Valencia"];
    const combined = selectProducts(data, { ...base, suppliers: names });
    const single = names.flatMap((name) =>
      selectProducts(data, { ...base, suppliers: [name] }),
    );
    expect(combined.length).toBe(single.length);
    expect(new Set(combined.map((p) => p.id)).size).toBe(combined.length);
    expect(combined.every((p) => names.includes(p.supplier))).toBe(true);
    expect(summarize(combined).amount).toBeCloseTo(summarize(single).amount, 2);
    expect(summarize(combined).units).toBe(summarize(single).units);
    expect(
      selectProducts(data, { ...base, suppliers: ["Valencia", "Valencia"] }),
    ).toEqual(selectProducts(data, { ...base, suppliers: ["Valencia"] }));
  });
  it("combine l’union des fournisseurs aux filtres état, catégorie et période", () => {
    const selected = selectProducts(data, {
      ...base,
      suppliers: ["Primeur", "Valencia"],
      status: "Rupture",
      category: "Alimentation",
      from: 0,
      to: 0,
    });
    expect(selected.length).toBeGreaterThan(0);
    expect(
      selected.every(
        (p) =>
          ["Primeur", "Valencia"].includes(p.supplier) &&
          p.status === "Rupture" &&
          p.category === "Alimentation",
      ),
    ).toBe(true);
    expect(summarize(selected).units).toBe(
      selected.reduce((n, p) => n + p.units[0], 0),
    );
    expect(makeTrend(data, selected, 0, 0)[0].amount).toBeCloseTo(
      summarize(selected).amount,
      2,
    );
  });
  it("ajoute et retire un fournisseur sans toucher aux autres choix", () => {
    expect(toggleSupplierSelection(["Primeur"], "Valencia")).toEqual([
      "Primeur",
      "Valencia",
    ]);
    expect(
      toggleSupplierSelection(["Primeur", "Valencia"], "Valencia"),
    ).toEqual(["Primeur"]);
    expect(selectProducts(data, { ...base, suppliers: [] })).toHaveLength(2612);
  });
});
