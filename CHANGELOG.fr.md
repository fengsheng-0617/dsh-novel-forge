# Changelog

> **🌐 Langues**
> [简体中文](CHANGELOG.md) · [English](CHANGELOG.en.md) · Français · [Русский](CHANGELOG.ru.md) · [Español](CHANGELOG.es.md) · [Português](CHANGELOG.pt.md)

Ce changelog consigne les changements notables de dsh-novel-forge (coquille de création tout-en-un pour DeepSeek Harness), selon [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et [Semantic Versioning](https://semver.org/).

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

[0.3.0]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.3.0
[0.2.0]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.2.0
