# dsh-novel-forge —— ferramenta de criação completa com IA do DeepSeek Harness (empacotada como capacidades)

> **🌐 Idiomas** — [简体中文](README.md) · [English](README.en.md) · [Français](README.fr.md) · [Русский](README.ru.md) · [Español](README.es.md) · Português
> Novidades: ver [CHANGELOG](CHANGELOG.md)

> Leva o «织文 NovelForge» (NovelForge) ao nível de **concha de criação tudo-em-um (multi-capability studio) do DeepSeek Harness**:
> numa única sessão realize **criação de romances / imitação · continuação · reescrita de textos / redação de resolução do Conselho de Segurança / e-mails acadêmicos de contato**, com suporte para **escrita em vários idiomas**.

Transformar o motor em um **plugin bundle (combo de capacidades)** do Harness, na forma de trabalho:
**toda a criação acontece dentro da sessão/área de trabalho do harness** — o modelo detecta a intenção e chama diretamente as ferramentas (para romance, `novel_forge_*`;
para conteúdo/documento/e-mail, `novel_forge_cap_*`), e os resultados com a pré-visualização do texto voltam todos para a sessão. **Não é preciso abrir nenhum navegador**;
o aplicativo web embutido serve apenas como uma interface visual opcional (as ferramentas e a página compartilham os mesmos dados e se sincronizam mutuamente).

---

> **🌐 Idiomas**
> [简体中文](README.md) · [English](README.en.md) · [Français](README.fr.md) · [Русский](README.ru.md) · [Español](README.es.md) · Português
> Novidades: ver [CHANGELOG](CHANGELOG.md)

---

## Português

### Capacidades fornecidas

O motor traz um registro de capacidades (`capabilities.js`); na criação do projeto é indicado o `cap`,
e as diferentes capacidades passam pelo mesmo motor unificado de geração/aplicação:

| Capacidade `cap` | Nome | Descrição | Ações de geração |
|---|---|---|---|
| `novel` | Criação de romance | ideia→bíblia→personagens→esboço→escrita por capítulos→revisão→exportação (padrão) | `idea/bible/characters/outline/chapter/audit_*` |
| `content` | Conteúdo de texto | colar o texto original → analisar → imitar / continuar / reescrever | `content_analyze / content_imitate / content_continue / content_rewrite` |
| `doc` | Documento formal | redação de resolução do Conselho de Segurança | `doc_resolution` |
| `email` | Comunicação acadêmica | edição de e-mails acadêmicos de contato | `email_cold` |

**Multilíngue**: o projeto pode definir `language` (zh/en/fr/ru/es/pt ou qualquer idioma); o motor injeta
o requisito de idioma-alvo nas instruções de escrita. A interface web inclui um seletor de idioma (barra
superior), com suporte para chinês/inglês/francês/russo/espanhol/português (idiomas não traduzidos recaem no chinês).

### Instalação (uma de três opções)

Quando o CLI `dsh` estiver disponível (dentro do checkout do código-fonte, `pnpm dsh`):

```sh
# 1) Instalar diretamente um diretório local (recomendado para depuração)
dsh plugin add F:\typing\novel-forge-plugin

# 2) Empacotar como tarball para distribuição (sem exigir permissão de build)
pnpm pack   # gera dsh-novel-forge-0.3.1.tgz
dsh plugin add ./dsh-novel-forge-0.3.1.tgz

# 3) Ou experimentar direto como overlay --patch (sem abrir profile)
dsh --patch F:\typing\novel-forge-plugin\cordis.patch.yml --patch-argv
```

> Se o pnpm ≥10 exigir autorização de scripts de build para dependências git: este pacote não possui nenhum script de build — basta distribuir o código-fonte.

### Serviços fornecidos

