import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Box,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileSpreadsheet,
  LayoutDashboard,
  LoaderCircle,
  Package,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { parseWorkbook, type Dataset } from "./data";
import { useDialogFocus } from "./useDialogFocus";
import CategoryPanel from "./CategoryPanel";
import {
  CATEGORY_SOURCE,
  categoryExplanation,
  isAssignedCategory,
  MISSING_TYPE,
  ABSENT_FROM_CSV,
  AMBIGUOUS_TYPE,
} from "./categories";
import {
  compactNumber,
  formatNumber as fmt,
  groupSuppliers,
  makeTrend,
  selectProducts,
  statusDistribution,
  summarize,
  type ProductView,
} from "./analytics";

const COLORS: Record<string, string> = {
  "En stock": "#267c68",
  "Presque rupture": "#e6ad46",
  Rupture: "#d77566",
  "Non renseigné": "#94a3b8",
};
const allMonths = (d: Dataset) => d.months.length - 1;
const badgeClass = (s: string) =>
  s === "En stock"
    ? "good"
    : s === "Rupture"
      ? "bad"
      : s === "Presque rupture"
        ? "warn"
        : "neutral";

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"overview" | "catalogue" | "quality">(
    "overview",
  );
  const [search, setSearch] = useState("");
  const [supplier, setSupplier] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(9);
  const [metric, setMetric] = useState<"amount" | "units">("amount");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{
    key: "periodAmount" | "periodUnits" | "stock" | "title" | "category";
    desc: boolean;
  }>({ key: "periodAmount", desc: true });
  const [selected, setSelected] = useState<ProductView | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  const readVersion = useRef(0);
  const modalRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  useDialogFocus(Boolean(selected), modalRef, triggerRef);
  function openProduct(product: ProductView) {
    triggerRef.current = document.activeElement as HTMLElement;
    setSelected(product);
  }

  function applyData(next: Dataset) {
    setDataset(next);
    setSearch("");
    setSupplier("");
    setCategory("");
    setStatus("");
    setFrom(0);
    setTo(allMonths(next));
    setPage(0);
    setSelected(null);
    setError("");
  }
  async function loadSource() {
    const version = ++readVersion.current;
    setLoading(true);
    setImporting(false);
    setError("");
    try {
      const response = await fetch("/MYMARKET_Tableau_de_bord.xlsx");
      if (!response.ok)
        throw new Error(
          "Le fichier source est indisponible. Réessayez ou importez le classeur.",
        );
      const next = parseWorkbook(
        await response.arrayBuffer(),
        "MYMARKET_Tableau_de_bord.xlsx",
      );
      if (version === readVersion.current) applyData(next);
    } catch (e) {
      if (version === readVersion.current)
        setError(
          e instanceof Error ? e.message : "Lecture du classeur impossible.",
        );
    } finally {
      if (version === readVersion.current) setLoading(false);
    }
  }
  useEffect(() => {
    void loadSource();
  }, []);
  useEffect(() => {
    setPage(0);
  }, [search, supplier, category, status, from, to, dataset]);
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);
  async function importFile(file?: File) {
    if (!file) return;
    const version = ++readVersion.current;
    setImporting(true);
    setLoading(false);
    setError("");
    try {
      if (!/\.xlsx?$/i.test(file.name))
        throw new Error("Sélectionnez un classeur Excel .xlsx ou .xls.");
      if (file.size > 10 * 1024 * 1024)
        throw new Error(
          "Le fichier dépasse 10 Mo. Utilisez un classeur plus léger.",
        );
      const next = parseWorkbook(await file.arrayBuffer(), file.name);
      if (version === readVersion.current) applyData(next);
    } catch (e) {
      if (version === readVersion.current)
        setError(
          e instanceof Error ? e.message : "Le fichier ne peut pas être lu.",
        );
    } finally {
      if (version === readVersion.current) {
        setImporting(false);
        if (upload.current) upload.current.value = "";
      }
    }
  }
  const filtered = useMemo(
    () =>
      dataset
        ? selectProducts(dataset, {
            search,
            supplier,
            category,
            status,
            from,
            to,
          })
        : [],
    [dataset, search, supplier, category, status, from, to],
  );
  const stats = useMemo(() => summarize(filtered), [filtered]);
  const trend = useMemo(
    () => (dataset ? makeTrend(dataset, filtered, from, to) : []),
    [dataset, filtered, from, to],
  );
  const suppliers = useMemo(
    () =>
      dataset
        ? [...new Set(dataset.products.map((p) => p.supplier))].sort((a, b) =>
            a.localeCompare(b, "fr"),
          )
        : [],
    [dataset],
  );
  const categories = useMemo(
    () =>
      dataset
        ? [
            ...new Set([
              ...CATEGORY_SOURCE.categoryLabels.map((c) => c.name),
              ...dataset.products.flatMap((p) => p.categories),
            ]),
          ].sort((a, b) => a.localeCompare(b, "fr"))
        : [],
    [dataset],
  );
  const matchedCategories =
    dataset?.products.filter((p) => isAssignedCategory(p.categoryMethod))
      .length || 0;
  const missingTypeCount =
    dataset?.products.filter((p) => p.categoryMethod === "missing").length || 0;
  const absentCsvCount =
    dataset?.products.filter((p) => p.categoryMethod === "unmatched").length ||
    0;
  const statuses = useMemo(
    () => (dataset ? [...new Set(dataset.products.map((p) => p.status))] : []),
    [dataset],
  );
  const ranking = useMemo(
    () => groupSuppliers(filtered, metric),
    [filtered, metric],
  );
  const distribution = useMemo(() => statusDistribution(filtered), [filtered]);
  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const av = a[sort.key],
          bv = b[sort.key];
        const result =
          typeof av === "string"
            ? av.localeCompare(String(bv), "fr")
            : Number(av) - Number(bv);
        return sort.desc ? -result : result;
      }),
    [filtered, sort],
  );
  const pageCount = Math.max(1, Math.ceil(sorted.length / 12));
  const currentPage = Math.min(page, pageCount - 1);
  const tableRows = sorted.slice(currentPage * 12, currentPage * 12 + 12);
  const hasFilters =
    !!search ||
    !!supplier ||
    !!category ||
    !!status ||
    from !== 0 ||
    (dataset && to !== allMonths(dataset));
  const metricLabel = metric === "amount" ? "Montant source" : "Unités";
  function reset() {
    setSearch("");
    setSupplier("");
    setCategory("");
    setStatus("");
    setFrom(0);
    if (dataset) setTo(allMonths(dataset));
  }
  function toggleStatus(next: string) {
    setStatus((s) => (s === next ? "" : next));
  }
  function sortBy(key: typeof sort.key) {
    setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== "title" }));
  }
  function exportCSV() {
    const escape = (s: unknown) => `"${String(s ?? "").replaceAll('"', '""')}"`;
    const lines = [
      [
        "Produit",
        "SKU",
        "Fournisseur",
        "Catégorie (Type de produit du CSV)",
        "Méthode de correspondance",
        "Source des catégories",
        "Stock actuel",
        "État",
        "Unités période",
        "Montant période",
      ],
      ...sorted.map((p) => [
        p.title,
        p.sku,
        p.supplier,
        p.category,
        categoryExplanation(p.categoryMethod),
        CATEGORY_SOURCE.fileName,
        p.stock,
        p.status,
        p.periodUnits,
        p.periodAmount.toFixed(2),
      ]),
    ];
    const content =
      "\uFEFF" + lines.map((r) => r.map(escape).join(";")).join("\r\n");
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "MYMARKET_selection.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="MYMARKET, accueil">
          <span className="brand-symbol">
            <i />
            <i />
            <i />
          </span>
          <span>
            MYMARKET<span className="brand-sub">MARKET INTELLIGENCE</span>
          </span>
        </a>
        <div className="workspace-label">ESPACE D’ANALYSE</div>
        <nav aria-label="Navigation principale">
          <button
            className={view === "overview" ? "active" : ""}
            onClick={() => setView("overview")}
          >
            <LayoutDashboard size={18} />
            Vue d’ensemble
            <span className="nav-dot" />
          </button>
          <button
            className={view === "catalogue" ? "active" : ""}
            onClick={() => setView("catalogue")}
          >
            <Package size={18} />
            Catalogue produits
          </button>
          <button
            className={view === "quality" ? "active" : ""}
            onClick={() => setView("quality")}
          >
            <ShieldCheck size={18} />
            Qualité des données
          </button>
          <a
            className="sidebar-download"
            href="/MYMARKET_modele_import.xlsx"
            download="MYMARKET_modele_import.xlsx"
            aria-label="Télécharger le modèle Excel vierge"
            title="Télécharger le modèle Excel"
          >
            <ArrowDownToLine size={18} aria-hidden="true" />
            <span>Modèle Excel</span>
          </a>
        </nav>
        <div className="sidebar-note">
          <span className="tiny-label">VOTRE SOURCE</span>
          <FileSpreadsheet size={24} />
          <strong>
            Un classeur.
            <br />
            Une vue plus claire.
          </strong>
          <p>
            Les données restent dans cette session du navigateur lors d’un
            nouvel import.
          </p>
          <button onClick={() => upload.current?.click()}>
            Changer de fichier <ArrowRight size={14} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <span className="avatar">MM</span>
          <div>
            <strong>MyMarket Casablanca</strong>
            <span>Analyse du magasin</span>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Analyse du magasin <ChevronRight size={14} />
            <strong>
              {view === "overview"
                ? "Vue d’ensemble"
                : view === "catalogue"
                  ? "Catalogue"
                  : "Qualité des données"}
            </strong>
          </div>
          <span
            className={
              "source-status " +
              (loading || importing
                ? "pending"
                : error || !dataset
                  ? "has-error"
                  : "")
            }
            role="status"
            aria-live="polite"
          >
            <span />
            {loading
              ? "Lecture en cours…"
              : importing
                ? "Import en cours…"
                : error
                  ? dataset
                    ? "Classeur précédent conservé"
                    : "Source indisponible"
                  : dataset
                    ? "Classeur chargé"
                    : "Aucune source"}
          </span>
        </header>
        <main>
          <section className="page-heading">
            <div>
              <div className="eyebrow">PILOTAGE & PERFORMANCE</div>
              <h1>
                {view === "overview" ? (
                  <>
                    Votre marché, <em>en perspective.</em>
                  </>
                ) : view === "catalogue" ? (
                  <>
                    Le détail fait <em>la différence.</em>
                  </>
                ) : (
                  <>
                    Des données, <em>en toute clarté.</em>
                  </>
                )}
              </h1>
              <p>
                {view === "overview"
                  ? "Explorez les mouvements, les fournisseurs et la disponibilité de votre catalogue."
                  : view === "catalogue"
                    ? "Retrouvez chaque référence et les valeurs derrière les graphiques."
                    : "Comprenez la source et les règles de calcul avant de décider."}
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="btn"
                onClick={() => upload.current?.click()}
                disabled={importing}
              >
                <Upload size={16} />
                {importing ? "Lecture…" : "Importer Excel"}
              </button>
              <button
                className="btn primary"
                onClick={exportCSV}
                disabled={!dataset || !filtered.length}
              >
                <ArrowDownToLine size={16} />
                Exporter la sélection
              </button>
            </div>
          </section>
          <input
            ref={upload}
            type="file"
            accept=".xlsx,.xls"
            hidden
            onChange={(e) => void importFile(e.target.files?.[0])}
          />
          {error && (
            <div role="alert" className="error-banner">
              <CircleHelp size={18} />
              <span>
                {error}
                {dataset && " Le jeu de données précédent est conservé."}
              </span>
              <button onClick={() => setError("")} aria-label="Fermer l’erreur">
                <X size={16} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-state" role="status">
              <LoaderCircle className="spin" size={30} />
              <h2>Lecture de votre classeur</h2>
              <p>
                Préparation des séries mensuelles et des références produits…
              </p>
            </div>
          ) : !dataset ? (
            <div className="empty-state">
              <FileSpreadsheet size={36} />
              <h2>Le classeur n’a pas pu être chargé</h2>
              <p>Réessayez ou importez un fichier Excel au même format.</p>
              <button className="btn primary" onClick={() => void loadSource()}>
                Réessayer
              </button>
            </div>
          ) : (
            <>
              <section
                className="filters-panel"
                aria-label="Filtres du tableau de bord"
              >
                <div className="filters-intro">
                  <SlidersHorizontal size={17} />
                  <strong>Affiner l’analyse</strong>
                </div>
                <div className="filter-grid">
                  <label className="search-field">
                    <Search size={16} />
                    <input
                      aria-label="Rechercher un produit, SKU ou fournisseur"
                      placeholder="Produit, SKU, fournisseur…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <label>
                    <span>Catégorie (CSV)</span>
                    <select
                      aria-label="Catégorie (CSV)"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="">Toutes les catégories</option>
                      {categories.map((name) => (
                        <option key={name}>{name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Fournisseur</span>
                    <select
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                    >
                      <option value="">Tous les fournisseurs</option>
                      {suppliers.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>État du stock</span>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="">Tous les états</option>
                      {statuses.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Du mois</span>
                    <select
                      value={from}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setFrom(n);
                        if (n > to) setTo(n);
                      }}
                    >
                      {dataset.months.map((m, i) => (
                        <option value={i} key={m.date}>
                          {m.long}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Au mois</span>
                    <select
                      value={to}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setTo(n);
                        if (n < from) setFrom(n);
                      }}
                    >
                      {dataset.months.map((m, i) => (
                        <option value={i} key={m.date}>
                          {m.long}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="filter-foot">
                  <span>
                    <strong>{fmt(filtered.length)}</strong> /{" "}
                    {fmt(dataset.products.length)} références ·{" "}
                    {dataset.months[from].long} – {dataset.months[to].long}
                  </span>
                  <button
                    className="text-button"
                    disabled={!hasFilters}
                    onClick={reset}
                  >
                    Réinitialiser les filtres <X size={13} />
                  </button>
                </div>
              </section>

              <div className="category-source-note">
                <ShieldCheck size={14} />
                <span>
                  <strong>
                    Catégories : « {CATEGORY_SOURCE.sourceField} » du CSV
                  </strong>{" "}
                  · {fmt(matchedCategories)} références catégorisées ·{" "}
                  {fmt(missingTypeCount)} types non renseignés ·{" "}
                  {fmt(absentCsvCount)} absentes du CSV.
                </span>
                <button onClick={() => setView("quality")}>
                  Voir la méthode <ArrowRight size={12} />
                </button>
              </div>

              {view !== "quality" && (
                <section
                  className="kpi-strip"
                  aria-label="Indicateurs de la sélection"
                >
                  <div className="kpi">
                    <span className="kpi-label">
                      Montant cumulé <Activity size={16} />
                    </span>
                    <strong>
                      {fmt(stats.amount, 2)}
                      <small>source</small>
                    </strong>
                    <p>Période sélectionnée · devise non précisée</p>
                  </div>
                  <div className="kpi">
                    <span className="kpi-label">
                      Quantités cumulées <Box size={16} />
                    </span>
                    <strong>
                      {fmt(stats.units)}
                      <small>unités</small>
                    </strong>
                    <p>Somme des mouvements mensuels</p>
                  </div>
                  <div className="kpi">
                    <span className="kpi-label">
                      Stock disponible <Package size={16} />
                    </span>
                    <strong>
                      {fmt(stats.stock)}
                      <small>unités</small>
                    </strong>
                    <p>Instantané source · non historique</p>
                  </div>
                  <button
                    className={
                      "kpi kpi-action " +
                      (status === "Rupture" ? "selected" : "")
                    }
                    aria-pressed={status === "Rupture"}
                    onClick={() => toggleStatus("Rupture")}
                  >
                    <span className="kpi-label">
                      Références en rupture{" "}
                      <span className="status-dot bad-dot" />
                    </span>
                    <strong>
                      {fmt(stats.out)}
                      <small>références</small>
                    </strong>
                    <p>
                      {stats.count
                        ? fmt((stats.out / stats.count) * 100, 1)
                        : "0"}{" "}
                      % de la sélection <ArrowRight size={13} />
                    </p>
                  </button>
                </section>
              )}

              {view === "overview" && (
                <>
                  <div className="section-label">
                    <h2>Les tendances qui comptent</h2>
                    <span>Une lecture reliée à vos filtres</span>
                  </div>
                  <section className="charts-main">
                    <article className="panel trend-panel">
                      <div className="panel-heading">
                        <div>
                          <span className="tiny-label">
                            ÉVOLUTION MENSUELLE
                          </span>
                          <h3>
                            {metric === "amount"
                              ? "Le rythme de vos montants"
                              : "Le rythme des quantités"}
                          </h3>
                        </div>
                        <div
                          className="segmented"
                          aria-label="Mesure du graphique"
                        >
                          <button
                            className={metric === "amount" ? "active" : ""}
                            aria-pressed={metric === "amount"}
                            onClick={() => setMetric("amount")}
                          >
                            Montants
                          </button>
                          <button
                            className={metric === "units" ? "active" : ""}
                            aria-pressed={metric === "units"}
                            onClick={() => setMetric("units")}
                          >
                            Unités
                          </button>
                        </div>
                      </div>
                      <div className="chart-area">
                        {filtered.length ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={trend}
                              margin={{
                                top: 16,
                                right: 18,
                                left: 0,
                                bottom: 0,
                              }}
                            >
                              <defs>
                                <linearGradient
                                  id="trendFill"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="0%"
                                    stopColor="#267c68"
                                    stopOpacity={0.24}
                                  />
                                  <stop
                                    offset="100%"
                                    stopColor="#267c68"
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                              </defs>
                              <CartesianGrid
                                vertical={false}
                                stroke="#e9eeeb"
                                strokeDasharray="3 4"
                              />
                              <XAxis
                                dataKey="month"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12, fill: "#7b8983" }}
                                dy={10}
                              />
                              <YAxis
                                tickFormatter={compactNumber}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 11, fill: "#7b8983" }}
                                width={55}
                              />
                              <Tooltip
                                formatter={(v) => [
                                  fmt(Number(v), metric === "amount" ? 2 : 0),
                                  metricLabel,
                                ]}
                                labelFormatter={(_, payload) =>
                                  payload[0]?.payload?.long || ""
                                }
                                contentStyle={{
                                  border: "1px solid #e2e9e5",
                                  borderRadius: 12,
                                  fontSize: 12,
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey={metric}
                                stroke="#267c68"
                                strokeWidth={3}
                                fill="url(#trendFill)"
                                dot={
                                  trend.length === 1
                                    ? { r: 5, fill: "#267c68" }
                                    : false
                                }
                                activeDot={{
                                  r: 6,
                                  stroke: "#fff",
                                  strokeWidth: 3,
                                }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <ChartEmpty />
                        )}
                      </div>
                      <div className="chart-caption">
                        <span className="legend-line" />
                        {metricLabel} de la sélection
                        <span className="caption-note">
                          Survolez un point pour voir le détail
                        </span>
                      </div>
                    </article>
                    <article className="panel stock-panel">
                      <div className="panel-heading">
                        <div>
                          <span className="tiny-label">DISPONIBILITÉ</span>
                          <h3>La santé du catalogue</h3>
                        </div>
                        <span
                          className="icon-muted"
                          title="Les états sont ceux du classeur source."
                        >
                          <CircleHelp size={17} />
                        </span>
                      </div>
                      <div className="donut-wrap">
                        {filtered.length ? (
                          <>
                            <ResponsiveContainer width="100%" height={210}>
                              <PieChart>
                                <Pie
                                  data={distribution}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={68}
                                  outerRadius={88}
                                  paddingAngle={3}
                                  stroke="none"
                                  onClick={(entry) => {
                                    const d = entry as unknown as {
                                      name: string;
                                    };
                                    toggleStatus(d.name);
                                  }}
                                  className="clickable-chart"
                                >
                                  {distribution.map((s) => (
                                    <Cell
                                      key={s.name}
                                      fill={COLORS[s.name] || "#94a3b8"}
                                    />
                                  ))}
                                </Pie>
                                <Tooltip
                                  formatter={(v) => [
                                    fmt(Number(v)),
                                    "Références",
                                  ]}
                                  contentStyle={{
                                    borderRadius: 12,
                                    fontSize: 12,
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="donut-center">
                              <strong>{fmt(stats.count)}</strong>
                              <span>références</span>
                            </div>
                          </>
                        ) : (
                          <ChartEmpty />
                        )}
                      </div>
                      <div className="status-legend">
                        {distribution.map((d) => (
                          <button
                            key={d.name}
                            className={status === d.name ? "chosen" : ""}
                            aria-pressed={status === d.name}
                            onClick={() => toggleStatus(d.name)}
                          >
                            <i
                              style={{
                                background: COLORS[d.name] || "#94a3b8",
                              }}
                            />
                            <span>{d.name}</span>
                            <strong>{fmt(d.value)}</strong>
                            <small>
                              {fmt((d.value / stats.count) * 100, 1)} %
                            </small>
                          </button>
                        ))}
                      </div>
                      <p className="panel-hint">
                        Cliquez sur un état pour filtrer le tableau de bord.
                      </p>
                    </article>
                  </section>
                  <CategoryPanel
                    products={filtered}
                    category={category}
                    onSelect={(name) =>
                      setCategory(category === name ? "" : name)
                    }
                  />
                  <section className="panel ranking-panel">
                    <div className="panel-heading">
                      <div>
                        <span className="tiny-label">
                          CONTRIBUTION À LA PÉRIODE
                        </span>
                        <h3>Les fournisseurs en tête</h3>
                      </div>
                      <span className="subtle-pill">
                        Top 7 · {metricLabel.toLowerCase()}
                      </span>
                    </div>
                    <div className="supplier-chart">
                      {ranking.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={ranking}
                            layout="vertical"
                            margin={{ top: 0, right: 36, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid
                              horizontal={false}
                              stroke="#edf1ee"
                            />
                            <XAxis
                              type="number"
                              tickFormatter={compactNumber}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 11, fill: "#7b8983" }}
                            />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={145}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 12, fill: "#40584e" }}
                            />
                            <Tooltip
                              formatter={(v) => [
                                fmt(Number(v), metric === "amount" ? 2 : 0),
                                metricLabel,
                              ]}
                              cursor={{ fill: "#f1f6f3" }}
                              contentStyle={{ borderRadius: 12, fontSize: 12 }}
                            />
                            <Bar
                              dataKey="value"
                              fill="#267c68"
                              barSize={14}
                              radius={[0, 5, 5, 0]}
                              onClick={(entry) => {
                                const d = entry as unknown as {
                                  name?: string;
                                  payload?: { name: string };
                                };
                                const n = d.name || d.payload?.name;
                                if (n) setSupplier(supplier === n ? "" : n);
                              }}
                            >
                              {ranking.map((r, i) => (
                                <Cell
                                  key={r.name}
                                  fill={
                                    i === 0
                                      ? "#267c68"
                                      : i === 1
                                        ? "#559982"
                                        : "#97bdab"
                                  }
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <ChartEmpty />
                      )}
                    </div>
                    <p className="panel-hint">
                      Cliquez sur une barre pour explorer un fournisseur.
                    </p>
                  </section>
                </>
              )}

              {view === "quality" ? (
                <section className="quality-layout">
                  <article className="panel">
                    <span className="tiny-label">SOURCE & PÉRIMÈTRE</span>
                    <h2>Une photographie du classeur</h2>
                    <dl>
                      <div>
                        <dt>Fichier chargé</dt>
                        <dd>{dataset.name}</dd>
                      </div>
                      <div>
                        <dt>Feuille analysée</dt>
                        <dd>{dataset.sheet}</dd>
                      </div>
                      <div>
                        <dt>Références exploitables</dt>
                        <dd>{fmt(dataset.products.length)}</dd>
                      </div>
                      <div>
                        <dt>Période couverte</dt>
                        <dd>
                          {dataset.months[0].long} –{" "}
                          {dataset.months[allMonths(dataset)].long}
                        </dd>
                      </div>
                    </dl>
                    <div className="category-quality">
                      <h3>Catégories du fichier fourni</h3>
                      <p className="category-source-filename">
                        <strong>{CATEGORY_SOURCE.fileName}</strong>
                      </p>
                      <p>
                        Champ utilisé : « {CATEGORY_SOURCE.sourceField} ». Le
                        fichier contient {fmt(CATEGORY_SOURCE.reportRows)}{" "}
                        lignes mensuelles et{" "}
                        {fmt(CATEGORY_SOURCE.uniqueProducts)} identités
                        produit/variante. Ses colonnes de ventes ne remplacent
                        pas les valeurs du classeur.
                      </p>
                      <p>
                        Correspondance par SKU exact conservé comme texte, puis
                        titre exact normalisé lorsque le SKU est absent. Un seul
                        type par référence. Aucune catégorie ne provient
                        désormais du site MYMARKET.ma.
                      </p>
                      <p>
                        <strong>{fmt(matchedCategories)}</strong> références
                        catégorisées · <strong>{fmt(missingTypeCount)}</strong>{" "}
                        « Type non renseigné » ·{" "}
                        <strong>{fmt(absentCsvCount)}</strong> « Absent du CSV
                        ».
                      </p>
                      <p>
                        Les mois du rapport vont de janvier à octobre 2026
                        (dates de début de mois). Les espaces sont supprimés en
                        bordure et « bébé » est regroupé sous « Bébé » ; les
                        autres libellés du fichier, y compris « product » ou «
                        matérnité », sont conservés. Les types renseignés aux
                        autres mois peuvent compléter un mois vide ; en cas de
                        changement de type, la dernière valeur renseignée est
                        retenue. {fmt(CATEGORY_SOURCE.conflictingProducts)}{" "}
                        conflit de type détecté dans le fichier.
                      </p>
                      <div className="category-source-links">
                        {CATEGORY_SOURCE.categoryLabels.map((c) => (
                          <span key={c.name} className="category-tag">
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="quality-info">
                      <ShieldCheck size={22} />
                      <p>
                        L’import d’un autre classeur remplace uniquement les
                        données de cette session. Aucun fichier n’est envoyé à
                        un serveur par l’application.
                      </p>
                    </div>
                  </article>
                  <article className="panel">
                    <span className="tiny-label">LECTURE TRANSPARENTE</span>
                    <h2>Points à connaître</h2>
                    <ul className="quality-list">
                      {dataset.warnings.length ? (
                        dataset.warnings.map((w) => (
                          <li key={w}>
                            <CircleHelp size={17} />
                            <span>{w}</span>
                          </li>
                        ))
                      ) : (
                        <li>
                          <Check size={17} />
                          Aucune anomalie de lecture détectée.
                        </li>
                      )}
                      <li>
                        <CircleHelp size={17} />
                        <span>
                          La devise des montants n’est pas indiquée dans le
                          fichier. Aucune devise n’est supposée.
                        </span>
                      </li>
                      <li>
                        <CircleHelp size={17} />
                        <span>
                          Les quantités et montants suivent la période filtrée.
                          Le stock et son état restent un instantané de la
                          source.
                        </span>
                      </li>
                      <li>
                        <CircleHelp size={17} />
                        <span>
                          Les mouvements négatifs sont conservés, sans
                          correction ni interprétation comptable.
                        </span>
                      </li>
                    </ul>
                  </article>
                </section>
              ) : (
                <section className="panel table-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="tiny-label">
                        EXPLORER LES RÉFÉRENCES
                      </span>
                      <h3>
                        Le catalogue en détail{" "}
                        <span className="count-badge">
                          {fmt(filtered.length)}
                        </span>
                      </h3>
                    </div>
                    <span className="table-help">
                      Cliquez sur une référence pour l’explorer
                    </span>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th
                            aria-sort={
                              sort.key === "title"
                                ? sort.desc
                                  ? "descending"
                                  : "ascending"
                                : "none"
                            }
                          >
                            <button onClick={() => sortBy("title")}>
                              Produit{" "}
                              <SortIndicator
                                active={sort.key === "title"}
                                desc={sort.desc}
                              />
                            </button>
                          </th>
                          <th>Fournisseur</th>
                          <th
                            aria-sort={
                              sort.key === "category"
                                ? sort.desc
                                  ? "descending"
                                  : "ascending"
                                : "none"
                            }
                          >
                            <button onClick={() => sortBy("category")}>
                              Catégories{" "}
                              <SortIndicator
                                active={sort.key === "category"}
                                desc={sort.desc}
                              />
                            </button>
                          </th>
                          <th
                            aria-sort={
                              sort.key === "stock"
                                ? sort.desc
                                  ? "descending"
                                  : "ascending"
                                : "none"
                            }
                          >
                            <button onClick={() => sortBy("stock")}>
                              Stock{" "}
                              <SortIndicator
                                active={sort.key === "stock"}
                                desc={sort.desc}
                              />
                            </button>
                          </th>
                          <th>État</th>
                          <th
                            className="numeric"
                            aria-sort={
                              sort.key === "periodUnits"
                                ? sort.desc
                                  ? "descending"
                                  : "ascending"
                                : "none"
                            }
                          >
                            <button onClick={() => sortBy("periodUnits")}>
                              Unités{" "}
                              <SortIndicator
                                active={sort.key === "periodUnits"}
                                desc={sort.desc}
                              />
                            </button>
                          </th>
                          <th
                            className="numeric"
                            aria-sort={
                              sort.key === "periodAmount"
                                ? sort.desc
                                  ? "descending"
                                  : "ascending"
                                : "none"
                            }
                          >
                            <button onClick={() => sortBy("periodAmount")}>
                              Montant source{" "}
                              <SortIndicator
                                active={sort.key === "periodAmount"}
                                desc={sort.desc}
                              />
                            </button>
                          </th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <button
                                className="product-link"
                                onClick={() => openProduct(p)}
                              >
                                <strong>{p.title}</strong>
                                <small>SKU {p.sku}</small>
                              </button>
                            </td>
                            <td className="supplier-cell">{p.supplier}</td>
                            <td
                              className="category-cell"
                              title={categoryExplanation(p.categoryMethod)}
                            >
                              {p.categories.map((c) => (
                                <button
                                  key={c}
                                  aria-label={"Filtrer la catégorie " + c}
                                  className={
                                    "category-tag " +
                                    ([
                                      MISSING_TYPE,
                                      ABSENT_FROM_CSV,
                                      AMBIGUOUS_TYPE,
                                    ].includes(c)
                                      ? "unmatched"
                                      : "")
                                  }
                                  onClick={() =>
                                    setCategory(category === c ? "" : c)
                                  }
                                >
                                  {c}
                                </button>
                              ))}
                            </td>
                            <td className={p.stock < 0 ? "negative" : ""}>
                              {fmt(p.stock)}
                            </td>
                            <td>
                              <span className={"badge " + badgeClass(p.status)}>
                                {p.status}
                              </span>
                            </td>
                            <td className="numeric">{fmt(p.periodUnits)}</td>
                            <td className="numeric amount-cell">
                              {fmt(p.periodAmount, 2)}
                            </td>
                            <td>
                              <button
                                className="row-arrow"
                                aria-label={"Voir " + p.title}
                                onClick={() => openProduct(p)}
                              >
                                <ArrowRight size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!tableRows.length && (
                      <ChartEmpty text="Aucune référence ne correspond à ces filtres. Essayez une recherche plus large." />
                    )}
                  </div>
                  <div className="table-footer">
                    <span>
                      {filtered.length
                        ? `${currentPage * 12 + 1}–${Math.min((currentPage + 1) * 12, filtered.length)}`
                        : "0"}{" "}
                      sur {fmt(filtered.length)} références
                    </span>
                    <div>
                      <button
                        aria-label="Page précédente"
                        disabled={currentPage === 0}
                        onClick={() => setPage(currentPage - 1)}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span>
                        Page {currentPage + 1} / {pageCount}
                      </span>
                      <button
                        aria-label="Page suivante"
                        disabled={currentPage >= pageCount - 1}
                        onClick={() => setPage(currentPage + 1)}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </section>
              )}
              <footer className="page-footer">
                <span>
                  MYMARKET <i /> Analyse du magasin
                </span>
                <span>
                  Source : {dataset.name} · {fmt(dataset.products.length)}{" "}
                  références{" "}
                  <button onClick={() => setView("quality")}>
                    À propos des données <ArrowRight size={12} />
                  </button>
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
      {selected && dataset && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="product-modal"
            ref={modalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={selected.title}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Fermer le détail"
              autoFocus
              onClick={() => setSelected(null)}
            >
              <X size={20} />
            </button>
            <span className="tiny-label">DÉTAIL DE LA RÉFÉRENCE</span>
            <h2>{selected.title}</h2>
            <p>
              {selected.supplier} · SKU {selected.sku}
            </p>
            <div className="detail-category">
              <span>{selected.category}</span>
              <p>{categoryExplanation(selected.categoryMethod)}</p>
              <p className="category-source-filename">
                Source : {CATEGORY_SOURCE.fileName} · champ «{" "}
                {CATEGORY_SOURCE.sourceField} »
              </p>
            </div>
            <div className="detail-kpis">
              <div>
                <span>Stock source</span>
                <strong>{fmt(selected.stock)}</strong>
              </div>
              <div>
                <span>Unités sélectionnées</span>
                <strong>{fmt(selected.periodUnits)}</strong>
              </div>
              <div>
                <span>Montant sélectionné</span>
                <strong>{fmt(selected.periodAmount, 2)}</strong>
              </div>
            </div>
            <div className="detail-table">
              <table>
                <thead>
                  <tr>
                    <th>Mois</th>
                    <th className="numeric">Unités</th>
                    <th className="numeric">Montant source</th>
                  </tr>
                </thead>
                <tbody>
                  {dataset.months.map((m, i) => (
                    <tr
                      key={m.date}
                      className={i >= from && i <= to ? "highlight-row" : ""}
                    >
                      <td>
                        {m.long}
                        {i >= from && i <= to && (
                          <span className="selected-mark">Sélection</span>
                        )}
                      </td>
                      <td className="numeric">{fmt(selected.units[i])}</td>
                      <td className="numeric">{fmt(selected.amounts[i], 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="modal-note">
              Les lignes teintées correspondent à la période active. Devise non
              précisée dans la source.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
function ChartEmpty({
  text = "Aucune donnée pour la sélection.",
}: {
  text?: string;
}) {
  return (
    <div className="chart-empty">
      <Search size={24} />
      <span>{text}</span>
    </div>
  );
}

function SortIndicator({ active, desc }: { active: boolean; desc: boolean }) {
  return active ? (
    desc ? (
      <ArrowDown size={12} />
    ) : (
      <ArrowUp size={12} />
    )
  ) : (
    <ArrowUpDown size={12} />
  );
}
