export const indicatorDefinitions = [
  {
    name: "Montant cumulé",
    formula:
      "Somme des montants mensuels R:AA sur les mois et références sélectionnés.",
    meaning:
      "Les montants proviennent du classeur Excel, pas des ventes du CSV de catégories. La devise n’est pas précisée : ce nombre n’est ni une marge, ni un bénéfice calculé par le site.",
  },
  {
    name: "Quantités cumulées",
    formula:
      "Somme des quantités mensuelles G:P sur les mois et références sélectionnés.",
    meaning:
      "Il s’agit de mouvements en unités, et non du nombre de produits distincts. Les mouvements négatifs restent inclus sans interprétation automatique.",
  },
  {
    name: "Stock disponible",
    formula:
      "Somme de la colonne E pour les références retenues par les filtres.",
    meaning:
      "Le stock est un instantané du fichier. Changer les mois ne reconstitue pas un stock historique. Les stocks négatifs sont conservés et signalés dans la qualité des données.",
  },
  {
    name: "Références en rupture",
    formula:
      "Nombre de lignes sélectionnées dont le champ situation est « Rupture ».",
    meaning:
      "Le pourcentage est ce nombre divisé par le nombre de références de la sélection. L’état vient du fichier : il n’est pas recalculé à partir d’un seuil de stock inventé. Un clic sur cette carte active ou désactive le filtre Rupture.",
  },
  {
    name: "Nombre de références",
    formula:
      "Nombre de lignes avec un titre exploitable après les filtres produit, fournisseur, catégorie et état.",
    meaning:
      "Une référence représente une ligne produit ou variante du classeur ; les lignes ne sont pas dédupliquées par SKU. Les mois changent ses mouvements, pas son appartenance au catalogue : une ligne sans mouvement reste comptée.",
  },
];

export const commonQuestions = [
  {
    question:
      "Pourquoi le stock ne change-t-il pas lorsque je change les mois ?",
    answer:
      "Le classeur ne fournit qu’un stock disponible, pas un historique mensuel du stock. La période agit sur les quantités et montants. Les filtres de produits, fournisseurs, catégories et états peuvent en revanche changer la liste de références dont le stock est additionné.",
  },
  {
    question: "Pourquoi le montant diffère-t-il du total Q ou AB dans Excel ?",
    answer:
      "Q est le total de quantités et AB le total de montants du fichier. Le site additionne les cellules mensuelles de la période inclusive choisie. Si les totaux source ne correspondent pas à ces sommes, la vue Qualité des données signale l’écart ; elle ne corrige pas le fichier à votre place.",
  },
  {
    question: "Que signifient « Type non renseigné » et « Absent du CSV » ?",
    answer:
      "« Type non renseigné » désigne un produit retrouvé dans la base CSV mais sans Type de produit renseigné. « Absent du CSV » signifie qu’aucun SKU ou titre exact normalisé ne correspond. Le site ne complète jamais ces groupes en devinant une catégorie ou en utilisant les anciens rayons du site MYMARKET.ma.",
  },
  {
    question: "Pourquoi certaines catégories n’affichent-elles aucun produit ?",
    answer:
      "Le filtre reprend les types de la base CSV, qui peut contenir plus de produits que le classeur ou que votre sélection. Une catégorie sans référence correspondante produit une sélection vide. Réinitialisez les filtres ou élargissez vos autres critères ; ne remplacez pas ce résultat vide par des données supposées.",
  },
  {
    question: "Mon fichier importé reste-t-il enregistré après actualisation ?",
    answer:
      "Oui. Connecté avec Manus, un import réussi est enregistré dans votre espace privé cloud et restauré après connexion au même compte sur un autre appareil de ce site. Le panneau affiche le fichier, sa date et ses actions de restauration/téléchargement. Un seul dernier classeur par compte est conservé : un nouveau fichier valide le remplace. Un conflit avec une modification plus récente sur un autre appareil est refusé ; restaurez d’abord le fichier actuel. Sans connexion, l’import reste uniquement dans le navigateur et à cette adresse ; effacer ses données ou utiliser un autre appareil ne le retrouve pas. Le bouton d’enregistrement d’un ancien import local constitue une action explicite : rien n’est téléversé automatiquement. Gardez votre Excel original ; les imports déjà perdus doivent être réimportés. Les catégories CSV et les filtres ne sont pas synchronisés avec Shopify.",
  },
  {
    question: "Puis-je importer directement un nouveau CSV de catégories ?",
    answer:
      "Pas depuis ce bouton : « Importer Excel » accepte un classeur .xlsx ou .xls de 10 Mo maximum, avec exactement les 28 colonnes du modèle et jusqu’à 10 000 lignes de produits. Pour .xlsx, le contenu décompressé est limité à 24 Mo au total (16 Mo par élément). Le CSV de catégories fourni est déjà intégré comme base de rapprochement. Son actualisation nécessite une mise à jour de cette base ; elle n’est pas automatique et l’import d’un Excel ne la remplace pas.",
  },
  {
    question: "Comment préparer un modèle vierge avant de l’importer ?",
    answer:
      "Remplissez au moins un titre dans Feuil1, saisissez les SKU comme texte et les valeurs de mouvements comme nombres. Gardez les 28 colonnes et les deux séries de dix dates identiques. Ouvrez et enregistrez le classeur dans Excel pour recalculer Q et AB. Le modèle contient 100 lignes ; pour en ajouter, copiez les formules de total vers les nouvelles lignes. Le fichier entièrement vierge n’est pas un jeu de données à analyser.",
  },
  {
    question:
      "Pourquoi une valeur absente ou négative apparaît-elle dans les calculs ?",
    answer:
      "Une valeur numérique vide ou illisible est comptabilisée à zéro et signalée, ce qui n’atteste pas qu’elle valait réellement zéro. Les nombres négatifs sont conservés tels quels. Ils ne sont ni effacés ni automatiquement qualifiés de retour : vérifiez le fichier source et la vue Qualité des données.",
  },
  {
    question: "Que contient l’export CSV ?",
    answer:
      "Toutes les références de la sélection en cours, dans l’ordre du tri, pas seulement les 12 lignes de la page visible. L’export contient le SKU, le fournisseur, la catégorie et sa provenance, le stock source, l’état et les sommes de la période. Il ne contient ni les graphiques ni le détail des dix mois ; conservez aussi le classeur source.",
  },
];
