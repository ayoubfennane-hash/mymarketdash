import { ArrowRight, BookOpen, CircleHelp } from "lucide-react";
import { summarize, formatNumber as fmt, type ProductView } from "./analytics";
import { indicatorDefinitions } from "./helpContent";

export default function ReadingAid({
  products,
  period,
  onGuide,
}: {
  products: ProductView[];
  period: string;
  onGuide: () => void;
}) {
  const stats = summarize(products);
  return (
    <section
      className="reading-aid"
      aria-label="Lecture guidée de la sélection"
    >
      <div className="reading-aid-heading">
        <BookOpen size={19} aria-hidden="true" />
        <div>
          <span className="tiny-label">LES CHIFFRES, EN CLAIR</span>
          <h2>Votre sélection en quelques mots</h2>
        </div>
        <button className="text-button" onClick={onGuide}>
          Guide d’utilisation <ArrowRight size={14} />
        </button>
      </div>
      {products.length ? (
        <p className="reading-summary" aria-live="polite">
          <strong>{fmt(stats.count)} références</strong> retenues sur{" "}
          <strong>{period}</strong> : elles cumulent{" "}
          <strong>{fmt(stats.units)} unités</strong> de mouvements et{" "}
          <strong>{fmt(stats.amount, 2)}</strong> de montant source, sans devise
          précisée. Leur stock source totalise{" "}
          <strong>{fmt(stats.stock)} unités</strong>. Parmi elles,{" "}
          <strong>{fmt(stats.out)} références</strong> portent l’état « Rupture
          » (<strong>{fmt((stats.out / stats.count) * 100, 1)} %</strong> de la
          sélection). Le stock et les états ne sont pas des valeurs historiques
          de cette période.
        </p>
      ) : (
        <p className="reading-summary" aria-live="polite">
          Aucune référence ne répond à tous vos filtres. Réinitialisez-les ou
          élargissez la sélection ; aucun chiffre ni besoin de stock ne peut
          être déduit d’un résultat vide.
        </p>
      )}
      <details className="reading-details">
        <summary>
          <CircleHelp size={15} aria-hidden="true" />
          Comment lire ces indicateurs ?
        </summary>
        <div className="reading-definitions">
          {indicatorDefinitions.slice(0, 4).map((d) => (
            <div key={d.name}>
              <strong>{d.name}</strong>
              <p>
                {d.formula} {d.meaning}
              </p>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
