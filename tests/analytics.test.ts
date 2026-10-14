import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseWorkbook } from "../src/data";
import {
  makeTrend,
  selectProducts,
  summarize,
  statusDistribution,
} from "../src/analytics";
const b = readFileSync(
  new URL("../public/MYMARKET_Tableau_de_bord.xlsx", import.meta.url),
);
const data = parseWorkbook(
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer,
  "MYMARKET_Tableau_de_bord.xlsx",
);
const base = { search: "", supplier: "", status: "", from: 0, to: 9 };
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
      supplier: "Valencia",
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
});
