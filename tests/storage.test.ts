import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readStoredWorkbook,
  saveStoredWorkbook,
  clearStoredWorkbook,
} from "../src/workbookStorage";
beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const first = {
  name: "Import-1.xlsx",
  savedAt: "2026-10-15T10:00:00.000Z",
  buffer: Uint8Array.from([1, 2, 3]).buffer,
};
describe("Sauvegarde locale du classeur", () => {
  it("part sans sauvegarde puis conserve fichier, nom et date entre lectures", async () => {
    expect(await readStoredWorkbook()).toBeNull();
    expect(await saveStoredWorkbook(first)).toBe(true);
    expect(await readStoredWorkbook()).toEqual(first);
    expect(await readStoredWorkbook()).toEqual(first);
  });
  it("remplace le dernier fichier validé et permet le retour explicite à la source", async () => {
    await saveStoredWorkbook(first);
    const next = {
      ...first,
      name: "Import-2.xlsx",
      buffer: Uint8Array.from([4, 5]).buffer,
    };
    await saveStoredWorkbook(next);
    expect(await readStoredWorkbook()).toEqual(next);
    await clearStoredWorkbook();
    expect(await readStoredWorkbook()).toBeNull();
  });
  it("ignore les mutations devenues obsolètes sans écraser ni effacer le fichier précédent", async () => {
    await saveStoredWorkbook(first);
    expect(
      await saveStoredWorkbook(
        { ...first, name: "obsolète.xlsx" },
        () => false,
      ),
    ).toBe(false);
    expect(await clearStoredWorkbook(() => false)).toBe(false);
    expect(await readStoredWorkbook()).toEqual(first);
  });
  it("ordonne les remplacements concurrents puis conserve le dernier", async () => {
    const p1 = saveStoredWorkbook(first);
    const next = { ...first, name: "dernier.xlsx" };
    const p2 = saveStoredWorkbook(next);
    await Promise.all([p1, p2]);
    expect(await readStoredWorkbook()).toEqual(next);
  });
  it("échoue explicitement sans stockage et conserve la sauvegarde précédente", async () => {
    const idb = indexedDB;
    await saveStoredWorkbook(first);
    vi.stubGlobal("indexedDB", undefined);
    await expect(
      saveStoredWorkbook({ ...first, name: "non-enregistré.xlsx" }),
    ).rejects.toThrow("stockage local");
    vi.stubGlobal("indexedDB", idb);
    expect(await readStoredWorkbook()).toEqual(first);
  });
  it("ne détruit pas l’ancienne sauvegarde lors d’un échec de clone de transaction", async () => {
    await saveStoredWorkbook(first);
    const invalid = {
      ...first,
      buffer: (() => null) as unknown as ArrayBuffer,
    };
    await expect(saveStoredWorkbook(invalid)).rejects.toBeDefined();
    expect(await readStoredWorkbook()).toEqual(first);
  });
});
