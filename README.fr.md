# dsh-novel-forge —— Outil de création IA « tout-en-un » pour DeepSeek Harness (encapsulé en capacités)

> **🌐 Langues** — [简体中文](README.md) · [English](README.en.md) · Français · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md)
> Nouveautés : voir [CHANGELOG](CHANGELOG.md)

> Transforme « 织文 NovelForge » en **coquille de création tout-en-un pour DeepSeek Harness (multi-capability studio)** :
> dans une seule conversation, accomplis **l'écriture de romans / l'imitation·la continuation·la réécriture de textes / la rédaction de résolutions du Conseil de sécurité / la rédaction d'e-mails académiques de prise de contact**, avec en plus le support de l'**écriture multilingue**.

Le moteur devient un **plugin bundle** de Harness, et voici comment cela fonctionne :
**toute la création se fait dans la conversation/zone de travail de harness** — le modèle détecte l'intention puis appelle directement les outils (pour les romans `novel_forge_*`,
pour le contenu/documents officiels/e-mails `novel_forge_cap_*`), et les résultats ainsi que l'aperçu du texte reviennent tous dans la conversation. **Aucun navigateur n'est nécessaire** ;
l'application web intégrée ne sert que d'interface visuelle optionnelle (outils et web partagent les mêmes données et se synchronisent mutuellement).

---

> **🌐 Langues**
> [简体中文](README.md) · [English](README.en.md) · Français · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md)
> Nouveautés : voir [CHANGELOG](CHANGELOG.md)

---

## Français

### « Capacités » (capabilities) proposées

Le moteur embarque un registre de capacités `capabilities.js` ; à la création d'un projet on renseigne `cap`, et les différentes capacités passent par le même moteur unifié de génération/application :

| Capacité `cap` | Nom | Description | Action de génération |
|---|---|---|---|
| `novel` | Écriture de romans | idée→cadre→personnages→plan→écriture par chapitres→relecture→export (par défaut) | `idea/bible/characters/outline/chapter/audit_*` |
| `content` | Contenu textuel | coller le texte source → analyser → imiter / continuer / réécrire | `content_analyze / content_imitate / content_continue / content_rewrite` |
| `doc` | Document officiel | rédaction de résolution du Conseil de sécurité de l'ONU | `doc_resolution` |
| `email` | Communication académique | rédaction d'e-mails académiques de prise de contact | `email_cold` |

