---
name: skill-router-metadata
description: >
  Analiza los archivos SKILL.md de un catálogo y les escribe el frontmatter YAML
  que el servidor MCP skill-router usa para rankear: phases, intents, frameworks,
  languages, tags, filePatterns, related y excludes. Úsala para agregar, corregir
  o auditar la metadata de routing de una o varias skills, cuando el router no
  recupere una skill que debería recuperar, cuando una skill declare metadata
  bajo claves que el router descarta (metadata anidada, triggers, category, tag
  en singular), o al revisar la calidad del frontmatter de un catálogo de skills.
phases:
  - implementation
  - review
intents:
  - add-metadata
  - audit-metadata
  - write-frontmatter
  - update-frontmatter
tags:
  - frontmatter
  - metadata
  - routing
  - skill-router
  - yaml
filePatterns:
  - SKILL.md
  - '**/SKILL.md'
---

# Metadata de routing para skills

El servidor MCP `skill-router` decide qué skills recuperar leyendo únicamente el
frontmatter YAML de cada `SKILL.md`. Toda clave fuera de su esquema se descarta.
Esta skill recorre un catálogo, infiere la metadata que el router sí consume y
la escribe.

Antes de proponer valores, lee `references/schema.md` (qué campos existen y qué
límites tienen) y `references/curation.md` (cómo decidir el valor de cada uno).
Las reglas de curación no son estilo: se derivan del modelo de scoring, y
aplicarlas al revés baja el score en lugar de subirlo.

## Reglas que no se negocian

- **Nunca modifiques el cuerpo de una skill.** Solo el bloque de frontmatter.
- **Nunca escribas una clave desconocida dentro de `excludes`.** Ese bloque es
  estricto y una clave inválida hace que el router rechace el manifiesto
  completo, dejando la skill irrecuperable.
- **Nunca inventes un valor de `phases`.** El conjunto es cerrado; un typo
  elimina la skill de esas consultas sin ningún aviso.
- **No toques skills de plugins ni skills de fábrica del agente.** Se
  sobrescriben al actualizar y el trabajo se pierde.
- **Detente en la fase 4.** No escribas ningún archivo hasta tener aprobación.

## Fase 0 — Descubrimiento

Roots de configuración del usuario:

```
~/.claude/skills
~/.codex/skills
~/.config/opencode/skills
~/.agents/skills
```

Roots del proyecto actual:

```
.claude/skills
.codex/skills
.opencode/skills
.agents/skills
```

Para cada root que exista, resuelve su ruta canónica y descarta los roots cuya
ruta canónica ya hayas visto. **Este paso es obligatorio.** Es normal que varios
de esos directorios sean enlaces simbólicos al mismo destino real, y sin
deduplicar procesarías cada skill dos o tres veces.

Lista recursivamente los `SKILL.md` de cada root superviviente y descarta los que
caigan bajo:

- `*/plugins/cache/*` — skills instaladas por plugins
- `*/.system/*` — skills que el agente trae de fábrica
- `*/node_modules/*`

Reporta cuántas skills únicas encontraste y qué roots omitiste por duplicado.

## Fase 1 — Lectura acotada

De cada skill lee el frontmatter completo, los encabezados del cuerpo y el primer
bloque de prosa tras el encabezado principal. No leas los cuerpos completos: un
catálogo mediano no cabe en una sesión, y esto basta para inferir la metadata.

Anota qué campos válidos ya tiene y qué campos legacy trae.

## Fase 2 — Inferencia

Propón valores siguiendo `references/curation.md`, y marca los campos legacy a
eliminar según la tabla de mapeo de ese mismo documento.

Para cada término que propongas debes poder responder: ¿qué escribiría un agente
en su consulta para que este término coincida? Si no hay una respuesta clara, el
término no va.

## Fase 3 — Consistencia del catálogo

Con todas las propuestas a la vista:

1. **Unifica el vocabulario.** El router compara la metadata estructurada de
   forma exacta, así que `node` y `nodejs` son dos términos sin relación. Elige
   una forma canónica por concepto y aplícala en todas las skills.
2. **Valida `related`.** Cada nombre debe existir en el catálogo que escaneaste.
   Elimina y reporta los que no.
3. **Verifica la cobertura.** Ninguna skill puede quedar sin `tags` ni `intents`:
   sin al menos una señal de sujeto, el router no la admite aunque puntúe.

## Fase 4 — Reporte

Presenta una tabla con una fila por skill:

| Skill | Ruta canónica | Campos a añadir | Campos legacy a eliminar | Advertencias |

Muestra la ruta canónica, no la del enlace simbólico, para que quede claro qué
archivo se va a modificar.

**Detente aquí y espera aprobación explícita.**

## Fase 5 — Aplicación

Reescribe únicamente el bloque de frontmatter. El cuerpo debe quedar idéntico
byte por byte.

Orden de claves:

```yaml
name:
description:
phases:
intents:
frameworks:
languages:
tags:
filePatterns:
related:
excludes:
```

Escribe solo las claves con contenido. Los campos que pertenecen a otras
herramientas (`license`, `author`, `based_on`, `allowed-tools`) y `version` se
conservan al final del bloque, sin cambios.

## Fase 6 — Verificación

Aplica este checklist a cada archivo que escribiste:

- [ ] El bloque de frontmatter abre y cierra con `---`.
- [ ] `name` en kebab-case, ≤ 64 caracteres, igual al nombre del directorio.
- [ ] `description` ≤ 1024 caracteres y dice _cuándo_ usar la skill.
- [ ] Todo valor de `phases` está en `{planning, implementation, testing, review}`.
- [ ] No queda ninguna clave de la tabla de mapeo legacy.
- [ ] `license`, `author`, `based_on` y `allowed-tools` siguen presentes e intactos.
- [ ] `excludes`, si existe, solo contiene `intents`, `frameworks` o `languages`.
- [ ] Ningún término supera 64 caracteres; ninguna lista supera 64 elementos.
- [ ] La skill declara al menos un `tag` o un `intent`.
- [ ] `intents` ≤ 6 y `tags` ≤ 6.
- [ ] Ningún `intent` tiene más de dos palabras separadas por guion.
- [ ] Ningún término contiene guion bajo.
- [ ] Ningún tag está en la lista de términos genéricos prohibidos.
- [ ] Cada `related` apunta a un `name` existente en el catálogo.
- [ ] El cuerpo del documento no cambió.

Reporta el resultado del checklist. Si algo falla, corrígelo antes de declarar el
trabajo terminado.
