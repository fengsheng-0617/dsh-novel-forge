# Changelog

> **🌐 Idiomas**
> [简体中文](CHANGELOG.md) · [English](CHANGELOG.en.md) · [Français](CHANGELOG.fr.md) · [Русский](CHANGELOG.ru.md) · Español · [Português](CHANGELOG.pt.md)

Este changelog registra los cambios destacados de dsh-novel-forge (entorno de creación todo-en-uno para DeepSeek Harness) siguiendo [Keep a Changelog](https://keepachangelog.com/es/1.1.0/) y [Versionado Semántico](https://semver.org/).

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

[0.3.0]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.3.0
[0.2.0]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.2.0