**Multilingue** : le projet peut définir `language` (zh/en/fr/ru/es/pt ou n'importe quelle langue) ; le moteur injecte l'exigence de la langue cible dans les consignes d'écriture ;
l'interface utilisateur frontale comprend un sélecteur de langue (barre supérieure) prenant en charge le chinois/anglais/français/russe/espagnol/portugais (les langues non traduites retombent sur le chinois).

### Installation (au choix parmi trois)

Lorsque le CLI `dsh` est disponible (dans le checkout du code source, `pnpm dsh`) :

```sh
# 1) Installer directement le répertoire local (recommandé pour le débogage)
dsh plugin add F:\typing\novel-forge-plugin

# 2) Empaqueter en tarball pour la distribution (sans privilège de compilation)
pnpm pack   # obtient dsh-novel-forge-0.3.0.tgz
dsh plugin add ./dsh-novel-forge-0.3.0.tgz

# 3) Ou l'essayer directement en overlay --patch (sans ouvrir de profil)
dsh --patch F:\typing\novel-forge-plugin\cordis.patch.yml --patch-argv
```

> Si pnpm ≥10 exige une autorisation pour les scripts de compilation des dépendances git : ce paquet n'a aucun script de compilation, il suffit de distribuer directement le code source.

### Services proposés

| Membre | Description |
|---|---|
| `ctx.novelForge.url` | Adresse d'accès une fois prêt (p. ex. http://127.0.0.1:54321) |
| `ctx.novelForge.status` | `running` / `stopped` |
| `ctx.novelForge.start()` | Démarrage manuel (choisit automatiquement un port libre, attend que la vérification de santé passe) |
| `ctx.novelForge.stop()` | Arrête le sous-processus |
| `ctx.novelForge.describe()` | Informations sur l'application et journaux récents |
| `ctx.novelForge.capabilities()` | Liste des capacités (novel/content/doc/email et leurs actions) |

### Outils de conversation pour romans (novel_forge_*, 12 au total)

L'agent hôte les appelle automatiquement dès qu'il détecte une intention d'écriture de roman ; **tout le travail s'effectue dans la conversation, sans ouvrir de navigateur**.

| Outil | Usage |
|---|---|
| `novel_forge_status` | État du moteur + liste des projets (généralement la première étape) |
| `novel_forge_new_project` | Créer une nouvelle œuvre (renvoie `projectId`) |
| `novel_forge_seed_idea` | Consigne l'idée de l'utilisateur dans une carte d'idées |
| `novel_forge_ideate` | Remue-méninges IA des idées candidates (après sélection, seed) |
| `novel_forge_develop_project` | Avancer de phase : flesh/world/characters/outline/audit (les écrasements exigent confirmation) |
| `novel_forge_read_project` | Lire la progression/le plan/les personnages/**le texte des chapitres**, pour relecture et décision dans la conversation |
| `novel_forge_write_chapter` | Écrire le texte du chapitre N et archiver automatiquement la mémoire (renvoie l'aperçu du texte ; les chapitres déjà écrits exigent confirmation) |
| `novel_forge_edit_chapter` | Peaufiner un chapitre déjà écrit : rewrite/réécrire · polish/peaufiner · continue/continuer · summarize/archiver |
| `novel_forge_extend_outline` | Ajouter N chapitres au plan (étend automatiquement les chapitres en poursuivant une œuvre longue) |
| `novel_forge_chain` | Sans surveillance : full=compléter jusqu'à l'œuvre entière / write=écrire les chapitres restants |
| `novel_forge_export` | Exportation md/manuscript/txt/json ; **le texte intégral revient directement dans la conversation** (peut être tronqué) |
| `novel_forge_remove_project` | Supprimer un projet (exige confirmation de l'utilisateur) |

### Outils de conversation pour capacités (capability_*, nouveaux)

Ils gèrent les travaux textuels autres que les romans. Tout s'effectue dans la conversation.

| Outil | Usage |
|---|---|
| `novel_forge_capabilities` | Lister les capacités et actions disponibles |
| `novel_forge_cap_create` | Créer un projet de capacité (cap=content/doc/email, peut accepter language) |
| `novel_forge_cap_set_source` | Consigner le texte source/le brouillon/le sujet et les paramètres |
| `novel_forge_cap_analyze` | Analyser le texte source (sujet/style/structure/personnages/thème) |
| `novel_forge_cap_run` | Exécuter imitate/continue/rewrite/doc/email ; renvoie l'aperçu |
| `novel_forge_cap_read` | Lire la vue d'ensemble du projet / le texte source / la liste des sorties (possibilité de préciser index pour voir l'intégralité) |

Tous les résultats des outils portent la sémantique `ok/code/error` (telle que `NEED_CONFIRM`, etc.) ; le modèle s'en sert pour demander confirmation à l'utilisateur et ne remplace jamais silencieusement une création existante.

### Options configurables (cordis.patch.yml → config)

- `port` : port fixe ; `0` = choisir automatiquement un port libre (par défaut)
- `host` : par défaut `127.0.0.1` (données/clés uniquement sur la machine locale ; pour un accès au réseau local, passe à `0.0.0.0` à tes propres risques)
- `autoStart` : lancement automatique au démarrage de l'hôte (par défaut `true`)
- `startTimeoutMs` : délai d'attente de la vérification de santé (par défaut 20000)
- `dataDir` : répertoire de données (relatif à `app/` ou chemin absolu ; défaut `app/data`, isolé de l'hôte, persisté avec le paquet)

### Exigences d'environnement et remarques

- Nécessite un **Node ≥ 18.17** disponible sur la machine hôte (le plugin lance le sous-processus du moteur sans interface à l'aide de l'exécutable `node` courant).
- Forme d'utilisation : **la conversation de harness est l'interface principale** ; l'interface web vers laquelle pointe `ctx.novelForge.url` n'est qu'un éditeur visuel optionnel,
  partageant les mêmes données que les outils, ouvrable à tout moment pour comparaison, mais **elle n'est pas un prérequis d'utilisation**.
- Au premier démarrage sont créés automatiquement l'exemple intégré, le roman « La Lettre du port de brume », ainsi que les préréglages de 12 fournisseurs de modèles (dont un moteur de simulation hors ligne, permettant d'expérimenter tout le flux sans aucune clé).
- Les clés API des modèles sont stockées en texte clair dans `app/data/settings.json` (usage local et personnel ; ne pas déployer dans un environnement non fiable).

### Autocontrôle

```sh
node scripts/test-standalone.mjs   # cycle de vie complet de launchNovelForge
node scripts/test-apply.mjs        # point d'entrée apply() (enregistrement du service/démarrage et arrêt)
node scripts/engine-mirror.mjs verify   # vérification d'écart nul du miroir du moteur
```
