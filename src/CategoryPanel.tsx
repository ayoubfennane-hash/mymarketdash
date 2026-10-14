import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Layers3 } from "lucide-react";
import {
  categoryDistribution,
  formatNumber as fmt,
  type ProductView,
} from "./analytics";
import { CATEGORY_SOURCE } from "./categories";

export default function CategoryPanel({
  products,
  category,
  onSelect,
}: {
  products: ProductView[];
  category: string;
  onSelect: (name: string) => void;
}) {
  const data = categoryDistribution(products);
  return (
    <section
      className="panel category-panel"
      aria-label="Répartition par catégories MYMARKET.ma"
    >
      <div className="panel-heading">
        <div>
          <span className="tiny-label">RAYONS MYMARKET.MA</span>
          <h3>Votre catalogue, par catégorie</h3>
        </div>
        <a
          className="subtle-pill source-link"
          href={CATEGORY_SOURCE.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Source : MYMARKET.ma
        </a>
      </div>
      <div className="category-panel-body">
        <div
          className="category-chart"
          style={{ height: Math.max(220, data.length * 32 + 38) }}
        >
          {data.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 8 }}
              >
                <CartesianGrid horizontal={false} stroke="#edf1ee" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#7b8983" }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={146}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#40584e" }}
                />
                <Tooltip
                  formatter={(v) => [fmt(Number(v)), "Références"]}
                  cursor={{ fill: "#f1f6f3" }}
                  contentStyle={{ borderRadius: 10, fontSize: 12 }}
                />
                <Bar
                  dataKey="value"
                  barSize={15}
                  radius={[0, 5, 5, 0]}
                  onClick={(entry) => {
                    const d = entry as unknown as {
                      name?: string;
                      payload?: { name: string };
                    };
                    const name = d.name || d.payload?.name;
                    if (name) onSelect(name);
                  }}
                >
                  {data.map((d) => (
                    <Cell
                      key={d.name}
                      fill={
                        d.name === "À classer"
                          ? "#d5ad65"
                          : category === d.name
                            ? "#12645c"
                            : "#82ad94"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">
              <Layers3 size={24} />
              <span>Aucune référence dans la sélection.</span>
            </div>
          )}
        </div>
        <div className="category-summary">
          <span className="tiny-label">EXPLORER UN RAYON</span>
          <div className="category-chips">
            {data.map((d) => (
              <button
                key={d.name}
                aria-pressed={category === d.name}
                onClick={() => onSelect(d.name)}
                className={category === d.name ? "chosen" : ""}
              >
                <span>{d.name}</span>
                <strong>{fmt(d.value)}</strong>
              </button>
            ))}
          </div>
          <p>
            Les rayons sont ceux du site. Un produit peut appartenir à plusieurs
            catégories : les barres ne s’additionnent pas au total des
            références.
          </p>
          <p>
            « À classer » conserve les références sans correspondance fiable,
            sans catégorie supposée.
          </p>
        </div>
      </div>
    </section>
  );
}
