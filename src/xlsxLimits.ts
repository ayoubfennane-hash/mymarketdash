import { Unzip, UnzipInflate } from "fflate";

export const MAX_WORKBOOK_BYTES = 10 * 1024 * 1024;
export const MAX_WORKBOOK_ROWS = 10_000;
export const MAX_WORKBOOK_SHEETS = 10;
export const MAX_WORKBOOK_CELLS = 300_000;
export const MAX_XLSX_ENTRIES = 128;
export const MAX_XLSX_EXPANDED_BYTES = 24 * 1024 * 1024;
export const MAX_XLSX_ENTRY_BYTES = 16 * 1024 * 1024;

const ZIP_LOCAL_FILE = 0x04034b50;
const ZIP_CENTRAL_FILE = 0x02014b50;
const ZIP_END = 0x06054b50;
const ZIP64_SENTINEL = 0xffffffff;

function invalid(message = "Fichier XLSX invalide ou incomplet."): never {
  throw new Error(message);
}

function columnNumber(letters: string): number {
  let value = 0;
  for (const letter of letters.toUpperCase()) {
    const code = letter.charCodeAt(0);
    if (code < 65 || code > 90) return Number.NaN;
    value = value * 26 + code - 64;
  }
  return value;
}

function cellAddress(address: string): { column: number; row: number } | null {
  const match = /^\$?([A-Z]{1,3})\$?(\d+)$/i.exec(address);
  if (!match) return null;
  return { column: columnNumber(match[1]), row: Number(match[2]) };
}

function inspectWorksheetXml(xml: string): number {
  const dimension = /<dimension\b[^>]*\bref=["']([^"']+)["']/i.exec(xml)?.[1];
  if (!dimension)
    invalid("Le classeur XLSX ne précise pas les dimensions d’une feuille.");
  const bounds = dimension.split(":");
  if (bounds.length < 1 || bounds.length > 2) invalid();
  const start = cellAddress(bounds[0]);
  const finish = cellAddress(bounds[1] || bounds[0]);
  if (!start || !finish) invalid();
  const maxRows = MAX_WORKBOOK_ROWS + 1; // l’en-tête plus les lignes produit
  if (
    start.column < 1 ||
    start.row < 1 ||
    finish.column < start.column ||
    finish.row < start.row ||
    finish.column > 28 ||
    finish.row > maxRows
  )
    invalid(
      "Une feuille dépasse la limite sécurisée de 28 colonnes et 10 000 lignes de produits.",
    );

  let cells = 0;
  for (const match of xml.matchAll(/<c\b([^>]*)\/?\s*>/gi)) {
    cells++;
    if (cells > MAX_WORKBOOK_CELLS)
      invalid("Le classeur contient trop de cellules (300 000 maximum).");
    const address = /(?:^|\s)r=["']([^"']+)["']/i.exec(match[1])?.[1];
    const cell = address ? cellAddress(address) : null;
    if (
      !cell ||
      cell.column < 1 ||
      cell.column > 28 ||
      cell.row < 1 ||
      cell.row > maxRows
    )
      invalid(
        "Une cellule dépasse la limite sécurisée de 28 colonnes et 10 000 lignes de produits.",
      );
  }
  return cells;
}

/**
 * Inspects ZIP metadata and bounded worksheet XML before handing an XLSX to
 * SheetJS. Legacy BIFF .xls is not ZIP and is bounded separately by SheetJS'
 * row limit.
 */
