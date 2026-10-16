// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  read: vi.fn(),
  save: vi.fn(),
  logout: vi.fn(),
  localRead: vi.fn(),
  localSave: vi.fn(),
  localClear: vi.fn(),
}));
vi.mock("../src/cloudClient", () => ({
  getCloudAccount: mocks.account,
  readCloudWorkbook: mocks.read,
  saveCloudWorkbook: mocks.save,
  logoutCloud: mocks.logout,
  beginManusLogin: async () => {},
  downloadCloudWorkbook: async () => {},
}));
vi.mock("../src/workbookStorage", () => ({
  readStoredWorkbook: mocks.localRead,
  saveStoredWorkbook: mocks.localSave,
  clearStoredWorkbook: mocks.localClear,
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
const meta = {
  name: "Compte-prive.xlsx",
  size: buffer.byteLength,
  sha256: "a".repeat(64),
  savedAt: "2026-10-16T10:00:00.000Z",
};
const session = {
  user: { name: "Compte de test" },
  csrfToken: "token-test-only",
};
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.account.mockResolvedValue(session);
  mocks.read.mockResolvedValue({ ...meta, buffer });
  mocks.save.mockResolvedValue(meta);
  mocks.localRead.mockResolvedValue(null);
  mocks.localSave.mockResolvedValue(true);
  mocks.localClear.mockResolvedValue(true);
  mocks.logout.mockResolvedValue(undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => buffer }),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () => root.render(<App />));
}
async function click(label: string) {
  const b = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent?.includes(label),
  )!;
  expect(b).toBeDefined();
  await act(async () => b.click());
}
async function upload() {
  const f = new File([buffer], "Nouveau-cloud.xlsx");
  Object.defineProperty(f, "arrayBuffer", { value: async () => buffer });
  const input = host.querySelector<HTMLInputElement>("input[type=file]")!;
  Object.defineProperty(input, "files", { value: [f], configurable: true });
  await act(async () =>
    input.dispatchEvent(new Event("change", { bubbles: true })),
  );
}
describe("Tableau de bord privé cloud", () => {
  it("restaure le fichier du compte avant toute lecture locale", async () => {
    await render();
    expect(mocks.localRead).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(host.querySelector(".source-status")?.textContent).toContain(
      "Import cloud restauré",
    );
    expect(host.querySelector(".account-panel")?.textContent).toContain(
      meta.name,
    );
    expect(host.querySelector(".filter-foot")?.textContent).toContain("2 612");
  });
  it("enregistre dans le compte connecté sans placer le fichier dans IndexedDB", async () => {
    await render();
    await upload();
    expect(mocks.save).toHaveBeenCalledWith(
      buffer,
      "Nouveau-cloud.xlsx",
      session,
      meta,
    );
    expect(mocks.localSave).not.toHaveBeenCalled();
    expect(host.querySelector(".source-status")?.textContent).toContain(
      "Import enregistré dans votre compte",
    );
  });
  it("conserve la source précédente si le serveur refuse un import cloud", async () => {
    await render();
    mocks.save.mockRejectedValue(new Error("Conflit avec un autre appareil"));
    await upload();
    expect(host.querySelector("[role=alert]")?.textContent).toContain(
      "Conflit avec un autre appareil",
    );
    expect(host.querySelector(".account-panel")?.textContent).toContain(
      meta.name,
    );
    expect(host.querySelector(".filter-foot")?.textContent).toContain("2 612");
    expect(mocks.localSave).not.toHaveBeenCalled();
  });
  it("n’envoie pas un ancien import local sans action explicite", async () => {
    mocks.read.mockResolvedValue(null);
    mocks.localRead.mockResolvedValue({
      name: "Local-preexistant.xlsx",
      savedAt: meta.savedAt,
      buffer,
    });
    await render();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(host.querySelector(".source-status")?.textContent).toContain(
      "Import restauré",
    );
    await click("Enregistrer cet import local dans mon compte");
    expect(mocks.save).toHaveBeenCalledWith(
      buffer,
      "Local-preexistant.xlsx",
      session,
      null,
    );
    expect(host.querySelector(".source-status")?.textContent).toContain(
      "Import enregistré dans votre compte",
    );
  });
  it("garde le mode invité et propose une connexion en navigation principale", async () => {
    mocks.account.mockResolvedValue(null);
    await render();
    expect(mocks.read).not.toHaveBeenCalled();
    const login = host.querySelector<HTMLAnchorElement>(".account-actions a")!;
    expect(login.target).toBe("_top");
    expect(login.getAttribute("href")).toContain("/api/auth/login?origin=");
    await upload();
    expect(mocks.localSave).toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("le retour au fichier initial ne supprime pas la sauvegarde cloud", async () => {
    await render();
    await click("Voir le fichier initial");
    await click("Confirmer l’affichage");
    expect(mocks.localClear).not.toHaveBeenCalled();
    expect(host.querySelector(".source-status")?.textContent).toContain(
      "Classeur chargé",
    );
    expect(host.querySelector(".account-panel")?.textContent).toContain(
      meta.name,
    );
  });
  it("la déconnexion ne laisse pas le classeur cloud affiché en mode invité", async () => {
    await render();
    mocks.account.mockResolvedValue(null);
    await click("Déconnexion");
    expect(mocks.logout).toHaveBeenCalledWith(session);
    expect(host.querySelector(".account-panel")?.textContent).not.toContain(
      meta.name,
    );
    expect(host.querySelector(".source-status")?.textContent).toContain(
      "Classeur chargé",
    );
    expect(mocks.localClear).not.toHaveBeenCalled();
  });
  it("garde le classeur cloud précédent sur une erreur de restauration ou de session", async () => {
    await render();
    mocks.account.mockRejectedValue(new Error("réseau"));
    await click("Restaurer mon fichier cloud");
    expect(host.querySelector(".account-panel")?.textContent).toContain(
      meta.name,
    );
    expect(host.querySelector(".source-status")?.textContent).toContain(
      "Import cloud restauré",
    );
    expect(host.querySelector("[role=alert]")?.textContent).toContain(
      "indisponible",
    );
  });
});
