import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { parseWorkbook } from "../src/data";
import { MAX_XLSX_ENTRY_BYTES, validateXlsxArchive } from "../src/xlsxLimits";

const source = Uint8Array.from(
  readFileSync("public/MYMARKET_Tableau_de_bord.xlsx"),
);
function writeWorkbook(change: (sheet: XLSX.WorkSheet) => void): ArrayBuffer {
  const book = XLSX.read(source, { type: "array", cellDates: false });
  const sheet = book.Sheets.Feuil1;
  if (!sheet) throw new Error("Feuil1 not found in fixture");
  change(sheet);
  return XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
describe("Validation bornée des classeurs Excel", () => {
  it("accepte le classeur réel et limite son expansion avant SheetJS", () => {
    const limits = validateXlsxArchive(source);
    expect(limits.isZip).toBe(true);
    expect(limits.entries).toBeLessThanOrEqual(128);
    expect(limits.expandedBytes).toBeLessThanOrEqual(24 * 1024 * 1024);
    expect(
      parseWorkbook(source.slice().buffer, "source.xlsx").products,
    ).toHaveLength(2612);
  });

  it("rejette les archives dont la taille annoncée dépasserait la limite par élément", () => {
    const malicious = source.slice();
    const view = new DataView(malicious.buffer);
    let directoryEntry = -1;
    for (let i = malicious.length - 46; i >= 0; i--) {
      if (view.getUint32(i, true) === 0x02014b50) {
        directoryEntry = i;
        break;
      }
    }
    expect(directoryEntry).toBeGreaterThanOrEqual(0);
    view.setUint32(directoryEntry + 24, MAX_XLSX_ENTRY_BYTES + 1, true);
    expect(() => validateXlsxArchive(malicious)).toThrow("16 Mo");
    expect(() => parseWorkbook(malicious.buffer, "attaquant.xlsx")).toThrow(
      "16 Mo",
    );
  });

  it("rejette les dimensions excessives et les cellules comptées avant le parseur", () => {
    const zipped = (sheetXml: string) =>
      zipSync({
        "xl/workbook.xml": strToU8("<workbook/>", true),
        "xl/worksheets/sheet1.xml": strToU8(sheetXml, true),
      });
    expect(() =>
      validateXlsxArchive(
        zipped('<worksheet><dimension ref="A1:XFD10002"/></worksheet>'),
      ),
    ).toThrow("28 colonnes");

    const tooManyCells =
      '<worksheet><dimension ref="A1:AB10000"/>' +
      '<c r="A1"/>'.repeat(300_001) +
      "</worksheet>";
    expect(() => validateXlsxArchive(zipped(tooManyCells))).toThrow(
      "trop de cellules",
    );
  });

  it("rejette un en-tête manquant, supplémentaire ou déplacé", () => {
    expect(() =>
      parseWorkbook(
        writeWorkbook((sheet) => {
          sheet["E1"] = { t: "s", v: "Quantité" };
        }),
        "mauvais-en-tete.xlsx",
      ),
    ).toThrow("28 colonnes");
    expect(() =>
      parseWorkbook(
        writeWorkbook((sheet) => {
          sheet["AC1"] = { t: "s", v: "extra" };
          sheet["!ref"] = "A1:AC2613";
        }),
        "colonne-extra.xlsx",
      ),
    ).toThrow("28 colonnes");
    expect(() =>
      parseWorkbook(
        writeWorkbook((sheet) => {
          sheet["H1"] = { ...sheet["G1"]! };
        }),
        "mois-duplique.xlsx",
      ),
    ).toThrow("dates mensuelles consécutives");
  });

  it("refuse un classeur qui annonce plus de 10 000 lignes de produits", () => {
    expect(() =>
      parseWorkbook(
        writeWorkbook((sheet) => {
          sheet["A10002"] = { t: "s", v: "Produit hors limite" };
          sheet["!ref"] = "A1:AB10002";
        }),
        "trop-de-lignes.xlsx",
      ),
    ).toThrow("10 000 lignes");
  });
});
