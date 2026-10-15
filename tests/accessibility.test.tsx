// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { parseWorkbook } from "../src/data";
vi.mock("../src/workbookStorage", () => ({
  readStoredWorkbook: async () => null,
  saveStoredWorkbook: async () => true,
  clearStoredWorkbook: async () => true,
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
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    const nodes = modal.querySelectorAll<HTMLElement>("button, a[href]");
    expect(document.activeElement).toBe(nodes[nodes.length - 1]);
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(document.activeElement).toBe(close);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it("synchronise le filtre catégorie et le catalogue, puis réinitialise", async () => {
    await render();
    const select = host.querySelector<HTMLSelectElement>(
      'select[aria-label="Catégorie (CSV)"]',
    )!;
    expect(select.options.length).toBeGreaterThan(10);
    await act(async () => {
      select.value = "Alimentation";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(select.value).toBe("Alimentation");
    expect(host.querySelector(".filter-foot")?.textContent).toContain("1 241");
    expect(
      Array.from(host.querySelectorAll(".category-cell")).every((td) =>
        td.textContent?.includes("Alimentation"),
      ),
    ).toBe(true);
    const chosen = host.querySelector(
      '.category-chips button[aria-pressed="true"]',
    );
    expect(chosen?.textContent).toContain("Alimentation");
    await click(host.querySelector(".filter-foot .text-button")!);
    expect(select.value).toBe("");
    expect(host.querySelector(".filter-foot")?.textContent).toContain("2 612");
  });
  it("distingue le type vide du produit absent et expose la nouvelle source CSV", async () => {
    await render();
    const select = host.querySelector<HTMLSelectElement>(
      'select[aria-label="Catégorie (CSV)"]',
    )!;
    await act(async () => {
      select.value = "Type non renseigné";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(host.querySelector(".filter-foot")?.textContent).toContain("102");
    expect(
      Array.from(host.querySelectorAll(".category-cell")).every((td) =>
        td.textContent?.includes("Type non renseigné"),
      ),
    ).toBe(true);
    await act(async () => {
      select.value = "Absent du CSV";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(host.querySelector(".filter-foot")?.textContent).toContain("548");
    await click(host.querySelector(".category-source-note button")!);
    expect(host.querySelector(".category-quality")?.textContent).toContain(
      "Ventestotalesparvariantedeproduit-2026-01-01-2026-10-14.csv",
    );
    expect(host.querySelector(".category-quality")?.textContent).toContain(
      "Type de produit",
    );
    expect(host.querySelector(".category-source-links a")).toBeNull();
  });
  it("expose le téléchargement du modèle Excel dans le menu gauche", async () => {
    await render();
    const link = host.querySelector<HTMLAnchorElement>("nav .sidebar-download");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("/MYMARKET_modele_import.xlsx");
    expect(link?.download).toBe("MYMARKET_modele_import.xlsx");
    expect(link?.getAttribute("aria-label")).toContain(
      "Télécharger le modèle Excel",
    );
  });
  it("ouvre un guide complet et conserve la catégorie lors du retour au tableau", async () => {
    await render();
    const select = host.querySelector<HTMLSelectElement>(
      'select[aria-label="Catégorie (CSV)"]',
    )!;
    await act(async () => {
      select.value = "Alimentation";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const guideButton = host.querySelector(
      'nav button[aria-label="Guide d’utilisation"]',
    )!;
    await click(guideButton);
    expect(guideButton.getAttribute("aria-current")).toBe("page");
    expect(host.querySelector(".breadcrumb")?.textContent).toContain(
      "Guide d’utilisation",
    );
    expect(host.querySelector(".guide-layout")).not.toBeNull();
    expect(host.querySelectorAll(".guide-content section")).toHaveLength(5);
    expect(host.querySelectorAll(".guide-faq details")).toHaveLength(9);
    expect(host.querySelector(".guide-layout")?.textContent).toContain("10 Mo");
    expect(host.querySelector(".guide-layout")?.textContent).toContain(
      "Type de produit",
    );
    const anchor = host.querySelector<HTMLAnchorElement>(
      ".guide-steps a[download]",
    )!;
    expect(anchor.getAttribute("href")).toBe("/MYMARKET_modele_import.xlsx");
    for (const a of host.querySelectorAll<HTMLAnchorElement>(".guide-toc a")) {
      expect(host.querySelector(a.getAttribute("href")!)).not.toBeNull();
    }
    await click(host.querySelector('nav button[aria-label="Vue d’ensemble"]')!);
    expect(
      host.querySelector<HTMLSelectElement>(
        'select[aria-label="Catégorie (CSV)"]',
      )!.value,
    ).toBe("Alimentation");
    expect(host.querySelector(".reading-summary")?.textContent).toContain(
      "1 241 références",
    );
  });
  it("ouvre l’import depuis le guide et permet de consulter le catalogue", async () => {
    await render();
    await click(
      host.querySelector('nav button[aria-label="Guide d’utilisation"]')!,
    );
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    const spy = vi.spyOn(input, "click").mockImplementation(() => {});
    const importButton = Array.from(
      host.querySelectorAll<HTMLButtonElement>(".guide-steps button"),
    ).find((b) => b.textContent?.includes("Importer mon classeur"))!;
    await click(importButton);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
    const catalogue = Array.from(
      host.querySelectorAll<HTMLButtonElement>(".guide-actions button"),
    ).find((b) => b.textContent?.includes("Explorer le catalogue"))!;
    await click(catalogue);
    expect(
      host
        .querySelector('nav button[aria-current="page"]')
        ?.getAttribute("aria-label"),
    ).toBe("Catalogue produits");
    expect(host.querySelector(".guide-layout")).toBeNull();
    expect(host.querySelector(".table-panel")).not.toBeNull();
  });
  it("laisse le guide accessible même lorsque le classeur source échoue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Source indisponible")),
    );
    await render();
    await click(
      host.querySelector('nav button[aria-label="Guide d’utilisation"]')!,
    );
    expect(host.querySelector(".guide-layout")).not.toBeNull();
    expect(host.querySelector(".guide-sources")?.textContent).toContain(
      "Aucun classeur chargé",
    );
    expect(host.querySelector(".guide-faq")?.textContent).toContain(
      "pas un historique mensuel",
    );
  });
  it("recalcule le résumé avec les filtres, expose l’aide et gère la sélection vide", async () => {
    await render();
    expect(host.querySelector(".reading-summary")?.textContent).toContain(
      "2 612 références",
    );
    expect(host.querySelector(".reading-summary")?.textContent).toContain(
      "44 059 unités",
    );
    expect(host.querySelector(".reading-summary")?.textContent).toContain(
      "64 437 unités",
    );
    const details = host.querySelector<HTMLDetailsElement>(".reading-details")!;
    expect(details.open).toBe(false);
    expect(details.querySelectorAll(".reading-definitions>div")).toHaveLength(
      4,
    );
    const search = host.querySelector<HTMLInputElement>(
      'input[aria-label="Rechercher un produit, SKU ou fournisseur"]',
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(search, "produit-impossible-qzx987");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(host.querySelector(".reading-summary")?.textContent).toContain(
      "Aucune référence",
    );
    expect(host.querySelector(".reading-summary")?.textContent).not.toContain(
      "2 612 références",
    );
    await click(host.querySelector(".reading-aid .text-button")!);
    expect(host.querySelector(".guide-layout")).not.toBeNull();
  });
  it("sélectionne plusieurs fournisseurs, recherche sans perte de choix et ferme avec Échap", async () => {
    await render();
    const trigger = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Choisir plusieurs fournisseurs"]',
    )!;
    expect(trigger.textContent).toContain("Tous les fournisseurs");
    await click(trigger);
    const query = host.querySelector<HTMLInputElement>(
      'input[aria-label="Rechercher un fournisseur"]',
    )!;
    expect(document.activeElement).toBe(query);
    const check = (name: string) =>
      Array.from(
        host.querySelectorAll<HTMLLabelElement>(".supplier-options label"),
      )
        .find((l) => l.textContent?.trim() === name)!
        .querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await click(check("Primeur"));
    await click(check("Valencia"));
    expect(check("Primeur").checked).toBe(true);
    expect(check("Valencia").checked).toBe(true);
    expect(trigger.textContent).toContain("2 fournisseurs");
    const data = parseWorkbook(buffer, "test");
    const count = data.products.filter((p) =>
      ["Primeur", "Valencia"].includes(p.supplier),
    ).length;
    expect(host.querySelector(".filter-foot")?.textContent).toContain(
      count.toLocaleString("fr-FR"),
    );
    expect(host.querySelector(".reading-summary")?.textContent).toContain(
      `${count.toLocaleString("fr-FR")} références`,
    );
    expect(
      Array.from(host.querySelectorAll(".supplier-cell")).every((el) =>
        ["Primeur", "Valencia"].includes(el.textContent!),
      ),
    ).toBe(true);
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(query, "Valencia");
      query.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(
      host.querySelectorAll('.supplier-options input[type="checkbox"]'),
    ).toHaveLength(1);
    expect(check("Valencia").checked).toBe(true);
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(query, "absent-fournisseur-zzz");
      query.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(host.querySelector(".supplier-no-results")).not.toBeNull();
    expect(trigger.textContent).toContain("2 fournisseurs");
    await act(async () =>
      query.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect(host.querySelector(".supplier-select-panel")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await click(
      host.querySelector(
        'button[aria-label="Retirer le fournisseur Valencia"]',
      )!,
    );
    expect(trigger.textContent).toContain("Primeur");
    expect(
      host.querySelector(".supplier-selection-bar")?.textContent,
    ).not.toContain("Valencia");
    await click(host.querySelector(".supplier-clear-all")!);
    expect(trigger.textContent).toContain("Tous les fournisseurs");
    expect(host.querySelector(".filter-foot")?.textContent).toContain("2 612");
  });
  it("préserve plusieurs fournisseurs en passant par le guide puis réinitialise tous les filtres", async () => {
    await render();
    const trigger = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Choisir plusieurs fournisseurs"]',
    )!;
    await click(trigger);
    const check = (name: string) =>
      Array.from(
        host.querySelectorAll<HTMLLabelElement>(".supplier-options label"),
      )
        .find((l) => l.textContent?.trim() === name)!
        .querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await click(check("Primeur"));
    await click(check("Valencia"));
    await click(
      host.querySelector<HTMLButtonElement>(".supplier-select-footer button")!,
    );
    expect(host.querySelector(".supplier-select-panel")).toBeNull();
    await click(
      host.querySelector('nav button[aria-label="Guide d’utilisation"]')!,
    );
    expect(host.querySelector(".guide-layout")?.textContent).toContain(
      "l’un OU l’autre fournisseur",
    );
    await click(host.querySelector('nav button[aria-label="Vue d’ensemble"]')!);
    expect(
      host.querySelector(".supplier-select-trigger")?.textContent,
    ).toContain("2 fournisseurs");
    await click(host.querySelector(".filter-foot .text-button")!);
    expect(
      host.querySelector(".supplier-select-trigger")?.textContent,
    ).toContain("Tous les fournisseurs");
    expect(host.querySelector(".supplier-selection-bar")).toBeNull();
  });
  it("ferme la liste au clic extérieur et permet tous les fournisseurs sans changer la catégorie", async () => {
    await render();
    const trigger = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Choisir plusieurs fournisseurs"]',
    )!;
    const category = host.querySelector<HTMLSelectElement>(
      'select[aria-label="Catégorie (CSV)"]',
    )!;
    await act(async () => {
      category.value = "Alimentation";
      category.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await click(trigger);
    const label = Array.from(
      host.querySelectorAll<HTMLLabelElement>(".supplier-options label"),
    ).find((l) => l.textContent?.trim() === "Valencia")!;
    await click(label.querySelector("input")!);
    await act(async () =>
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })),
    );
    expect(host.querySelector(".supplier-select-panel")).toBeNull();
    await click(trigger);
    await click(host.querySelector(".supplier-select-tools button")!);
    expect(category.value).toBe("Alimentation");
    expect(trigger.textContent).toContain("Tous les fournisseurs");
    expect(host.querySelector(".filter-foot")?.textContent).toContain("1 241");
    expect(
      host.querySelectorAll(".supplier-options input:checked"),
    ).toHaveLength(0);
  });
});
