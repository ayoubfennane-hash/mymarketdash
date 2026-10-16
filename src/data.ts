import * as XLSX from "xlsx";
import { matchCategory, type CategoryMatch } from "./categories";
import {
  MAX_WORKBOOK_ROWS,
  MAX_WORKBOOK_SHEETS,
  validateXlsxArchive,
} from "./xlsxLimits";

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

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase("fr-FR")
    .replace(/\s+/g, " ");
}

export function parseWorkbook(buffer: ArrayBuffer, name: string): Dataset {
  validateXlsxArchive(buffer);
  const book = XLSX.read(buffer, {
    type: "array",
    cellDates: false,
    sheetRows: MAX_WORKBOOK_ROWS + 1,
  });
  if (book.SheetNames.length > MAX_WORKBOOK_SHEETS)
    throw new Error("Le classeur contient trop de feuilles (10 maximum).");
  const sheetName = book.SheetNames.find((n) => {
    const sheet = book.Sheets[n];
    return (
      normalizeHeader(sheet?.A1?.v) === "title" &&
      normalizeHeader(sheet?.B1?.v) === "sku"
    );
  });
  if (!sheetName)
    throw new Error(
      "Feuille de données introuvable. Le classeur doit contenir les colonnes Title, SKU, fournisseur, Location, Available et situation, comme MYMARKET.",
    );
  const sheet = book.Sheets[sheetName];
  const fullRef = (sheet as typeof sheet & { "!fullref"?: string })["!fullref"];
  const ref = fullRef || sheet["!ref"];
  let range: XLSX.Range;
  try {
    if (!ref) throw new Error();
    range = XLSX.utils.decode_range(ref);
  } catch {
    throw new Error(
      "Structure non compatible : dimensions de feuille invalides.",
    );
  }
  if (
    range.s.r !== 0 ||
    range.s.c !== 0 ||
    range.e.c !== 27 ||
    range.e.r > MAX_WORKBOOK_ROWS
  )
    throw new Error(
      "Structure non compatible : une feuille doit contenir l’en-tête et exactement 28 colonnes, avec au plus 10 000 lignes de produits.",
    );
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
    raw: true,
  });
  const header = rows[0];
  const fixedHeaders: [number, string][] = [
    [0, "title"],
    [1, "sku"],
    [2, "fournisseur"],
    [3, "location"],
    [5, "situation"],
    [16, "totale"],
    [27, "totale"],
  ];
  if (
    !header ||
    header.length !== 28 ||
    fixedHeaders.some(
      ([index, expected]) => normalizeHeader(header[index]) !== expected,
    ) ||
    !["available", "available (not editable)"].includes(
      normalizeHeader(header[4]),
    )
  ) {
    throw new Error(
      "Structure non compatible : les 28 colonnes Title, SKU, fournisseur, Location, Available, situation, G:P, totale, R:AA et totale sont requises dans cet ordre.",
    );
  }
  const months = header.slice(6, 16).map(monthFrom);
  const isMonthlySequence = (values: (Month | null)[]) =>
    values.every(
      (month, index) =>
        month &&
        month.date.endsWith("-01") &&
        (index === 0 ||
          Number(month.date.slice(0, 4)) * 12 +
            Number(month.date.slice(5, 7)) ===
            Number(values[index - 1]!.date.slice(0, 4)) * 12 +
              Number(values[index - 1]!.date.slice(5, 7)) +
              1),
    );
  if (!isMonthlySequence(months))
    throw new Error(
      "Les colonnes G:P doivent contenir dix dates mensuelles consécutives, au premier jour de chaque mois.",
    );
  const amountMonths = header.slice(17, 27).map(monthFrom);
  if (
    !isMonthlySequence(amountMonths) ||
    months.some((m, i) => m?.date !== amountMonths[i]?.date)
  )
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
