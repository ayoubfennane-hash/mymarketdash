import * as XLSX from "xlsx";
import { matchCategory, type CategoryMatch } from "./categories";

export type Month = { label: string; long: string; date: string };
export type Product = CategoryMatch & {
  id: number;
  title: string;
  sku: string;
  supplier: string;
  location: string;
  stock: number;
  status: string;
  units: number[];
  amounts: number[];
  totalUnits: number;
  totalAmount: number;
  missingSupplier: boolean;
  missingNumbers: number;
};
export type Dataset = {
  name: string;
  sheet: string;
  products: Product[];
  months: Month[];
  warnings: string[];
};

const labelFmt = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  timeZone: "UTC",
});
const longFmt = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function monthFrom(value: unknown): Month | null {
  let date: Date | undefined;
  if (value instanceof Date) date = value;
  else if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) date = new Date(Date.UTC(d.y, d.m - 1, d.d));
  } else if (typeof value === "string") {
    // XLSX can return ISO dates; ambiguity in other formats is rejected.
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) date = new Date(value);
  }
  if (!date || Number.isNaN(date.getTime())) return null;
  return {
    label: labelFmt.format(date),
    long: longFmt.format(date),
    date: date.toISOString().slice(0, 10),
  };
}

export function parseWorkbook(buffer: ArrayBuffer, name: string): Dataset {
  const book = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = book.SheetNames.find((n) => {
    const h = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[n], {
      header: 1,
      range: 0,
      blankrows: false,
    })[0];
    return (
      h &&
      String(h[0]).toLowerCase() === "title" &&
      String(h[1]).toUpperCase() === "SKU"
    );
  });
  if (!sheetName)
    throw new Error(
      "Feuille de données introuvable. Le classeur doit contenir les colonnes Title, SKU, fournisseur, Location, Available et situation, comme MYMARKET.",
    );
  const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheetName], {
    header: 1,
    defval: null,
    blankrows: false,
    raw: true,
  });
  const header = rows[0];
  if (
    !header ||
    header.length < 28 ||
    String(header[2]).toLowerCase() !== "fournisseur" ||
    String(header[5]).toLowerCase() !== "situation"
  ) {
    throw new Error(
      "Structure non compatible : 28 colonnes attendues avec les quantités G:P, les montants R:AA et leurs totaux Q et AB.",
    );
  }
  const months = header.slice(6, 16).map(monthFrom);
  if (months.some((m) => !m))
    throw new Error(
      "Les en-têtes mensuels G:P doivent être des dates Excel valides.",
    );
  const amountMonths = header.slice(17, 27).map(monthFrom);
  if (months.some((m, i) => m?.date !== amountMonths[i]?.date))
    throw new Error(
      "Les mois des quantités et des montants ne correspondent pas.",
    );
  let skipped = 0;
  const products: Product[] = [];
  rows.slice(1).forEach((row, index) => {
    if (!row[0] || !String(row[0]).trim()) {
      const inputCells = [
        ...row.slice(0, 16),
        ...row.slice(17, 27),
        ...row.slice(28),
      ];
      if (
        inputCells.some(
          (value) => value !== null && value !== undefined && value !== "",
        )
      )
        skipped++;
      return;
    }
    let missingNumbers = 0;
    const num = (value: unknown) => {
      if (value === null || value === undefined || value === "") {
        missingNumbers++;
        return 0;
      }
      const n =
        typeof value === "number"
          ? value
          : Number(String(value).trim().replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(n)) {
        missingNumbers++;
        return 0;
      }
      return n;
    };
    const missingSupplier = [null, undefined, 0, "0", ""].includes(
      row[2] as never,
    );
    const stock = num(row[4]);
    const units = Array.from({ length: 10 }, (_, i) => num(row[i + 6]));
    const amounts = Array.from({ length: 10 }, (_, i) => num(row[i + 17]));
    products.push({
      id: index + 2,
      title: String(row[0]).trim(),
      sku: row[1] == null ? "—" : String(row[1]),
      supplier: missingSupplier ? "Non renseigné" : String(row[2]).trim(),
      ...matchCategory(
        row[1] == null ? "—" : String(row[1]),
        String(row[0]).trim(),
      ),
      location: row[3] ? String(row[3]).trim() : "Non renseigné",
      stock,
      status: row[5] ? String(row[5]).trim() : "Non renseigné",
      units,
      amounts,
      totalUnits: num(row[16]),
      totalAmount: num(row[27]),
      missingSupplier,
      missingNumbers,
    });
  });
  if (products.length === 0)
    throw new Error("Le classeur ne contient aucun produit exploitable.");
  const warnings: string[] = [];
  const suppliers = products.filter((p) => p.missingSupplier).length;
  const negative = products.filter((p) => p.stock < 0).length;
  const missing = products.reduce((a, p) => a + p.missingNumbers, 0);
  const unknown = products.filter(
    (p) => !["En stock", "Presque rupture", "Rupture"].includes(p.status),
  ).length;
  const mismatch = products.filter(
    (p) =>
      Math.abs(p.totalUnits - p.units.reduce((a, b) => a + b, 0)) > 0.001 ||
      Math.abs(p.totalAmount - p.amounts.reduce((a, b) => a + b, 0)) > 0.02,
  ).length;
  if (suppliers)
    warnings.push(
      `${suppliers.toLocaleString("fr-FR")} fournisseurs non renseignés, regroupés sous « Non renseigné ».`,
    );
  if (negative)
    warnings.push(
      `${negative} stocks négatifs conservés tels quels dans les calculs.`,
    );
  if (missing)
    warnings.push(
      `${missing} valeurs numériques absentes ou invalides comptabilisées à zéro.`,
    );
  if (unknown)
    warnings.push(
      `${unknown} états de stock absents ou non standard conservés dans les filtres.`,
    );
  if (mismatch)
    warnings.push(
      `${mismatch} références présentent un écart entre leur total source et la somme mensuelle ; la période filtrée utilise les colonnes mensuelles.`,
    );
  const unmatchedCategories = products.filter(
    (p) => p.categoryMethod === "unmatched",
  ).length;
  if (unmatchedCategories)
    warnings.push(
      `${unmatchedCategories.toLocaleString("fr-FR")} références sans correspondance dans le CSV fourni, regroupées sous « Absent du CSV ».`,
    );
  const missingTypes = products.filter(
    (p) => p.categoryMethod === "missing",
  ).length;
  if (missingTypes)
    warnings.push(
      `${missingTypes.toLocaleString("fr-FR")} références présentes dans le CSV mais sans « Type de produit », regroupées sous « Type non renseigné ».`,
    );
  const ambiguousTypes = products.filter(
    (p) => p.categoryMethod === "ambiguous",
  ).length;
  if (ambiguousTypes)
    warnings.push(
      `${ambiguousTypes.toLocaleString("fr-FR")} références avec des types incompatibles dans le CSV, regroupées sous « Type ambigu ».`,
    );
  if (skipped) warnings.push(`${skipped} lignes sans titre ignorées.`);
  return {
    name,
    sheet: sheetName,
    months: months as Month[],
    products,
    warnings,
  };
}