export function validateXlsxArchive(input: ArrayBuffer | Uint8Array): {
  isZip: boolean;
  entries: number;
  expandedBytes: number;
  cells: number;
} {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength > MAX_WORKBOOK_BYTES)
    invalid("Le fichier dépasse la limite de 10 Mo.");
  if (
    bytes.byteLength < 4 ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    bytes[2] !== 0x03 ||
    bytes[3] !== 0x04
  )
    return { isZip: false, entries: 0, expandedBytes: 0, cells: 0 };

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minEocd = Math.max(0, bytes.byteLength - 22 - 65_535);
  let end = -1;
  for (let i = bytes.byteLength - 22; i >= minEocd; i--) {
    if (view.getUint32(i, true) !== ZIP_END) continue;
    const commentLength = view.getUint16(i + 20, true);
    if (i + 22 + commentLength === bytes.byteLength) {
      end = i;
      break;
    }
  }
  if (end < 0) invalid();

  const disk = view.getUint16(end + 4, true);
  const directoryDisk = view.getUint16(end + 6, true);
  const diskEntries = view.getUint16(end + 8, true);
  const entryCount = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryOffset = view.getUint32(end + 16, true);
  if (
    disk !== 0 ||
    directoryDisk !== 0 ||
    diskEntries !== entryCount ||
    entryCount === 0xffff ||
    directorySize === ZIP64_SENTINEL ||
    directoryOffset === ZIP64_SENTINEL
  )
    invalid(
      "Ce classeur Excel utilise un format ZIP64 ou multi-disque non pris en charge.",
    );
  if (entryCount < 1 || entryCount > MAX_XLSX_ENTRIES)
    invalid("Le classeur XLSX contient trop d’éléments (128 maximum).");

  const directoryEnd = directoryOffset + directorySize;
  if (
    directoryOffset > end ||
    directoryEnd > end ||
    directoryEnd < directoryOffset
  )
    invalid();

  let cursor = directoryOffset;
  let expandedBytes = 0;
  let hasWorkbook = false;
  let worksheetCount = 0;
  const names = new Set<string>();
  const declaredSizes = new Map<string, number>();
  for (let i = 0; i < entryCount; i++) {
    if (
      cursor + 46 > directoryEnd ||
      view.getUint32(cursor, true) !== ZIP_CENTRAL_FILE
    )
      invalid();
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const compressed = view.getUint32(cursor + 20, true);
    const expanded = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const startDisk = view.getUint16(cursor + 34, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (
      next > directoryEnd ||
      compressed === ZIP64_SENTINEL ||
      expanded === ZIP64_SENTINEL ||
      localOffset === ZIP64_SENTINEL ||
      startDisk !== 0 ||
      localOffset + 4 > directoryOffset ||
      view.getUint32(localOffset, true) !== ZIP_LOCAL_FILE
    )
      invalid();
    if (flags & 1)
      invalid("Les classeurs Excel chiffrés ne sont pas pris en charge.");
    if (method !== 0 && method !== 8)
      invalid("Le classeur XLSX utilise une compression non prise en charge.");
    if (expanded > MAX_XLSX_ENTRY_BYTES)
      invalid(
        "Une partie décompressée du classeur dépasse la limite de 16 Mo.",
      );
    expandedBytes += expanded;
    if (expandedBytes > MAX_XLSX_EXPANDED_BYTES)
      invalid("Le contenu décompressé du classeur dépasse la limite de 24 Mo.");
    if (expanded > 0 && compressed === 0) invalid();

    const nameStart = cursor + 46;
    const name = new TextDecoder().decode(
      bytes.subarray(nameStart, nameStart + nameLength),
    );
    if (names.has(name))
      invalid("Le classeur XLSX contient des noms d’élément en double.");
    names.add(name);
    declaredSizes.set(name, expanded);
    if (name === "xl/workbook.xml") hasWorkbook = true;
    if (/^xl\/worksheets\/sheet\d+\.xml$/i.test(name)) worksheetCount++;
    cursor = next;
  }
  if (cursor !== directoryEnd || !hasWorkbook || worksheetCount === 0)
    invalid();
  if (worksheetCount > MAX_WORKBOOK_SHEETS)
    invalid("Le classeur contient trop de feuilles (10 maximum).");

  let expandedActual = 0;
  let streamError = "";
  const worksheetXml = new Map<string, string>();
  const unzip = new Unzip((file) => {
    if (streamError) {
      void file.terminate();
      return;
    }
    const declaredSize = declaredSizes.get(file.name);
    if (declaredSize === undefined) {
      streamError = "Fichier XLSX invalide ou incomplet.";
      void file.terminate();
      return;
    }
    const isWorksheet = /^xl\/worksheets\/sheet\d+\.xml$/i.test(file.name);
    let entrySize = 0;
    let xml = "";
    const decoder = isWorksheet ? new TextDecoder() : null;
    file.ondata = (error, chunk, final) => {
      if (streamError) return;
      if (error) {
        streamError =
          "Le contenu ZIP du classeur XLSX est endommagé ou ne peut pas être décompressé.";
        void file.terminate();
        return;
      }
      entrySize += chunk.byteLength;
      expandedActual += chunk.byteLength;
      if (
        entrySize > MAX_XLSX_ENTRY_BYTES ||
        expandedActual > MAX_XLSX_EXPANDED_BYTES
      ) {
        streamError =
          "Le contenu réellement décompressé dépasse les limites de sécurité du classeur.";
        void file.terminate();
        return;
      }
      if (decoder) {
        xml += decoder.decode(chunk, { stream: !final });
        if (final) {
          if (entrySize !== declaredSize) {
            streamError =
              "Les tailles XLSX annoncées ne correspondent pas au contenu.";
            void file.terminate();
          } else {
            worksheetXml.set(file.name, xml);
          }
        }
      } else if (final && entrySize !== declaredSize) {
        streamError =
          "Les tailles XLSX annoncées ne correspondent pas au contenu.";
        void file.terminate();
      }
    };
    try {
      file.start();
    } catch {
      streamError =
        "Le classeur XLSX utilise une compression endommagée ou non prise en charge.";
      void file.terminate();
    }
  });
  unzip.register(UnzipInflate);
  try {
    // Bound each inflation step, including ZIPs with falsified size metadata.
    for (let offset = 0; offset < bytes.byteLength; offset += 1024) {
      const end = Math.min(offset + 1024, bytes.byteLength);
      unzip.push(bytes.subarray(offset, end), end === bytes.byteLength);
      if (streamError) invalid(streamError);
    }
  } catch {
    if (streamError) invalid(streamError);
    invalid(
      "Le contenu ZIP du classeur XLSX est endommagé ou ne peut pas être décompressé.",
    );
  }
  if (streamError) invalid(streamError);
  if (expandedActual !== expandedBytes || worksheetXml.size !== worksheetCount)
    invalid("Les tailles XLSX annoncées ne correspondent pas au contenu.");

  let cells = 0;
  for (const xml of worksheetXml.values()) {
    cells += inspectWorksheetXml(xml);
    if (cells > MAX_WORKBOOK_CELLS)
      invalid("Le classeur contient trop de cellules (300 000 maximum).");
  }
  return { isZip: true, entries: entryCount, expandedBytes, cells };
}
