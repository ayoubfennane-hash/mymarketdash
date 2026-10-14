import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { toggleSupplierSelection } from "./analytics";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
export default function SupplierSelect({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const matches = useMemo(
    () =>
      options.filter((name) =>
        normalize(name).includes(normalize(query.trim())),
      ),
    [options, query],
  );
  const text =
    selected.length === 0
      ? "Tous les fournisseurs"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} fournisseurs`;
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    setOpen(false);
    setQuery("");
  }, [options]);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div
      className="supplier-filter"
      ref={root}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget as Node)
        )
          setOpen(false);
      }}
    >
      <span className="supplier-filter-label" id={`${id}-label`}>
        Fournisseurs · choix multiples
      </span>
      <button
        ref={trigger}
        className={`supplier-select-trigger ${selected.length ? "has-selection" : ""}`}
        aria-label="Choisir plusieurs fournisseurs"
        aria-describedby={`${id}-label`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={`${id}-panel`}
        type="button"
        onClick={() => {
          setQuery("");
          setOpen((v) => !v);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setQuery("");
            setOpen(true);
          }
        }}
        title={selected.length ? selected.join(", ") : "Tous les fournisseurs"}
      >
        <span>{text}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={`${id}-panel`}
          className="supplier-select-panel"
          role="dialog"
          aria-label="Choisir des fournisseurs"
        >
          <div className="supplier-select-heading">
            <strong>Sélection des fournisseurs</strong>
            <button
              type="button"
              className="supplier-menu-close"
              onClick={close}
              aria-label="Fermer la sélection des fournisseurs"
            >
              <X size={16} />
            </button>
          </div>
          <label className="supplier-option-search">
            <Search size={15} aria-hidden="true" />
            <input
              ref={input}
              aria-label="Rechercher un fournisseur"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un fournisseur…"
            />
          </label>
          <div className="supplier-select-tools">
            <button
              type="button"
              onClick={() => {
                onChange([]);
                setQuery("");
              }}
              aria-pressed={selected.length === 0}
            >
              <Check size={13} />
              Tous les fournisseurs
            </button>
            <span aria-live="polite">
              {selected.length
                ? `${selected.length} sélectionné${selected.length > 1 ? "s" : ""}`
                : "Aucun filtre fournisseur"}
            </span>
          </div>
          <fieldset className="supplier-options">
            <legend className="supplier-sr-only">
              Fournisseurs à inclure dans l’analyse
            </legend>
            {matches.length ? (
              matches.map((name) => (
                <label
                  key={name}
                  className={selected.includes(name) ? "is-checked" : ""}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(name)}
                    onChange={() =>
                      onChange(toggleSupplierSelection(selected, name))
                    }
                  />
                  <span>{name}</span>
                </label>
              ))
            ) : (
              <p className="supplier-no-results">
                Aucun fournisseur ne correspond à cette recherche. Vos choix
                sont conservés.
              </p>
            )}
          </fieldset>
          <div className="supplier-select-footer">
            <p>
              Les fournisseurs cochés sont réunis dans la même sélection. Sans
              case cochée : tous les fournisseurs.
            </p>
            <button type="button" className="btn primary" onClick={close}>
              Terminer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
