# Changelog

> **🌐 Langues**
> [简体中文](CHANGELOG.md) · [English](CHANGELOG.en.md) · Français · [Русский](CHANGELOG.ru.md) · [Español](CHANGELOG.es.md) · [Português](CHANGELOG.pt.md)

Ce changelog consigne les changements notables de dsh-novel-forge (coquille de création tout-en-un pour DeepSeek Harness), selon [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et [Semantic Versioning](https://semver.org/).

## [0.3.1] - 2026-09-11

### Added
- **Guidage obligatoire par la route narrative (correction de la logique d'appel)** : quelle que soit la quantité de contenu fournie par l'utilisateur — même une seule phrase ou un seul paragraphe — il faut d'abord produire
  2 à 5 candidats « route narrative + plan d'ensemble », les présenter un par un à l'utilisateur pour qu'il choisisse, enregistrer le choix dans le projet, puis seulement générer le plan.
  - Nouvel outil `novel_forge_route_plan` : produit les candidats (plan d'ensemble / itinéraire par étapes / escalade du conflit principal / direction de fin / fils narratifs de bout en bout / compromis et risques / recommandation IA),
    accepte directement un `paragraph` (les mots de l'utilisateur) et approfondit automatiquement un document de projet trop mince ; renvoie `mustChoose=true` et la consigne « à présenter impérativement à l'utilisateur ».
  - Nouvel outil `novel_forge_choose_route` : enregistre la route choisie via `index` (numéro choisi par l'utilisateur) / `custom` (route définie par l'utilisateur) / `delegate` (l'utilisateur a explicitement autorisé l'IA à choisir) ;
    sans choix, renvoie `NEED_CHOICE` et interdit de décider à la place de l'utilisateur.
- **Étape de route côté moteur** (la version autonome est la source de vérité, déjà mise en miroir) : nouveau modèle `t_route_plan` + nouvelle action `route_plan` (stage=idea), document `routes` du projet
  (candidats + sélection), variable `{{routeText}}` injectée dans `t_outline_generate` / `t_outline_extend`.
- **Brouillon et listes** : l'export `manuscript` gagne une section « route narrative et plan d'ensemble » ; la liste des projets indique le statut de route ; la page des idées gagne une carte des routes candidates (sélectionner / adopter la recommandation IA / régénérer).

- **Candidats produits par la session (pour garantir la qualité du guidage)** : lorsque le moteur ne dispose que du moteur de simulation hors ligne (ou que l'appel au moteur échoue), `novel_forge_route_plan` renvoie
  `mode:'session'` + une spécification de champs, et c'est le modèle de la session qui produit lui-même 2 à 5 routes candidates (pour éviter les textes de substitution « (simulation) »), avant enregistrement via
  `novel_forge_choose_route(routes=[…], index/custom/delegate)` ; le paramètre `source` peut forcer `engine` / `session` / `auto`.
- **Interdiction de décider à la place de l'utilisateur** : `novel_forge_choose_route` renvoie `NEED_CHOICE` en l'absence de choix ; `delegate=true` exige les mots d'autorisation de l'utilisateur
  (`note`), sinon la réponse est `NEED_AUTHORIZATION`.

### Changed
- **Verrou (contraignant)** : tant qu'aucune route n'est choisie, `novel_forge_develop_project(stage=outline)` et `novel_forge_chain(mode=full)` renvoient directement
  `NEED_ROUTE` et refusent de s'exécuter (seul un utilisateur demandant explicitement de « passer le guidage » peut transmettre `allowUnrouted=true`, et le résultat est alors signalé comme non guidé).
- Les autres étapes (flesh/world/characters) restent accessibles, mais avec un rappel « route pas encore choisie » ; `novel_forge_read_project` gagne une vue `routes`.
- Le pipeline sans surveillance `full` insère désormais d'abord une étape `route_plan`, et le plan s'appuie sur la route recommandée par l'IA (en présence d'une personne, mieux vaut choisir manuellement d'abord).
- Nombre total d'outils de session 18 → 20 (14 `novel_forge_*` + 6 `novel_forge_cap_*`) ; modèles 24 → 25 ; actions du moteur 18 → 19.
- Version du plugin 0.3.0 → 0.3.1 (moteur synchronisé sur 0.4.1).

### Fixed
- Correction du défaut de logique d'appel où « l'utilisateur ne donne qu'un paragraphe et le plan est généré directement, sans aucun contrôle » : le choix de la route devient un préalable obligatoire au plan, et le prompt du plan porte toujours la route sélectionnée, ce qui évite les plans décousus.

### Verify
- Auto-tests du plugin entièrement verts : standalone 10/10 · apply 9/9 · tools 46/46 (dont le verrou `NEED_ROUTE`, `NEED_AUTHORIZATION`, et le cas « un paragraphe / moteur de simulation passe par le guidage »).
- Côté moteur : `test-route.js` 17/17 · `test-gen.js` 43/43 · `test-api.js` 26/26 · `test-pipeline.js` 21/21 · `acceptance.js` 20/20 · rendu 9/9 · interaction 11/11.
- Miroir du moteur `engine-mirror verify` : source/plugin 32 vs 32, zéro dérive.

## [0.3.0] - 2026-09-07

### Added
- **Montée en puissance des capacités** : le plugin est désormais positionné comme une « coquille de création tout-en-un », qui héberge le NovelForge embarqué comme un ensemble de capacités géré, avec l'ajout de trois catégories de capacités (content / doc / email), toutes invoquées via un moteur de génération/application unifié.
- **Nouveaux outils de session de capacités (6)** : `novel_forge_capabilities`, `novel_forge_cap_create`, `novel_forge_cap_set_source`, `novel_forge_cap_analyze`, `novel_forge_cap_run`, `novel_forge_cap_read`.
- **Extension des services** : `ctx.novelForge.capabilities()` renvoie la liste des capacités (novel/content/doc/email et actions).
- **Miroir du cadre des capacités du moteur** : registre de `app/server/capabilities.js`, champ `cap` du projet, `/api/capabilities`, `/api/projects/:id/workspace`.
- **Multilingue** : i18n du front-end (`app/public/js/i18n.js`, chinois/anglais complets + français/russe/espagnol/portugais avec repli sur le chinois), sélecteur de langue dans la barre supérieure ; le champ `language` du projet prend en charge l'écriture dans n'importe quelle langue cible.
- **Atelier web de capacités** : `app/public/js/views/capStudio.js`.

### Changed
- Nombre total d'outils de session passé de 12 → 18 (12 outils de roman `novel_forge_*` + 6 outils de capacités `novel_forge_cap_*`).
- Nombre total d'actions du moteur (étapes de novel + actions de capacités) ; modèles passés de 18 → 24.
- Les textes d'interface du front-end sont entièrement basculés sur `t()` (base zh, repli sur le chinois pour les clés non couvertes).
- Version du plugin 0.2.0 → 0.3.0 (moteur synchronisé sur 0.4.0).

### Fixed
- Mise à jour des assertions d'auto-test du plugin pour correspondre aux nouveaux nombres de capacités (24 modèles / 18 outils).
- Correction de 3 erreurs d'équilibrage des parenthèses ESM introduites par le miroir des outils de capacités (vues `bible/audit/outline` dans app).

### Verify
- Auto-tests du plugin entièrement verts : standalone 8/8 · apply 9/9 · tools 26/26.
- Miroir du moteur `engine-mirror verify` : source/plugin 32 vs 32, zéro dérive.

## [0.2.0] - 2026-09-06

### Added
- Première mise en forme de la plugification (pack composé DSH) : miroir du moteur embarqué + service de cycle de vie `novelForge` + 12 outils de session `novel_forge_*`.
- Correction de deux problèmes d'exécution critiques sous hôte Electron : `process.execPath` n'est pas node, et le logger de l'hôte ne dispose pas de `.log`.
- `resolveNode()` gère les différences d'hôte bureau (Electron)/CLI ; couche de configuration `cordis.patch.yml` (lignes de service + lignes d'outils).
- Auto-vérification du montage `check-mount.bat` → `mount-check-report.txt`.

### Fixed
- (aucun défaut préexistant enregistré ; cette version est le point de départ traçable).

[0.3.1]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.3.1
[0.3.0]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.3.0
[0.2.0]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.2.0
