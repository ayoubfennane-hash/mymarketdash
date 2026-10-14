# MYMARKET — Tableau de bord interactif

## Résultats attendus

- [x] **Importer et lire le classeur comme source du tableau de bord** — Import et lecture du classeur `MYMARKET_Tableau_de_bord.xlsx` comme source de données du tableau de bord.
  Réalisé : le classeur original est livré avec l’application et lu dans le navigateur ; un import local peut le remplacer pour la session. Tests sur les 2 612 lignes réelles et rejet d’un format incompatible.
- [x] **Présenter une synthèse des indicateurs** — Vue de synthèse présentant les principaux indicateurs de marché disponibles dans le classeur.
  Réalisé : montants, unités, stock source et références en rupture sont calculés sur la sélection. Les tests retrouvent 44 059 unités, 1 524 463,81 de montant et 64 437 de stock.
- [x] **Visualiser séries, catégories et répartitions** — Graphiques interactifs adaptés aux séries, catégories et répartitions présentes dans les données.
  Réalisé : tendance mensuelle montants/unités, répartition des états et classement des fournisseurs.
- [x] **Filtrer l’analyse selon les dimensions disponibles** — Filtres permettant d’affiner l’analyse selon les dimensions disponibles dans le fichier.
  Réalisé : recherche produit/SKU/fournisseur, fournisseur, état de stock et intervalle mensuel. Tests des filtres combinés, de la période et d’une sélection vide.
- [x] **Relier les interactions entre indicateurs et visualisations** — Interactions entre indicateurs et visualisations, avec infobulles et mise en évidence des sélections.
  Réalisé : les mêmes données filtrées alimentent KPI, graphiques et tableau ; les états et fournisseurs sont sélectionnables depuis leurs visualisations. Les états des boutons sont exposés avec aria-pressed.
- [x] **Afficher les valeurs détaillées sous-jacentes** — Tableaux détaillés pour consulter les valeurs sous-jacentes aux graphiques.
  Réalisé : catalogue paginé et triable, fiche mensuelle par référence et export CSV de toute la sélection. Tests de direction du tri et de la navigation clavier de la fiche.
- [x] **Adapter l’interface aux différents écrans** — Mise en page responsive adaptée aux écrans d’ordinateur, tablettes et mobiles.
  Réalisé : règles CSS pour 1 200, 960 et 700 px ; navigation compacte, filtres réorganisés, indicateurs sur deux colonnes et graphiques empilés sur mobile. Contrôle statique du comportement responsive.
- [x] **Gérer les états de lecture et les données incomplètes** — Gestion explicite des états de chargement, des données manquantes et des erreurs de lecture du classeur.
  Réalisé : chargement, erreur, réessai, sélection vide et qualité des données ; conservation des 20 stocks négatifs et signalement des 552 fournisseurs non renseignés. Tests des indicateurs de chargement et d’erreur.

## Vérifications effectuées

Compilation TypeScript et build Vite réussis. Sept tests de données réelles et quatre tests DOM ciblés réussis. Contrôle en lecture seule de la cohérence de l’application, puis correction des quatre points d’accessibilité/état confirmés. Le manifeste de route, la page et le classeur source répondent HTTP 200 en local et via l’aperçu ; l’empreinte du classeur servi correspond à la source.

La devise n’est pas précisée dans le fichier et n’est pas supposée. Le stock reste un instantané source, indépendant de la période mensuelle. Le site n’est pas publié et la publication automatique est désactivée.

## Ajout demandé : catégories à partir de MYMARKET.ma

- [x] **Catégoriser les références selon les rayons MYMARKET.ma** — Reprendre les noms des rayons de la boutique officielle, rapprocher les produits par SKU ou titre lorsque le catalogue public le permet et rendre explicite la provenance de chaque classement. Ne pas présenter une proposition locale comme une attribution officielle ; les références sans correspondance fiable restent « À classer ».
- [x] **Explorer et exporter les catégories** — Ajouter un filtre catégorie synchronisé avec les KPI, graphiques et tableaux, une visualisation par catégorie, ainsi que la catégorie dans le catalogue, la fiche produit et l’export CSV. Conserver le comportement responsive, les filtres existants et les totaux du classeur.

Ajout livré : 2 802 produits publics indexés sur 11 collections ; 2 506 correspondances SKU et 25 correspondances de titre exact normalisé (2 531 références), 81 références conservées dans « À classer ». Les appartenances multiples officielles sont préservées. Catégorie présente dans le filtre, la répartition interactive, le catalogue triable, la fiche produit et l’export CSV ; source, méthode et date visibles dans la qualité des données. Compilation Vite/TypeScript et 17 tests réussis, dont filtre catégorie et absence de double comptage dans les KPI. Aucun changement au classeur source.
