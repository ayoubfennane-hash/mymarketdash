// @vitest-environment jsdom
import { IDBFactory } from "fake-indexeddb";
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { readStoredWorkbook, saveStoredWorkbook } from "../src/workbookStorage";
vi.mock("../src/cloudClient", () => ({
  getCloudAccount: async () => null,
  readCloudWorkbook: async () => null,
  saveCloudWorkbook: async () => {
    throw new Error("unused in local test");
  },
  beginManusLogin: async () => {},
  logoutCloud: async () => {},
  downloadCloudWorkbook: async () => {},
}));
vi.mock("recharts", () => ({
  Area: () => null,
  AreaChart: () => null,
  Bar: () => null,
  BarChart: () => null,
  CartesianGrid: () => null,
  Cell: () => null,
  Pie: () => null,
  PieChart: () => null,
  ResponsiveContainer: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));
const buffer = Uint8Array.from(
  readFileSync("public/MYMARKET_Tableau_de_bord.xlsx"),
).buffer;
const record = {
  name: "Mon-import-conserve.xlsx",
  buffer,
  savedAt: "2026-10-15T10:00:00.000Z",
};
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("indexedDB", new IDBFactory());
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => buffer }),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function settle(predicate: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
  throw new Error("L’état attendu n’a pas été atteint.");
}
async function render() {
  await act(async () => root.render(<App />));
  await settle(
    () =>
      !host
        .querySelector(".source-status")
        ?.textContent?.includes("Lecture en cours"),
  );
}
async function upload(name: string, bytes: ArrayBuffer) {
  const file = new File([bytes], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes });
  const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () =>
    input.dispatchEvent(new Event("change", { bubbles: true })),
  );
  await settle(
    () =>
      !host
        .querySelector(".source-status")
        ?.textContent?.includes("Import en cours"),
  );
}
async function resetSource() {
  const button = Array.from(
    host.querySelectorAll<HTMLButtonElement>(".local-import-info button"),
  ).find((b) => b.textContent?.includes("Revenir au fichier initial"))!;
  await act(async () => button.click());
  const confirm = Array.from(
    host.querySelectorAll<HTMLButtonElement>(".local-import-confirm button"),
  ).find((b) => b.textContent?.includes("Confirmer le retour"))!;
  await act(async () => confirm.click());
  await settle(
    () =>
      !host
        .querySelector(".source-status")
        ?.textContent?.includes("Import en cours"),
  );
}
describe("Import restauré après actualisation", () => {
  it("restaure en priorité le classeur enregistré sans télécharger le fichier initial", async () => {
    await saveStoredWorkbook(record);
    await render();
    expect(fetch).not.toHaveBeenCalled();
    expect(host.querySelector(".source-status")?.textContent).toContain(
      "Import restauré",
    );
    expect(host.querySelector(".local-import-info")?.textContent).toContain(
      record.name,
    );
    expect(host.querySelector(".filter-foot")?.textContent).toContain("2 612");
  });
  it("sauvegarde un import et le retrouve après un nouveau montage de la page", async () => {
    await render();
    await upload("Nouveau-fichier.xlsx", buffer);
    expect((await readStoredWorkbook())?.name).toBe("Nouveau-fichier.xlsx");
    expect(host.querySelector(".source-status")?.textContent).toContain(
      "Import enregistré sur cet appareil",
    );
    await act(async () => root.unmount());
    root = createRoot(host);
    vi.mocked(fetch).mockClear();
    await render();
    expect(fetch).not.toHaveBeenCalled();
    expect(host.querySelector(".source-status")?.textContent).toContain(
      "Import restauré",
    );
    expect(host.querySelector(".local-import-info")?.textContent).toContain(
      "Nouveau-fichier.xlsx",
    );
    expect(host.querySelector(".reading-summary")?.textContent).toContain(
      "44 059 unités",
    );
  });
  it("conserve la sauvegarde et les données lors d’un fichier Excel invalide", async () => {
    await saveStoredWorkbook(record);
    await render();
    await upload("invalide.xlsx", new ArrayBuffer(0));
    expect((await readStoredWorkbook())?.name).toBe(record.name);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "précédent est conservé",
    );
    expect(host.querySelector(".filter-foot")?.textContent).toContain("2 612");
  });
  it("ne remplace pas l’import précédent si le stockage refuse le nouveau fichier", async () => {
    await saveStoredWorkbook(record);
    await render();
    const storage = indexedDB;
    vi.stubGlobal("indexedDB", undefined);
    await upload("pas-sauvegarde.xlsx", buffer);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "Impossible d’enregistrer cet import",
    );
    vi.stubGlobal("indexedDB", storage);
    expect((await readStoredWorkbook())?.name).toBe(record.name);
    expect(host.querySelector(".local-import-info")?.textContent).toContain(
      record.name,
    );
  });
  it("ne supprime pas l’import si l’utilisateur annule le retour au fichier initial", async () => {
    await saveStoredWorkbook(record);
    await render();
    const start = host.querySelector<HTMLButtonElement>(
      ".local-import-info > .btn",
    )!;
    await act(async () => start.click());
    expect(host.querySelector(".local-import-confirm")).not.toBeNull();
    const cancel = Array.from(
      host.querySelectorAll<HTMLButtonElement>(".local-import-confirm button"),
    ).find((b) => b.textContent?.includes("Annuler"))!;
    await act(async () => cancel.click());
    expect(host.querySelector(".local-import-confirm")).toBeNull();
    expect((await readStoredWorkbook())?.name).toBe(record.name);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("ne supprime pas l’import si le fichier initial est indisponible", async () => {
    await saveStoredWorkbook(record);
    await render();
    vi.mocked(fetch).mockRejectedValue(new Error("Source indisponible"));
    await resetSource();
    expect((await readStoredWorkbook())?.name).toBe(record.name);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "Source indisponible",
    );
    expect(host.querySelector(".filter-foot")?.textContent).toContain("2 612");
  });
  it("guide la réimportation unique quand aucune ancienne sauvegarde n’existe", async () => {
    await render();
    expect(host.querySelector(".local-import-prompt")?.textContent).toContain(
      "Les imports perdus avant cette mise à jour doivent être réimportés",
    );
    expect(
      host.querySelector(".local-import-prompt button")?.textContent,
    ).toContain("Importer mon Excel");
  });
  it("revient au fichier intégré seulement après confirmation et validation", async () => {
    await saveStoredWorkbook(record);
    await render();
    await resetSource();
    expect(await readStoredWorkbook()).toBeNull();
    expect(
      host.querySelector("[aria-label='Classeur enregistré localement']"),
    ).toBeNull();
    expect(host.querySelector(".source-status")?.textContent).toContain(
      "Classeur chargé",
    );
  });
  it("signale une sauvegarde invalide sans l’effacer silencieusement", async () => {
    await saveStoredWorkbook({ ...record, buffer: new ArrayBuffer(0) });
    await render();
    expect(host.querySelector(".local-storage-warning")?.textContent).toContain(
      "pas pu être restaurée",
    );
    expect((await readStoredWorkbook())?.name).toBe(record.name);
    expect(fetch).toHaveBeenCalledOnce();
    expect(host.querySelector(".source-status")?.textContent).toContain(
      "Classeur chargé",
    );
  });
  it("ne rétablit pas un fichier initial retardé par-dessus un nouvel import", async () => {
    let resolve!: (value: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      ),
    );
    await act(async () => root.render(<App />));
    await settle(() => Boolean(resolve));
    await upload("Import-prioritaire.xlsx", buffer);
    expect((await readStoredWorkbook())?.name).toBe("Import-prioritaire.xlsx");
    await act(async () =>
      resolve({ ok: true, arrayBuffer: async () => buffer }),
    );
    expect(host.querySelector(".local-import-info")?.textContent).toContain(
      "Import-prioritaire.xlsx",
    );
    expect(host.querySelector(".source-status")?.textContent).toContain(
      "Import enregistré",
    );
  });
  it("refuse un fichier de plus de 10 Mo sans toucher à la sauvegarde précédente", async () => {
    await saveStoredWorkbook(record);
    await render();
    const file = new File(
      [new ArrayBuffer(10 * 1024 * 1024 + 1)],
      "trop-gros.xlsx",
    );
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });
    await act(async () =>
      input.dispatchEvent(new Event("change", { bubbles: true })),
    );
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "dépasse 10 Mo",
    );
    expect((await readStoredWorkbook())?.name).toBe(record.name);
  });
});
