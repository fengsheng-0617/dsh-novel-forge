# Changelog

> **🌐 Idiomas**
> [简体中文](CHANGELOG.md) · [English](CHANGELOG.en.md) · [Français](CHANGELOG.fr.md) · [Русский](CHANGELOG.ru.md) · [Español](CHANGELOG.es.md) · Português

Este changelog registra as mudanças notáveis do dsh-novel-forge (concha de criação tudo-em-um para DeepSeek Harness) seguindo [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e [Versionamento Semântico](https://semver.org/).

## [0.3.1] - 2026-09-11

### Added
- **Orientação obrigatória por rota narrativa (plano geral do esboço) (correção da lógica de chamada)**: não importa quanto conteúdo o usuário forneça — mesmo que seja só uma frase ou um parágrafo —, é obrigatório primeiro produzir
  2~5 candidatas de «rota narrativa + plano geral do esboço», apresentá-las uma a uma ao usuário para que ele escolha e, depois de gravada a escolha no projeto, gerar o esboço.
  - Nova ferramenta `novel_forge_route_plan`: produz as candidatas (plano geral / rota por etapas / escalada do conflito principal / direção do desfecho / indícios recorrentes / trade-offs e riscos / recomendação da IA),
    aceita receber diretamente `paragraph` (as palavras do próprio usuário) e aprofunda automaticamente o projeto quando ele está raso demais; retorna `mustChoose=true` e a instrução de «mostrar obrigatoriamente ao usuário».
  - Nova ferramenta `novel_forge_choose_route`: grava a rota selecionada por `index` (o número escolhido pelo usuário) / `custom` (rota personalizada do usuário) / `delegate` (o usuário autorizou explicitamente a IA a escolher);
    sem escolha, retorna `NEED_CHOICE` — não é permitido decidir no lugar do usuário.
- **Etapa de rota no mecanismo** (a versão independente é a fonte verdadeira, já espelhada): novo modelo `t_route_plan` + nova ação `route_plan` (stage=idea), documento `routes` do projeto
  (candidatas + selecionada) e a variável `{{routeText}}` injetada em `t_outline_generate` / `t_outline_extend`.
- **Rascunho e listagens**: a exportação `manuscript` ganhou o bloco «rota narrativa e plano geral do esboço»; a lista de projetos traz o status da rota; a página de ideias ganhou o cartão de rotas candidatas (selecionar / adotar a recomendação da IA / gerar outra leva).
- **Candidatas geradas pela própria sessão (para garantir a qualidade da orientação)**: quando o mecanismo está configurado apenas com o motor de simulação offline (ou a chamada ao mecanismo falha), `novel_forge_route_plan` passa a retornar
  `mode:'session'` + a especificação dos campos, e o próprio modelo da sessão produz as 2~5 rotas candidatas (evitando textos de preenchimento «(simulação)»), que depois são gravadas por
  `novel_forge_choose_route(routes=[…], index/custom/delegate)`; o parâmetro `source` permite forçar `engine` / `session` / `auto`.
- **Impedir decisões no lugar do usuário**: `novel_forge_choose_route` retorna `NEED_CHOICE` quando não há escolha; `delegate=true` exige as palavras de autorização do usuário
  (`note`), caso contrário retorna `NEED_AUTHORIZATION`.

### Changed
- **Portão de entrada (obrigatório)**: sem rota selecionada, `novel_forge_develop_project(stage=outline)` e `novel_forge_chain(mode=full)` retornam
  `NEED_ROUTE` e recusam a execução (somente quando o usuário pede explicitamente para «pular a orientação» é possível passar `allowUnrouted=true`, e o resultado é marcado como não orientado).
- As demais etapas (flesh/world/characters) continuam avançando, mas com o lembrete «rota ainda não selecionada»; `novel_forge_read_project` ganhou a visualização `routes`.
- O pipeline sem supervisão `full` agora insere antes uma etapa `route_plan`, e o esboço tem a rota recomendada pela IA como diretriz (com uma pessoa presente, a escolha ainda deve ser feita manualmente).
- Total de ferramentas de sessão 18 → 20 (14 `novel_forge_*` + 6 `novel_forge_cap_*`); modelos 24 → 25; ações do mecanismo 18 → 19.
- Versão do plugin 0.3.0 → 0.3.1 (sincronizada com o mecanismo 0.4.1).

### Fixed
- Corrigido o defeito de lógica de chamada em que «o usuário fornece apenas um parágrafo e o esboço é gerado na hora, sem ninguém validar»: a escolha da rota passa a ser pré-condição obrigatória do esboço, e o prompt do esboço sempre carrega a rota selecionada, evitando que o esboço se disperse.

### Verify
- Autotestes do plugin todos verdes: standalone 10/10 · apply 9/9 · tools 46/46 (incluindo o portão `NEED_ROUTE`, o `NEED_AUTHORIZATION` e o caso «um parágrafo / mecanismo de simulação percorre toda a orientação»).
- Lado do mecanismo: `test-route.js` 17/17 · `test-gen.js` 43/43 · `test-api.js` 26/26 · `test-pipeline.js` 21/21 · `acceptance.js` 20/20 · renderização 9/9 · interação 11/11.
- Espelhamento do mecanismo `engine-mirror verify`: origem/plugin 32 vs 32 sem desvio.

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

[0.3.1]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.3.1
[0.3.0]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.3.0
[0.2.0]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.2.0
