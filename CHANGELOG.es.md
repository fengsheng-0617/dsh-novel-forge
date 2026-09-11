# Changelog

> **🌐 Idiomas**
> [简体中文](CHANGELOG.md) · [English](CHANGELOG.en.md) · [Français](CHANGELOG.fr.md) · [Русский](CHANGELOG.ru.md) · Español · [Português](CHANGELOG.pt.md)

Este changelog registra los cambios destacados de dsh-novel-forge (entorno de creación todo-en-uno para DeepSeek Harness) siguiendo [Keep a Changelog](https://keepachangelog.com/es/1.1.0/) y [Versionado Semántico](https://semver.org/).

## [0.3.1] - 2026-09-11

### Added
- **Guía obligatoria de la ruta narrativa (planteamiento del esquema) (corrección de la lógica de llamada)**: sea cual sea el contenido que dé el usuario —aunque sea una sola frase o un solo párrafo—, primero hay que producir 2~5 candidatas de «ruta narrativa (planteamiento del esquema)», mostrárselas una por una al usuario para que elija, guardar la elección en el proyecto y solo entonces generar el esquema.
  - Nueva herramienta `novel_forge_route_plan`: produce las candidatas (planteamiento del esquema / ruta por etapas / escalada del conflicto principal / dirección del desenlace / presagios transversales / sacrificios y riesgos / recomendación de la IA);
    admite pasar directamente `paragraph` (las palabras del usuario) y profundiza automáticamente la premisa cuando el planteamiento del proyecto es demasiado escueto; devuelve `mustChoose=true` y la instrucción de «mostrárselas obligatoriamente al usuario».
  - Nueva herramienta `novel_forge_choose_route`: guarda la ruta seleccionada mediante `index` (el usuario eligió un número) / `custom` (ruta definida por el usuario) / `delegate` (el usuario autorizó explícitamente a la IA para elegir);
    si falta la elección devuelve `NEED_CHOICE` y no se permite decidir por el usuario.
- **Etapa de ruta en el motor** (la versión independiente es la fuente de verdad y ya está reflejada en el espejo): nueva plantilla `t_route_plan` + nueva acción `route_plan` (stage=idea), documento `routes` del proyecto (candidatas + seleccionada) y la variable `{{routeText}}` inyectada en `t_outline_generate` / `t_outline_extend`.
- **Borrador y listados**: la exportación `manuscript` incorpora el bloque «ruta narrativa y planteamiento del esquema»; la lista de proyectos incluye el estado de la ruta; la página de ideas incorpora una tarjeta de rutas candidatas (seleccionar / adoptar la recomendación de la IA / generar otro lote).

- **Candidatas producidas por la propia conversación (para garantizar la calidad de la guía)**: cuando el motor solo tiene el motor de simulación sin conexión (o falla la llamada al motor), `novel_forge_route_plan` pasa a devolver `mode:'session'` + la especificación de campos, y es el propio modelo de la conversación quien produce las 2~5 candidatas de ruta (evitando textos de relleno como «(simulación)»), que después se guardan con `novel_forge_choose_route(routes=[…], index/custom/delegate)`; el parámetro `source` puede forzar `engine` / `session` / `auto`.
- **Evitar decidir por el usuario**: `novel_forge_choose_route` devuelve `NEED_CHOICE` cuando no hay elección, y `delegate=true` debe incluir las palabras textuales de autorización del usuario (`note`), de lo contrario devuelve `NEED_AUTHORIZATION`.

### Changed
- **Control de acceso (obligatorio)**: sin ruta seleccionada, `novel_forge_develop_project(stage=outline)` y `novel_forge_chain(mode=full)` devuelven `NEED_ROUTE` y rechazan la ejecución (solo si el usuario pide explícitamente «omitir la guía» se puede pasar `allowUnrouted=true`, y en el resultado se indica que no hubo guía).
- Las demás etapas (flesh/world/characters) siguen pudiendo avanzar, pero con un recordatorio de «ruta aún no seleccionada»; `novel_forge_read_project` incorpora la vista `routes`.
- El pipeline sin supervisión `full` ahora añade primero un paso `route_plan`, y el esquema toma como guía la ruta recomendada por la IA (con una persona presente, conviene seleccionarla manualmente).
- El total de herramientas de sesión pasa de 18 → 20 (14 `novel_forge_*` + 6 `novel_forge_cap_*`); plantillas 24 → 25; acciones del motor 18 → 19.
- Versión del complemento 0.3.0 → 0.3.1 (motor sincronizado a 0.4.1).

### Fixed
- Se corrige el defecto de lógica de llamada por el que «el usuario solo da un párrafo y se genera directamente el esquema, sin que nadie lo controle»: la selección de la ruta pasa a ser un requisito previo obligatorio del esquema, y el prompt del esquema lleva siempre la ruta seleccionada, evitando que el esquema se disperse.

### Verify
- Autocomprobación del complemento completamente en verde: standalone 10/10 · apply 9/9 · tools 46/46 (incluye el control `NEED_ROUTE`, `NEED_AUTHORIZATION` y el caso de «un párrafo / motor de simulación que completa la guía»).
- Lado del motor: `test-route.js` 17/17 · `test-gen.js` 43/43 · `test-api.js` 26/26 · `test-pipeline.js` 21/21 · `acceptance.js` 20/20 · renderizado 9/9 · interacción 11/11.
- Espejo del motor `engine-mirror verify`: fuente/complemento 32 frente a 32 sin desviación.

## [0.3.0] - 2026-09-07

### Added
- **Actualización orientada a capacidades**: el complemento se reposiciona como «entorno de creación todo-en-uno», alojando el NovelForge integrado como una capacidad, y añade las tres categorías de capacidades content / doc / email, todas invocadas mediante el motor unificado de generación/aplicación.
- **Nuevas herramientas de sesión para capacidades (6)**: `novel_forge_capabilities`, `novel_forge_cap_create`, `novel_forge_cap_set_source`, `novel_forge_cap_analyze`, `novel_forge_cap_run`, `novel_forge_cap_read`.
- **Extensión del servicio**: `ctx.novelForge.capabilities()` devuelve la lista de capacidades (novel/content/doc/email y sus acciones).
- **Espejo del marco de capacidades del motor**: registro `app/server/capabilities.js`, campo `cap` del proyecto, `/api/capabilities`, `/api/projects/:id/workspace`.
- **Multilingüe**: i18n del frontend (`app/public/js/i18n.js`, cobertura completa en chino/inglés + reserva al chino para francés/ruso/español/portugués), selector de idioma en la barra superior; el campo `language` del proyecto admite la escritura en cualquier idioma de destino.
- **Banco de trabajo de capacidades web**: `app/public/js/views/capStudio.js`.

### Changed
- El total de herramientas de sesión pasa de 12 → 18 (12 herramientas de novela `novel_forge_*` + 6 herramientas de capacidad `novel_forge_cap_*`).
- Total de acciones del motor (fases de novel + acciones de capacidad); plantillas 18 → 24.
- Todo el texto de la interfaz del frontend se integra con `t()` (base zh, las claves no cubiertas recurren al chino).
- Versión del complemento 0.2.0 → 0.3.0 (motor sincronizado a 0.4.0).

### Fixed
- Actualizadas las aserciones de autocomprobación del complemento para ajustarse al nuevo número de capacidades (24 conjuntos de plantillas / 18 herramientas).
- Corregidos 3 errores de equilibrio de paréntesis en ESM introducidos por el espejo de las herramientas de capacidad (vistas `bible/audit/outline` dentro de app).

### Verify
- Autocomprobación del complemento completamente en verde: standalone 8/8 · apply 9/9 · tools 26/26.
- Espejo del motor `engine-mirror verify`: fuente/complemento 32 frente a 32 sin desviación.

## [0.2.0] - 2026-09-06

### Added
- Primera forma de complemento (paquete de composición DSH): espejo del motor integrado + servicio de ciclo de vida `novelForge` + 12 herramientas de sesión `novel_forge_*`.
- Corregidos dos problemas de ejecución críticos bajo el host Electron: `process.execPath` no es node y el logger del host carece de `.log`.
- `resolveNode()` maneja las diferencias entre el host de escritorio (Electron) y el de CLI; capa de configuración `cordis.patch.yml` (líneas de servicio + líneas de herramientas).
- Autocomprobación de montaje `check-mount.bat` → `mount-check-report.txt`.

### Fixed
- (no hay defectos previos registrados; esta versión es el punto inicial trazable).

[0.3.1]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.3.1
[0.3.0]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.3.0
[0.2.0]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.2.0
