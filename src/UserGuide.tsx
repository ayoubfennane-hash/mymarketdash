import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  FileSpreadsheet,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import type { Dataset } from "./data";
import { CATEGORY_SOURCE, isAssignedCategory } from "./categories";
import { formatNumber as fmt } from "./analytics";
import { indicatorDefinitions, commonQuestions } from "./helpContent";

export type AnalysisView = "overview" | "catalogue" | "quality";
export default function UserGuide({
  dataset,
  onNavigate,
  onImport,
}: {
  dataset: Dataset | null;
  onNavigate: (view: AnalysisView) => void;
  onImport: () => void;
}) {
  const assigned =
    dataset?.products.filter((p) => isAssignedCategory(p.categoryMethod))
      .length || 0;
  const missing =
    dataset?.products.filter((p) => p.categoryMethod === "missing").length || 0;
  const absent =
    dataset?.products.filter((p) => p.categoryMethod === "unmatched").length ||
    0;
  return (
    <div className="guide-layout" aria-label="Guide d’utilisation MYMARKET">
      <nav className="guide-toc" aria-label="Sommaire du guide">
        <BookOpen size={19} aria-hidden="true" />
        <strong>Votre mode d’emploi</strong>
        <a href="#guide-start">Bien commencer</a>
        <a href="#guide-indicators">Lire les indicateurs</a>
        <a href="#guide-explore">Explorer les données</a>
        <a href="#guide-sources">Comprendre les sources</a>
        <a href="#guide-faq">Questions fréquentes</a>
      </nav>
      <div className="guide-content">
        <section id="guide-start" className="panel guide-section">
          <div className="guide-section-heading">
            <span className="guide-step">01</span>
            <div>
              <span className="tiny-label">DE L’EXCEL À L’ANALYSE</span>
              <h2>Bien commencer, sans changer vos données</h2>
            </div>
          </div>
          <p className="guide-lead">
            Le site transforme votre classeur en une lecture interactive du
            magasin. Il ne gère pas les commandes, ne modifie pas la boutique et
            ne met pas à jour les stocks en temps réel.
          </p>
          <ol className="guide-steps">
            <li>
              <strong>Téléchargez le modèle Excel.</strong>
              <p>
                Le lien « Modèle Excel » à gauche fournit un fichier vierge avec
                100 lignes, les en-têtes attendus, des formules de total et une
                feuille d’instructions.
              </p>
              <a
                className="btn"
                href="/MYMARKET_modele_import.xlsx"
                download="MYMARKET_modele_import.xlsx"
              >
                <ArrowDownToLine size={15} />
                Télécharger le modèle Excel
              </a>
            </li>
            <li>
              <strong>Remplissez la feuille Feuil1.</strong>
              <p>
                Une ligne par produit ou variante, avec un titre. Gardez les SKU
                au format texte, les deux séries de dix dates Excel identiques
                et les valeurs numériques en nombres. Conservez les 28 colonnes
                dans le même ordre. Le modèle vide ne peut pas être analysé.
              </p>
            </li>
            <li>
              <strong>Enregistrez, puis importez votre classeur.</strong>
              <p>
                Ouvrez et enregistrez le fichier dans Excel pour recalculer les
                formules, puis choisissez un fichier .xlsx ou .xls de 10 Mo
                maximum. Un import réussi valide puis enregistre le classeur sur
                cet appareil, remplace les données et réinitialise les filtres.
                Un fichier invalide ou un échec de stockage conserve le jeu et
                la sauvegarde précédents.
              </p>
              <button className="btn primary" onClick={onImport}>
                <Upload size={15} />
                Importer mon classeur
              </button>
            </li>
            <li>
              <strong>Vérifiez la source avant d’interpréter.</strong>
              <p>
                La vue Qualité des données indique le fichier chargé, sa
                feuille, sa période et les anomalies de lecture. Un fichier
                importé est enregistré sur cet appareil et restauré après
                actualisation à cette même adresse. Vérifiez le message « Import
                enregistré sur cet appareil ». Les imports perdus avant cette
                mise à jour ne peuvent pas être récupérés : réimportez votre
                Excel une fois. Gardez le fichier original : effacer les données
                du navigateur ou utiliser la navigation privée peut supprimer ou
                empêcher la sauvegarde.
              </p>
              <button
                className="text-button"
                onClick={() => onNavigate("quality")}
              >
                Vérifier mes données <ArrowRight size={14} />
              </button>
            </li>
          </ol>
          <details className="guide-format">
            <summary>Voir les 28 colonnes attendues</summary>
            <div className="table-scroll">
              <table>
                <caption>Structure du modèle importable</caption>
                <thead>
                  <tr>
                    <th>Colonnes</th>
                    <th>Contenu</th>
                    <th>À faire</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>A:F</td>
                    <td>
                      Title, SKU, fournisseur, Location, Available (not
                      editable), situation
                    </td>
                    <td>
                      Renseigner le titre, l’identifiant, le fournisseur, le
                      lieu, le stock source et l’état.
                    </td>
                  </tr>
                  <tr>
                    <td>G:P</td>
                    <td>Dix mois de quantités</td>
                    <td>
                      Saisir les mouvements mensuels ; ne pas remplacer les
                      dates de l’en-tête par des titres textuels.
                    </td>
                  </tr>
                  <tr>
                    <td>Q</td>
                    <td>totale</td>
                    <td>Conserver la formule de somme G:P.</td>
                  </tr>
                  <tr>
                    <td>R:AA</td>
                    <td>Les mêmes dix mois de montants</td>
                    <td>
                      Saisir les montants du classeur sans inventer de devise.
                    </td>
                  </tr>
                  <tr>
                    <td>AB</td>
                    <td>totale</td>
                    <td>Conserver la formule de somme R:AA.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </section>
        <section id="guide-indicators" className="panel guide-section">
          <div className="guide-section-heading">
            <span className="guide-step">02</span>
            <div>
              <span className="tiny-label">DÉFINITIONS & CALCULS</span>
              <h2>Ce que les chiffres disent vraiment</h2>
            </div>
          </div>
          <p>
            Chaque filtre retient des références ; les mois déterminent ensuite
            la portion de leurs mouvements à additionner. La période inclut le
            mois de début <strong>et</strong> le mois de fin.
          </p>
          <dl className="guide-definitions">
            {indicatorDefinitions.map((d) => (
              <div key={d.name}>
                <dt>{d.name}</dt>
                <dd>
                  <strong>{d.formula}</strong>
                  <p>{d.meaning}</p>
                </dd>
              </div>
            ))}
          </dl>
          <div className="guide-callout">
            <ShieldCheck size={19} />
            <p>
              <strong>Le stock n’est pas une série historique.</strong> Un
              montant élevé ne prouve pas une rentabilité ; une rupture ne
              suffit pas à calculer un besoin de réapprovisionnement. Le fichier
              ne fournit pas les marges, délais ou règles nécessaires à ces
              décisions.
            </p>
          </div>
        </section>
        <section id="guide-explore" className="panel guide-section">
          <div className="guide-section-heading">
            <span className="guide-step">03</span>
            <div>
              <span className="tiny-label">FILTRES, GRAPHIQUES & DÉTAILS</span>
              <h2>Aller du panorama à une référence</h2>
            </div>
          </div>
          <div className="guide-explorations">
            <article>
              <SlidersHorizontal size={20} />
              <h3>Combinez vos critères</h3>
              <p>
                Recherchez un produit, un SKU ou un fournisseur, puis ajoutez
                une catégorie, un ou plusieurs fournisseurs, un état et une
                période. Dans le menu fournisseur, recherchez puis cochez vos
                choix : un produit de l’un OU l’autre fournisseur est retenu.
                Sans case cochée, tous les fournisseurs sont inclus. Les autres
                critères se cumulent : toutes leurs conditions doivent être
                satisfaites. « Réinitialiser les filtres » retrouve l’ensemble
                du classeur.
              </p>
            </article>
            <article>
              <h3>Lisez les graphiques</h3>
              <p>
                La courbe additionne les mouvements de la sélection, mois par
                mois. « Montants » et « Unités » changent aussi la mesure du top
                7 fournisseurs. L’anneau des états et les barres de catégories
                comptent des références, pas des unités vendues. Survolez pour
                lire la valeur exacte.
              </p>
            </article>
            <article>
              <h3>Cliquez pour explorer</h3>
              <p>
                Une barre de catégorie ou un état applique son filtre ; cliquez
                à nouveau pour le retirer. Une barre fournisseur ajoute ou
                retire ce fournisseur sans effacer les autres choix. Les menus
                proposent également les mêmes critères au clavier. Le filtre
                catégorie reste combiné aux autres filtres : un résultat vide
                est possible.
              </p>
            </article>
            <article>
              <FileSpreadsheet size={20} />
              <h3>Ouvrez, triez, exportez</h3>
              <p>
                Le catalogue présente 12 lignes par page. Cliquez sur un en-tête
                pour changer le tri, sur une référence pour ouvrir ses
                mouvements mensuels et sa provenance. « Exporter la sélection »
                télécharge toutes les lignes filtrées et triées, pas seulement
                la page visible.
              </p>
            </article>
          </div>
          <div className="guide-example">
            <span className="tiny-label">UN PARCOURS CONCRET</span>
            <p>
              Choisissez une catégorie, sélectionnez un fournisseur puis un
              intervalle de mois. Lisez ses quantités et montants, regardez le
              stock source et ouvrez une référence du catalogue. Vérifiez les
              avertissements avant d’exporter cette sélection.
            </p>
          </div>
          <div className="guide-actions">
            <button
              className="btn primary"
              onClick={() => onNavigate("overview")}
            >
              Ouvrir la vue d’ensemble <ArrowRight size={15} />
            </button>
            <button className="btn" onClick={() => onNavigate("catalogue")}>
              Explorer le catalogue
            </button>
          </div>
        </section>
        <section id="guide-sources" className="panel guide-section">
          <div className="guide-section-heading">
            <span className="guide-step">04</span>
            <div>
              <span className="tiny-label">DEUX SOURCES, DEUX RÔLES</span>
              <h2>Excel pour les mouvements, CSV pour les catégories</h2>
            </div>
          </div>
          <div className="guide-sources">
            <article>
              <span className="source-role">DONNÉES DU MAGASIN</span>
              <h3>Le classeur Excel</h3>
              <p className="category-source-filename">
                {dataset?.name || "Aucun classeur chargé pour le moment."}
              </p>
              <p>
                Il apporte les références, fournisseurs, mouvements mensuels,
                stocks et états. L’import d’un nouveau classeur remplace ces
                données et enregistre le dernier import dans le stockage de ce
                navigateur. Il est restauré après actualisation. Cette
                sauvegarde n’est pas partagée entre appareils, navigateurs ou
                adresses (aperçu et site publié). Le bouton « Revenir au fichier
                initial » retire cette sauvegarde locale après confirmation,
                sans effacer votre Excel d’origine.
              </p>
            </article>
            <article>
              <span className="source-role">BASE DES CATÉGORIES</span>
              <h3>Le rapport CSV fourni</h3>
              <p className="category-source-filename">
                {CATEGORY_SOURCE.fileName}
              </p>
              <p>
                Le champ « {CATEGORY_SOURCE.sourceField} » est rattaché par SKU
                exact, puis titre exact normalisé. Le CSV ne remplace pas les
                ventes Excel. L’import Excel ne met pas à jour cette base et le
                bouton n’accepte pas un nouveau CSV.
              </p>
            </article>
          </div>
          {dataset && (
            <p className="guide-coverage">
              <Check size={17} />
              <span>
                Dans le classeur chargé : <strong>{fmt(assigned)}</strong>{" "}
                références catégorisées, <strong>{fmt(missing)}</strong> au type
                non renseigné et <strong>{fmt(absent)}</strong> absentes du CSV.
                Ces comptes concernent tout le classeur, pas seulement vos
                filtres.
              </span>
            </p>
          )}
          <p>
            <strong>Type non renseigné</strong> : le produit existe dans le CSV,
            mais n’a pas de type. <strong>Absent du CSV</strong> : aucun
            rapprochement fiable. <strong>Type ambigu</strong> : plusieurs types
            incompatibles pour une identité, sans choix arbitraire. Chaque
            référence appartient à un seul groupe ; les répartitions par type
            peuvent être additionnées.
          </p>
          <p>
            Il n’y a pas de connexion automatique à MYMARKET.ma : les données
            reflètent les fichiers fournis, pas l’état actuel de la boutique.
            L’import local n’envoie pas votre nouveau classeur à la boutique ou
            à un serveur de stockage.
          </p>
          <button className="text-button" onClick={() => onNavigate("quality")}>
            Consulter la provenance et les anomalies <ArrowRight size={14} />
          </button>
        </section>
        <section id="guide-faq" className="panel guide-section">
          <div className="guide-section-heading">
            <span className="guide-step">05</span>
            <div>
              <span className="tiny-label">RÉPONSES PRATIQUES</span>
              <h2>Les questions que l’on se pose</h2>
            </div>
          </div>
          <div className="guide-faq">
            {commonQuestions.map((q) => (
              <details key={q.question}>
                <summary>{q.question}</summary>
                <p>{q.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
