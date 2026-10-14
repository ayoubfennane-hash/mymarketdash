# Catégories issues de MYMARKET.ma

Les intitulés sont ceux des rayons affichés par la [boutique MYMARKET.ma](https://www.mymarket.ma/) : Marché et Boucherie, Boissons, Épicerie salée, Épicerie sucrée, Petit Déjeuner, Hygiène et Beauté, Entretien et Maison, Pains et Pâtisserie, Bébé et Animaux. La collection générale Alimentation est conservée lorsqu’un produit n’appartient à aucun de ces rayons plus précis. [1] [2]

Le classeur ne contient pas de colonne catégorie. Le catalogue public fournit cependant les produits et SKU pour chaque collection. Les produits du classeur sont rapprochés par **SKU exact**, puis par **titre identique après normalisation des accents et de la ponctuation** lorsqu’aucun SKU fiable ne correspond. Aucune attribution par mots-clés, fournisseur ou rapprochement approximatif n’est utilisée. Un SKU ambigu est désambiguïsé par le titre ou laissé sans classement fiable.

L’application conserve les appartenances multiples du site : un produit peut être dans plusieurs rayons. Chaque produit n’est compté qu’une fois dans les indicateurs globaux ; il est compté dans chacun de ses rayons dans le graphique de répartition. Les nombres par rayon ne doivent donc pas être additionnés pour retrouver le nombre total de références.

Les références sans correspondance sont placées dans **« À classer »**. La fiche produit précise la méthode de correspondance et donne un lien vers la fiche officielle lorsqu’il existe. Les collections transversales « Bio », « Gluten Free », « Promos » et « Nouveautés » ne sont pas transformées en rayons exclusifs.

La consultation des collections est en lecture seule. Les prix, stocks, montants et mouvements du classeur demeurent inchangés. Les données de classement sont un instantané du catalogue public, pas une synchronisation permanente de la boutique. Le script `scripts/sync_categories.py` permet de renouveler cet instantané. Les imports Excel de même structure sont rapprochés avec cet index local ; aucun fichier importé n’est envoyé au site MyMarket.ma.

## Sources

[1]: https://www.mymarket.ma/ "Navigation et rayons de la boutique MYMARKET.ma"
[2]: https://www.mymarket.ma/collections/alimentation "Collection générale Alimentation"
[3]: https://www.mymarket.ma/collections/marche-et-boucherie "Collection Marché et Boucherie"
[4]: https://www.mymarket.ma/collections/bebe "Collection Bébé"

Les URL des collections interrogées et la date UTC de consultation sont également enregistrées dans `src/catalog-categories.json` et affichées dans la vue « Qualité des données ».
