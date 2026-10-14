// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
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
const b = readFileSync("public/MYMARKET_Tableau_de_bord.xlsx");
const buffer = Uint8Array.from(b).buffer;
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
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
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () => {
    root.render(<App />);
  });
}
async function click(el: Element) {
  await act(async () => {
    (el as HTMLElement).click();
  });
}
describe("Corrections d’accessibilité", () => {
  it("expose le chargement et le classeur prêt", async () => {
    let resolve!: (v: unknown) => void;
    vi.stubGlobal(
      "fetch",
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    await render();
    expect(host.querySelector(".source-status")?.textContent).toContain(
      "Lecture en cours",
    );
    await act(async () =>
      resolve({ ok: true, arrayBuffer: async () => buffer }),
    );
    expect(host.querySelector(".source-status")?.textContent).toContain(
      "Classeur chargé",
    );
  });
  it("signale une erreur source sans indicateur vert de succès", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Source indisponible")),
    );
    await render();
    expect(
      host.querySelector(".source-status")?.classList.contains("has-error"),
    ).toBe(true);
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
  });
  it("expose la sélection et la direction du tri", async () => {
    await render();
    const kpi = host.querySelector(".kpi-action")!;
    expect(kpi.getAttribute("aria-pressed")).toBe("false");
    await click(kpi);
    expect(kpi.getAttribute("aria-pressed")).toBe("true");
    const amount = host.querySelector('th[aria-sort="descending"]')!;
    expect(amount.textContent).toContain("Montant source");
    await click(amount.querySelector("button")!);
    expect(amount.getAttribute("aria-sort")).toBe("ascending");
    expect(amount.querySelector(".lucide-arrow-up")).not.toBeNull();
  });
  it("enferme le focus dans la fiche et le restitue à la référence", async () => {
    await render();
    const trigger = host.querySelector<HTMLButtonElement>(".product-link")!;
    trigger.focus();
    await click(trigger);
    const modal = host.querySelector<HTMLElement>('[role="dialog"]')!;
    const close = modal.querySelector<HTMLButtonElement>(".modal-close")!;
    expect(document.activeElement).toBe(close);
    expect((host.querySelector(".main-shell") as HTMLElement).inert).toBe(true);
    const tab = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
