# dsh-novel-forge —— Herramienta de creación con IA «todo-en-uno» para DeepSeek Harness (encapsulada como capacidades)

> **🌐 Idiomas** — [简体中文](README.md) · [English](README.en.md) · [Français](README.fr.md) · [Русский](README.ru.md) · Español · [Português](README.pt.md)
> Novedades: ver [CHANGELOG](CHANGELOG.md)

> Lleva «织文 NovelForge» al nivel de **entorno de creación todo-en-uno (multi-capability studio) de DeepSeek Harness**:
> en una sola conversación se completa **la escritura de novelas / imitación, continuación y reescritura de textos / la redacción de resoluciones del Consejo de Seguridad / la edición de correos académicos de contacto**, con soporte de **escritura multilingüe**.

El motor se convierte en un **plugin bundle** de Harness, y así es como funciona:
**toda la creación se completa dentro de la conversación/área de trabajo de harness** — el modelo detecta la intención y llama directamente a las herramientas (para novelas usa `novel_forge_*`;
para contenido/documentos oficiales/correos usa `novel_forge_cap_*`), y los resultados junto con la vista previa del texto vuelven a la conversación. **No hace falta abrir ningún navegador**;
la aplicación web integrada solo sirve como interfaz visual opcional (las herramientas y la web comparten los mismos datos y se sincronizan mutuamente).

---

> **🌐 Idiomas**
> [简体中文](README.md) · [English](README.en.md) · [Français](README.fr.md) · [Русский](README.ru.md) · Español · [Português](README.pt.md)
> Novedades: ver [CHANGELOG](CHANGELOG.md)

---

## Español

### «Capacidades» (capabilities) ofrecidas

El motor incluye un registro de capacidades `capabilities.js`; al crear un proyecto se especifica `cap`, y las distintas capacidades pasan por el mismo motor unificado de generación/aplicación:

| Capacidad `cap` | Nombre | Descripción | Acción de generación |
|---|---|---|---|
| `novel` | Escritura de novelas | idea→escenario→personajes→esquema→escritura por capítulos→revisión→exportación (predeterminado) | `idea/bible/characters/outline/chapter/audit_*` |
| `content` | Contenido de texto | pegar el texto original → analizar → imitar / continuar / reescribir | `content_analyze / content_imitate / content_continue / content_rewrite` |
| `doc` | Formato de documento oficial | redacción de resolución del Consejo de Seguridad de la ONU | `doc_resolution` |
| `email` | Comunicación académica | edición de correos académicos de contacto | `email_cold` |

**Multilingüe**: el proyecto puede fijar `language` (zh/en/fr/ru/es/pt o cualquier idioma); el motor inyecta el requisito del idioma objetivo en las instrucciones de escritura;
la interfaz de usuario frontal incluye un selector de idioma (barra superior) con soporte para chino/inglés/francés/ruso/español/portugués (los idiomas no traducidos vuelven al chino).

### Instalación (tres opciones)

Cuando el CLI `dsh` está disponible (dentro del checkout del código fuente es `pnpm dsh`):

```sh
# 1) Instalar directamente el directorio local (recomendado para depuración)
dsh plugin add F:\typing\novel-forge-plugin

# 2) Empaquetar como tarball para su distribución (sin necesidad de permisos de compilación)
pnpm pack   # se obtiene dsh-novel-forge-0.3.0.tgz
dsh plugin add ./dsh-novel-forge-0.3.0.tgz

# 3) O probarlo directamente como overlay --patch (sin abrir un perfil)
dsh --patch F:\typing\novel-forge-plugin\cordis.patch.yml --patch-argv
```

> Si pnpm ≥10 exige autorización para los scripts de compilación de las dependencias git: este paquete no contiene ningún script de compilación, basta con distribuir el código fuente.

### Servicios ofrecidos