| Membro | Descrição |
|---|---|
| `ctx.novelForge.url` | Endereço de acesso após a prontidão (ex.: http://127.0.0.1:54321) |
| `ctx.novelForge.status` | `running` / `stopped` |
| `ctx.novelForge.start()` | Inicialização manual (escolhe automaticamente uma porta livre e aguarda a verificação de integridade ser aprovada) |
| `ctx.novelForge.stop()` | Encerra o processo filho |
| `ctx.novelForge.describe()` | Informações do aplicativo e logs recentes |
| `ctx.novelForge.capabilities()` | Lista de capacidades (novel/content/doc/email e ações) |

### Ferramentas de conversa/sessão para romances (`novel_forge_*`, 12 no total)

O Agent hospedeiro as chama automaticamente ao detectar a intenção de criar um romance; **todo o trabalho
é concluído dentro da sessão, sem necessidade de abrir um navegador**.

| Ferramenta | Uso |
|---|---|
| `novel_forge_status` | Status do motor + lista de projetos (normalmente o primeiro passo) |
| `novel_forge_new_project` | Criar nova obra (retorna projectId) |
| `novel_forge_seed_idea` | Gravar a ideia do usuário no cartão de ideias |
| `novel_forge_ideate` | Brainstorming de ideias candidatas por IA (após escolha, faz seed) |
| `novel_forge_develop_project` | Avançar fases: flesh/world/characters/outline/audit (sobrescrita exige confirmação) |
| `novel_forge_read_project` | Ler progresso/esboço/personagens/**texto do capítulo**, para leitura e decisão dentro da sessão |
| `novel_forge_write_chapter` | Escrever o texto do capítulo N e arquivar a memória automaticamente (retorna pré-visualização do texto; capítulo já escrito exige confirmação) |
| `novel_forge_edit_chapter` | Refinar capítulo já escrito: rewrite reescrever / polish aprimorar / continue continuar / summarize arquivar |
| `novel_forge_extend_outline` | Acrescentar N capítulos ao esboço (expandir capítulos automaticamente ao continuar obras longas) |
| `novel_forge_chain` | Sem supervisão: full=completar até a obra inteira / write=escrever os capítulos restantes |
| `novel_forge_export` | Exportar md/manuscript/txt/json, **com o texto completo retornado direto para a sessão** (pode ser truncado) |
| `novel_forge_remove_project` | Excluir projeto (exige confirmação do usuário) |

### Ferramentas de conversa/sessão de capacidades (`capability_*`, novas)

Tratam do trabalho com texto fora de romances. Tudo concluído dentro da sessão.

| Ferramenta | Uso |
|---|---|
| `novel_forge_capabilities` | Listar as capacidades e ações disponíveis |
| `novel_forge_cap_create` | Criar projeto de capacidade (cap=content/doc/email, pode incluir language) |
| `novel_forge_cap_set_source` | Gravar texto-fonte/borrão/tema e parâmetros |
| `novel_forge_cap_analyze` | Analisar o texto-fonte (tema/estilo/estrutura/personagens/tópico) |
| `novel_forge_cap_run` | Executar imitate/continue/rewrite/doc/email, retornando a pré-visualização |
| `novel_forge_cap_read` | Ler a visão geral do projeto / texto-fonte / lista de saídas (pode indicar index para ver por inteiro) |

Todos os resultados das ferramentas carregam semântica `ok/code/error` (como `NEED_CONFIRM` etc.);
com base nisso o modelo confirma com o usuário e nunca sobrescreve silenciosamente uma criação existente.

### Itens configuráveis (`cordis.patch.yml` → config)

- `port`: porta fixa; `0` = escolher automaticamente uma porta livre (padrão)
- `host`: padrão `127.0.0.1` (dados/chaves apenas nesta máquina; para acesso em rede local, mude para `0.0.0.0` por sua conta e risco)
- `autoStart`: subir automaticamente após o início do host (padrão `true`)
- `startTimeoutMs`: tempo limite da verificação de integridade (padrão 20000)
- `dataDir`: diretório de dados (relativo a `app/` ou caminho absoluto; padrão `app/data`, isolado do host e persistido junto com o pacote)

### Requisitos de ambiente e observações

- O host precisa ter **Node ≥ 18.17** disponível (o plugin usa o executável `node` atual para subir o subprocesso do motor sem interface).
- Forma de uso: **a sessão do harness é a interface principal**; a interface web apontada por `ctx.novelForge.url`
  é apenas um editor visual opcional, que compartilha os mesmos dados das ferramentas e pode ser aberto a
  qualquer momento para conferência, mas **não é um pré-requisito de uso**.
- Na primeira inicialização são criados automaticamente o exemplo embutido «Carta do Porto Nebuloso» e
  os presets de 12 fornecedores de modelos (incluindo um motor de simulação offline, permitindo experimentar todo o fluxo sem Key).
- As chaves de API dos modelos são salvas em texto simples em `app/data/settings.json` (uso pessoal/local; não implante em ambientes não confiáveis).

### Autoteste

```sh
node scripts/test-standalone.mjs   # ciclo de vida completo do launchNovelForge
node scripts/test-apply.mjs        # ponto de entrada apply() (registro/inicialização e encerramento de serviço)
node scripts/engine-mirror.mjs verify   # verificação de zero-drift do espelho do motor
```
