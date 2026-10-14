#!/usr/bin/env python3
"""Crée l'index des catégories depuis le rapport CSV fourni; les colonnes de ventes ne sont jamais exportées."""
from __future__ import annotations
import argparse, csv, json, re, unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def normalized_title(value: str) -> str:
    text = unicodedata.normalize("NFKD", value).casefold()
    text = "".join(c for c in text if not unicodedata.category(c).startswith("M"))
    return re.sub(r"[^a-z0-9]+", " ", text).strip()

def read_rows(path: Path):
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        sample = f.read(8192); f.seek(0)
        try: dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        except csv.Error: dialect = csv.excel
        reader = csv.DictReader(f, dialect=dialect)
        required = {"Mois", "Titre de produit", "SKU de la variante de produit", "Type de produit"}
        absent = required.difference(reader.fieldnames or [])
        if absent: raise ValueError("Colonnes obligatoires absentes : " + ", ".join(sorted(absent)))
        rows = list(reader)
    return rows

def build(path: Path) -> dict:
    rows = read_rows(path)
    # Canonicalise uniquement les différences de casse/espaces; aucun type n'est deviné.
    label_counts: dict[str, Counter[str]] = defaultdict(Counter)
    for row in rows:
        label = (row.get("Type de produit") or "").strip()
        if label: label_counts[label.casefold()][label] += 1
    display = {key: counts.most_common(1)[0][0] for key, counts in label_counts.items()}

    records = {}
    product_type_rows = 0
    months = []
    for index, row in enumerate(rows):
        sku = (row.get("SKU de la variante de produit") or "").strip()
        title = (row.get("Titre de produit") or "").strip()
        month = (row.get("Mois") or "").strip()
        label = (row.get("Type de produit") or "").strip()
        if month: months.append(month)
        if label: product_type_rows += 1
        if not sku and not title: continue
        key = "sku:" + sku if sku else "title:" + normalized_title(title)
        rec = records.setdefault(key, {"sku": sku, "titleCounts": Counter(), "lastType": None, "types": set()})
        if title: rec["titleCounts"][title] += 1
        if label:
            canonical = display[label.casefold()]
            rec["types"].add(canonical)
            candidate = (month, index, canonical)
            if rec["lastType"] is None or candidate[:2] > rec["lastType"][:2]: rec["lastType"] = candidate

    products = []
    category_counts = Counter()
    conflicts = 0
    for rec in records.values():
        title = rec["titleCounts"].most_common(1)[0][0] if rec["titleCounts"] else ""
        label = rec["lastType"][2] if rec["lastType"] else ""
        # Le rapport est mensuel : en cas de reclassification, retenir la dernière valeur renseignée.
        if len(rec["types"]) > 1: conflicts += 1
        if label: category_counts[label] += 1
        products.append({"sku": rec["sku"], "title": title, "categories": [label] if label else []})
    products.sort(key=lambda p: (p["sku"].casefold(), normalized_title(p["title"])))
    metadata = {
        "fileName": path.name,
        "periodStart": min(months) if months else "",
        "periodEnd": max(months) if months else "",
        "reportRows": len(rows),
        "uniqueProducts": len(products),
        "productsWithType": sum(bool(p["categories"]) for p in products),
        "productsWithoutType": sum(not p["categories"] for p in products),
        "typeRows": product_type_rows,
        "conflictingProducts": conflicts,
        "sourceField": "Type de produit",
        "skuField": "SKU de la variante de produit",
        "titleField": "Titre de produit",
        "categoryLabels": [{"name": name, "uniqueProducts": count} for name, count in sorted(category_counts.items(), key=lambda x: (-x[1], x[0].casefold()))],
    }
    return {"source": metadata, "products": products}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_file", type=Path, help="Rapport de ventes CSV à utiliser comme source des catégories")
    parser.add_argument("--output", type=Path, default=ROOT / "src" / "category-source.json")
    args = parser.parse_args()
    result = build(args.csv_file)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"source": result["source"], "output": str(args.output), "bytes": args.output.stat().st_size}, ensure_ascii=False, indent=2))
