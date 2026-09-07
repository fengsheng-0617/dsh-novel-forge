# Changelog

> **🌐 Idiomas**
> [简体中文](CHANGELOG.md) · [English](CHANGELOG.en.md) · [Français](CHANGELOG.fr.md) · [Русский](CHANGELOG.ru.md) · [Español](CHANGELOG.es.md) · Português

Este changelog registra as mudanças notáveis do dsh-novel-forge (concha de criação tudo-em-um para DeepSeek Harness) seguindo [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e [Versionamento Semântico](https://semver.org/).

## [0.3.0] - 2026-09-07

### Added
- **Atualização para capacidades**: o plugin foi reposicionado como «concha de criação tudo-em-um», passando a hospedar o NovelForge incorporado como um conjunto de capacidades, além de novas capacidades de conteúdo / doc / e-mail, todas invocadas por meio do mecanismo unificado de geração/aplicação.
- **Novas ferramentas de sessão de capacidades (6)**: `novel_forge_capabilities`, `novel_forge_cap_create`, `novel_forge_cap_set_source`, `novel_forge_cap_analyze`, `novel_forge_cap_run`, `novel_forge_cap_read`.
- **Extensão do serviço**: `ctx.novelForge.capabilities()` retorna a lista de capacidades (novel/content/doc/email e ações).
- **Espelhamento da estrutura de capacidades do mecanismo**: registro em `app/server/capabilities.js`, campo `cap` do projeto, `/api/capabilities`, `/api/projects/:id/workspace`.
- **Multilíngue**: i18n do front-end (`app/public/js/i18n.js`, chinês/inglês completos + francês/russo/espanhol/português com fallback para chinês), seletor de idioma na barra superior; o campo `language` do projeto suporta escrita em qualquer idioma-alvo.
- **Workbench de capacidades na web**: `app/public/js/views/capStudio.js`.

### Changed
- Total de ferramentas de sessão de 12 → 18 (12 ferramentas de romance `novel_forge_*` + 6 ferramentas de capacidades `novel_forge_cap_*`).
- Total de ações do mecanismo (fases de novel + ações de capacidades); modelos de 18 → 24.
- Textos da UI do front-end totalmente integrados ao `t()` (base zh, chaves não cobertas com fallback para chinês).
- Versão do plugin 0.2.0 → 0.3.0 (sincronizada com o mecanismo 0.4.0).

### Fixed
- Asserções de autoteste do plugin atualizadas para os novos números de capacidades (24 conjuntos de modelos / 18 ferramentas).
- Corrigidos 3 erros de equilíbrio de parênteses ESM introduzidos pelo espelhamento das ferramentas de capacidades (visualizações `bible/audit/outline` no app).

### Verify
- Autotestes do plugin todos verdes: standalone 8/8 · apply 9/9 · tools 26/26.
- Espelhamento do mecanismo `engine-mirror verify`: origem/plugin 32 vs 32 sem desvio.

## [0.2.0] - 2026-09-06

### Added
- Primeira pluginização estruturada (pacote DSH): espelho do mecanismo incorporado + serviço de ciclo de vida `novelForge` + 12 ferramentas de sessão `novel_forge_*`.
- Corrigidos dois problemas de tempo de execução críticos no host Electron: `process.execPath` não sendo node e logger do host sem `.log`.
- `resolveNode()` trata as diferenças entre hosts desktop (Electron)/CLI; camada de configuração `cordis.patch.yml` (linhas de serviço + linhas de ferramentas).
- Autoverificação de montagem `check-mount.bat` → `mount-check-report.txt`.

### Fixed
- (Sem defeitos anteriores registrados; esta versão é o ponto inicial rastreável).

[0.3.0]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.3.0
[0.2.0]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.2.0
