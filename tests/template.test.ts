import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseWorkbook } from "../src/data";
const bytes = readFileSync("public/MYMARKET_modele_import.xlsx");
const wb = XLSX.read(Uint8Array.from(bytes), {
  cellDates: false,
  cellFormula: true,
});
const dataName = wb.SheetNames.find((name) => {
  const r = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
    header: 1,
    range: 0,
    blankrows: false,
  })[0];
  return (
    r &&
    String(r[0]).toLowerCase() === "title" &&
    String(r[1]).toUpperCase() === "SKU"
  );
});
const data = dataName ? wb.Sheets[dataName] : undefined;
describe("Modèle de téléchargement MYMARKET", () => {
  it("est lié à la feuille d’import et conserve les 28 en-têtes requis", () => {
    expect(dataName).toBeTruthy();
    const header = XLSX.utils.sheet_to_json<unknown[]>(data!, {
      header: 1,
      range: 0,
      blankrows: false,
    })[0];
    expect(header).toHaveLength(28);
    expect(header.slice(0, 6)).toEqual([
      "Title",
      "SKU",
      "fournisseur",
      "Location",
      "Available (not editable)",
      "situation",
    ]);
    const month = (v: unknown) =>
      typeof v === "number" ? XLSX.SSF.parse_date_code(v) : null;
    expect(month(header[6])?.m).toBe(1);
    expect(month(header[15])?.m).toBe(10);
    expect(month(header[17])?.m).toBe(1);
    expect(month(header[26])?.m).toBe(10);
    expect(header[16]).toBe("totale");
    expect(header[27]).toBe("totale");
  });
  it("contient des formules de total sur les lignes vierges et aucune donnée produit inventée", () => {
    expect(data!["A2"]?.v).toBeUndefined();
    expect(data!["Q2"]?.f?.replace(/^=/, "")).toMatch(/SUM\(G2:P2\)/i);
    expect(data!["AB2"]?.f?.replace(/^=/, "")).toMatch(/SUM\(R2:AA2\)/i);
    expect(data!["Q101"]?.f?.replace(/^=/, "")).toMatch(/SUM\(G101:P101\)/i);
    expect(wb.SheetNames).toContain("Instructions");
    const instructions = XLSX.utils
      .sheet_to_json<
        unknown[]
      >(wb.Sheets.Instructions, { header: 1, blankrows: false })
      .flat()
      .join(" ");
    expect(instructions).toContain("Type de produit");
    expect(instructions).toContain("100 lignes");
  });
  it("peut être rempli puis lu par l’importateur sans signaler les formules vides", () => {
    const sheet = wb.Sheets[dataName!];
    sheet["A2"] = { t: "s", v: "Produit de test" };
    sheet["B2"] = { t: "s", v: "0012345" };
    sheet["C2"] = { t: "s", v: "Fournisseur" };
    sheet["D2"] = { t: "s", v: "Magasin" };
    sheet["E2"] = { t: "n", v: 4 };
    sheet["F2"] = { t: "s", v: "En stock" };
    sheet["G2"] = { t: "n", v: 3 };
    sheet["Q2"] = { t: "n", v: 3, f: "SUM(G2:P2)" };
    sheet["R2"] = { t: "n", v: 30 };
    sheet["AB2"] = { t: "n", v: 30, f: "SUM(R2:AA2)" };
    const binary = XLSX.write(wb, {
      type: "array",
      bookType: "xlsx",
    }) as ArrayBuffer;
    const parsed = parseWorkbook(binary, "modèle.xlsx");
    expect(parsed.products).toHaveLength(1);
    expect(parsed.products[0].sku).toBe("0012345");
    expect(
      parsed.warnings.some((w) => w.includes("lignes sans titre ignorées")),
    ).toBe(false);
  });
  it("présente uniquement les 28 colonnes au lecteur de classeur", () => {
    expect(XLSX.utils.decode_range(data!["!ref"]!).e.c).toBe(27);
    expect(XLSX.utils.decode_range(data!["!ref"]!).e.r).toBeGreaterThanOrEqual(
      100,
    );
  });
});
