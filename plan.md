# MYMARKET — Extension cloud privée des imports

L’utilisateur a confirmé le 16 octobre 2026 la connexion par compte Manus et l’activation à sens unique du serveur et de la base gérée. Le site existant conserve son interface française, ses calculs Excel, la base de catégories CSV et le mode invité local. Un compte connecté doit retrouver son dernier classeur validé sur un autre appareil après connexion au même compte dans ce projet. GitHub ne stocke que le code et les fichiers de référence déjà livrés, pas les nouveaux imports personnels.

## Implémentation

Le frontend React/Vite est conservé. Un serveur Express reçoit les API, fournit OAuth Manus réel et valide les sessions `webdev_app_session` signées par le secret de projet, avec expiration et projet vérifiés. Une clé CSRF de session protège les écritures. Le retour OAuth est lié à une valeur aléatoire à usage unique et à une adresse frontend explicite, sans se baser sur l’hôte interne du proxy. Les cookies HTTPS sont `HttpOnly`, `Secure`, `SameSite=None` pour l’aperçu embarqué.

Une table MySQL additive `mymarket_private_workbooks` contient une ligne par identité Manus (`openId`), le nom original, les octets du classeur, la taille, son SHA-256 et la date d’enregistrement. Une clé unique par compte et des requêtes paramétrées isolent lecture et remplacement. Le serveur et le navigateur bornent le fichier à 10 Mo, les archives XLSX à 24 Mo décompressés (16 Mo par élément), les feuilles à 10, les produits à 10 000 lignes et les cellules à 300 000; un classeur XLSX est inspecté avant SheetJS. Le parseur exige le schéma exact à 28 colonnes, ses totaux Q/AB et deux séries identiques de dix mois consécutifs. Une transaction sérialisée par compte puis une comparaison de SHA empêchent qu’une première sauvegarde concurrente écrase l’autre. Les données ne sont ni écrites dans Git, ni fournies par un chemin public. L’ancien import cloud n’est remplacé qu’après validation et commit. La déconnexion ne supprime pas le classeur cloud.

Au démarrage, la session authentifiée est résolue avant le choix des données. Un compte connecté lit son dernier fichier cloud en priorité. Le visiteur non connecté garde l’IndexedDB existant. Le compte peut enregistrer explicitement un import local préexistant dans son espace privé; aucun ancien fichier local n’est téléversé sans cette action. Le dernier import cloud est restaurable et téléchargeable par son propriétaire. L’échec réseau garde les données précédentes, n’annonce pas de faux succès, et offre une nouvelle tentative. Le retour au fichier de référence change seulement l’analyse et ne supprime pas l’import cloud. Les filtres restent locaux et se réinitialisent au chargement du classeur.

## Structure

- `server/auth.ts` : OAuth, sessions signées et protection CSRF.
- `server/repository.ts`, `server/migrate.ts` : connexion MySQL, migration additive et accès au dernier classeur par propriétaire; verrou nommé MySQL par compte et compare-and-swap.
- `server/app.ts`, `server/index.ts` : API privées, validation des imports, serveur Express avec Vite en développement et assets compilés en production.
- `src/cloudClient.ts`, `src/AccountPanel.tsx` : client HTTP relatif, statut du compte et actions de sauvegarde/restauration.
- `src/App.tsx`, `src/xlsxLimits.ts` : restauration initiale et import branchés sur le mode compte ou invité; limites ZIP communes avant le parseur et validations Excel exactes.
- `tests/` : contrôles des permissions, CSRF, OAuth, validation et isolation entre deux comptes; tests locaux existants conservés.
- `Dockerfile` : build épinglé et serveur de production; migration explicitement exécutée, health endpoint distinct.

## Design conservé

**Mouvement :** tableau de bord éditorial, sobriété des outils d’analyse. **Principes :** lisibilité des chiffres, provenance visible, actions sobres, distinction claire entre local et cloud. **Couleurs :** vert de confiance pour une sauvegarde confirmée, teintes neutres pour le mode invité, ambre pour une erreur de synchronisation. **Structure :** menu latéral conservé et bandeau de compte sous le titre, plutôt qu’une nouvelle grille centrale. **Signatures :** titres éditoriaux, filets fins et capsules de provenance. **Interaction :** sauvegarde explicite pour les fichiers locaux préexistants, connexion réelle, aucun transfert caché. **Animation :** uniquement progression de chargement et transitions d’état discrètes; réduction pour `prefers-reduced-motion`. **Typographie :** hiérarchie et polices actuelles conservées. **Marque :** MYMARKET, analyse claire et personnelle du magasin; précis, fiable, sobre. **Voix :** « Enregistré dans votre espace privé » et « Connectez-vous sur un autre appareil pour retrouver ce classeur ». **Logo :** signe MYMARKET existant. **Couleur signature :** vert MYMARKET existant.