| Miembro | Descripción |
|---|---|
| `ctx.novelForge.url` | Dirección de acceso una vez listo (p. ej. http://127.0.0.1:54321) |
| `ctx.novelForge.status` | `running` / `stopped` |
| `ctx.novelForge.start()` | Arranque manual (elige automáticamente un puerto libre y espera a que pase la comprobación de estado) |
| `ctx.novelForge.stop()` | Detiene el subproceso |
| `ctx.novelForge.describe()` | Información de la aplicación y registros recientes |
| `ctx.novelForge.capabilities()` | Lista de capacidades (novel/content/doc/email y sus acciones) |

### Herramientas de conversación para novelas (novel_forge_*, 12 en total)

El agente anfitrión las llama automáticamente al detectar la intención de escribir una novela; **todo el trabajo se realiza dentro de la conversación, sin necesidad de abrir un navegador**.

| Herramienta | Uso |
|---|---|
| `novel_forge_status` | Estado del motor + lista de proyectos (normalmente el primer paso) |
| `novel_forge_new_project` | Crear una nueva obra (devuelve `projectId`) |
| `novel_forge_seed_idea` | Guarda la idea del usuario en una tarjeta de ideas |
| `novel_forge_ideate` | Lluvia de ideas con IA de posibles ideas (tras seleccionarla, seed) |
| `novel_forge_develop_project` | Avanzar de fase: flesh/world/characters/outline/audit (los sobrescritos requieren confirmación) |
| `novel_forge_read_project` | Leer el progreso/esquema/personajes/**texto de capítulos**, para su revisión y decisión dentro de la conversación |
| `novel_forge_write_chapter` | Escribir el texto del capítulo N y archivar la memoria automáticamente (devuelve la vista previa del texto; los capítulos ya escritos requieren confirmación) |
| `novel_forge_edit_chapter` | Pulido fino de capítulos ya escritos: rewrite / polish / continue / summarize |
| `novel_forge_extend_outline` | Añadir N capítulos al esquema (amplía automáticamente al continuar obras largas) |
| `novel_forge_chain` | Sin supervisión: full=completar hasta la obra entera / write=escribir los capítulos restantes |
| `novel_forge_export` | Exportación md/manuscript/txt/json; **el texto completo vuelve directamente a la conversación** (puede truncarse) |
| `novel_forge_remove_project` | Eliminar un proyecto (requiere confirmación del usuario) |

### Herramientas de conversación para capacidades (capability_*, nuevas)

Gestionan el trabajo textual que no es novelas. Todo se realiza dentro de la conversación.

| Herramienta | Uso |
|---|---|
| `novel_forge_capabilities` | Enumerar las capacidades y acciones disponibles |
| `novel_forge_cap_create` | Crear un proyecto de capacidad (cap=content/doc/email; admite language) |
| `novel_forge_cap_set_source` | Escribir el texto fuente/borrador/asunto y parámetros |
| `novel_forge_cap_analyze` | Analizar el texto fuente (tema/estilo/estructura/personajes/tema central) |
| `novel_forge_cap_run` | Ejecutar imitate/continue/rewrite/doc/email; devuelve la vista previa |
| `novel_forge_cap_read` | Leer la vista general del proyecto / texto fuente / lista de salidas (se puede especificar index para ver el completo) |

Todos los resultados de las herramientas llevan semántica `ok/code/error` (como `NEED_CONFIRM`, etc.); conforme a ello, el modelo pide confirmación al usuario y nunca sobrescribe silenciosamente una creación existente.

### Opciones configurables (cordis.patch.yml → config)

- `port`: puerto fijo; `0` = seleccionar automáticamente un puerto libre (predeterminado)
- `host`: por defecto `127.0.0.1` (los datos/claves quedan solo en la máquina local; si se necesita acceso en la red local, cámbialo a `0.0.0.0` bajo tu propia responsabilidad)
- `autoStart`: se arranca automáticamente al iniciar el anfitrión (predeterminado `true`)
- `startTimeoutMs`: tiempo de espera de la comprobación de estado (predeterminado 20000)
- `dataDir`: directorio de datos (relativo a `app/` o una ruta absoluta; por defecto `app/data`, aislado del anfitrión y persistente junto con el paquete)

### Requisitos de entorno y notas

- Es necesario que la máquina anfitriona tenga un **Node ≥ 18.17** disponible (el plugin usa el ejecutable `node` actual para lanzar el subproceso del motor sin interfaz).
- Forma de uso: **la conversación de harness es la interfaz principal**; la interfaz web a la que apunta `ctx.novelForge.url` es solo un editor visual opcional,
  comparte los mismos datos con las herramientas y puede abrirse en cualquier momento para comparar, pero **no es un requisito para usarlo**.
- En el primer arranque se crean automáticamente el ejemplo integrado la novela «Carta del puerto de niebla» y los ajustes de 12 proveedores de modelos (incluido un motor de simulación offline, con el que se puede probar todo el flujo sin clave alguna).
- Las claves API de los modelos se guardan en texto plano en `app/data/settings.json` (para uso local y personal; no lo despliegues en un entorno no confiable).

### Autocomprobación

```sh
node scripts/test-standalone.mjs   # ciclo de vida completo de launchNovelForge
node scripts/test-apply.mjs        # entrada apply() (registro del servicio/arranque y parada)
node scripts/engine-mirror.mjs verify   # verificación de desviación cero del espejo del motor
```
