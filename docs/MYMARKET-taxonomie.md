# Catégories du rapport CSV fourni

La source active des catégories est désormais le fichier `Ventestotalesparvariantedeproduit-2026-01-01-2026-10-14.csv`, en remplacement des rayons précédemment récupérés sur MYMARKET.ma. Le champ utilisé est **« Type de produit »**. La colonne du rapport « SKU de la variante de produit » sert à rattacher les références au classeur Excel ; le titre sert de repli exact après normalisation des accents, de la casse et de la ponctuation. Les SKU restent du texte et ne sont jamais transformés en nombres, tronqués ou débarrassés de leurs zéros initiaux.

## Source et libellés

Le CSV contient 9 273 lignes de données mensuelles, de janvier à octobre 2026. Son index dédupliqué contient 3 411 identités de produits/variantes (3 407 SKU non vides et 4 identités sans SKU rattachées par titre). Parmi ces identités, 3 049 ont un type renseigné et 362 n’en ont pas. Les répétitions mensuelles ne multiplient pas les produits dans le tableau de bord.

Les 14 libellés bruts deviennent **13 types** après regroupement de la seule différence de casse « bébé »/« Bébé ». Les espaces en bordure sont supprimés. Aucun type n’est inféré depuis un fournisseur, les mots du titre ou les rayons du site. Les libellés tels que « Yogourt », « product », « matérnité », « Electroménagers » ou « shampoing » sont conservés tels qu’ils figurent dans le fichier.

Chaque SKU utilise sa dernière valeur de type renseignée dans le rapport ; les mois avec un type vide ne suppriment pas une valeur renseignée à un autre mois. **Aucun conflit de type par SKU n’est présent dans ce rapport.** Un rapprochement par titre qui correspondrait à plusieurs types différents est signalé comme « Type ambigu », sans affectation arbitraire.

## Application au classeur existant

Sur les 2 612 références du classeur Excel, 1 943 sont classées par SKU et 19 par titre exactement normalisé, soit **1 962 références catégorisées**. Les **102 références associées au CSV mais sans type** sont regroupées sous « Type non renseigné ». Les **548 références sans correspondance dans le rapport** sont regroupées sous « Absent du CSV ». Ces deux états ne sont pas des catégories inventées : ils décrivent les données manquantes ou l’absence de correspondance.

Chaque référence appartient à un seul type dans la nouvelle base. La somme de la répartition par catégorie, y compris les deux groupes sans catégorie, retrouve donc le nombre de références de la sélection. Le filtre, la répartition interactive, la colonne du catalogue, la fiche produit et l’export CSV utilisent tous cette même base.

Les montants, quantités et stocks restent issus de `MYMARKET_Tableau_de_bord.xlsx` ; **les ventes du CSV ne remplacent pas les ventes Excel**, puisque la demande porte sur la base des catégories. Les totaux du tableau de bord sont inchangés : 44 059 unités, 1 524 463,81 de montant source et 64 437 unités de stock.

## Actualisation technique

Le script `scripts/build_category_index.py` génère `src/category-source.json` à partir du rapport original, avec les métadonnées de provenance et uniquement les SKU, titres et types. Il n’exporte pas les colonnes financières du CSV et n’interroge aucun site web. Le CSV original demeure intact dans les pièces jointes ; il n’est pas ajouté aux fichiers publics de l’application. Les fichiers `src/catalog-categories.json` et `scripts/sync_categories.py`, issus de l’ancienne phase, sont historiques et ne sont plus importés par l’application active.

Les imports Excel de même structure sont rapprochés avec la nouvelle base CSV enregistrée. Ils restent traités dans le navigateur, sans transmission vers MYMARKET.ma. Le site reste en aperçu non publié.
