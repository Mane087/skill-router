# Esquema del manifiesto

Hechos verificables contra el servidor `skill-router`. Si el router cambia, este
documento se actualiza; no es materia de criterio.

## Campos top-level

| Campo          | Requerido | Tipo             | Peso |
| -------------- | --------- | ---------------- | ---- |
| `name`         | sí        | string           | —    |
| `description`  | sí        | string           | 15   |
| `version`      | no        | entero positivo  | —    |
| `phases`       | no        | lista cerrada    | 30   |
| `frameworks`   | no        | lista de strings | 25   |
| `intents`      | no        | lista de strings | 20   |
| `filePatterns` | no        | lista de globs   | 15   |
| `languages`    | no        | lista de strings | 10   |
| `tags`         | no        | lista de strings | 10   |
| `related`      | no        | lista de strings | 5    |
| `excludes`     | no        | mapeo            | —    |

`filePatterns` va en camelCase. Escribirlo `filepatterns` o `file_patterns` lo
convierte en un campo desconocido y pierde la señal.

Cualquier otra clave top-level se descarta con un diagnóstico en stderr; no
rechaza el documento. Por eso `license` o `allowed-tools` pueden convivir con el
esquema sin romper nada.

## `phases`: conjunto cerrado

Solo estos cuatro valores:

```
planning
implementation
testing
review
```

Cualquier otro valor invalida el campo. Como `phases` tiene el peso más alto del
modelo, un typo como `implementaion` retira la skill de todas las consultas de
implementación sin producir ningún error visible.

## `excludes`: estricto

Acepta **exactamente** tres claves:

```yaml
excludes:
  intents: []
  frameworks: []
  languages: []
```

A diferencia del resto del esquema, una clave desconocida aquí **rechaza el
manifiesto completo** y la skill deja de existir para el router. No hay
`excludes.tags`, `excludes.phases` ni `excludes.filePatterns`.

Un valor en `excludes` es un filtro duro, no un puntaje menor: la skill se
elimina antes de puntuar.

## Límites

| Límite                 | Valor           |
| ---------------------- | --------------- |
| Documento              | 256 KB          |
| Bloque de frontmatter  | 16 KB           |
| `description`          | 1024 caracteres |
| Cualquier término      | 64 caracteres   |
| Patrón de archivo      | 256 caracteres  |
| Elementos por lista    | 64              |
| Profundidad de anidado | 8               |

## Normalización que aplica el router

No hace falta escribir la metadata ya normalizada, pero conviene saber qué se
pierde:

- Los términos de taxonomía (`tags`, `phases`, `intents`, `languages`,
  `frameworks`, `related` y todas las listas de `excludes`) se recortan, pasan a
  minúsculas, se deduplican y se ordenan.
- `filePatterns` se recorta, deduplica y ordena, pero **conserva mayúsculas y
  minúsculas**: se compara contra rutas reales.
- `description` colapsa sus espacios en blanco, lo que elimina los saltos de
  línea que introduce un escalar plegado (`>`).
- Un término que al normalizarse queda vacío se descarta.

## Causas de rechazo del documento

El router rechaza un `SKILL.md` cuando:

- no tiene bloque de frontmatter, o no está cerrado;
- el YAML está mal formado o tiene claves duplicadas;
- el frontmatter no es un mapeo;
- declara una clave desconocida dentro de `excludes`;
- usa una etiqueta YAML fuera del esquema base, o una que produce un valor fuera
  de JSON como `!!binary` o `!!timestamp`;
- contiene un número no finito (`.inf`, `.nan`);
- excede cualquiera de los límites de la tabla anterior.

## Cómo se comparan los términos

`splitWords` divide el texto por todo lo que no sea `[a-z0-9]` y pasa a
minúsculas. `matchesAllWords` divide el término por guiones y exige que **cada
parte** aparezca como palabra completa en el texto de la consulta.

Consecuencias:

- `create-component` responde a "create a component": ambas partes están.
- `backend-only` no responde a una tarea que solo dice "backend".
- `test` nunca coincide dentro de `latest`.
- Un término de tres partes exige las tres palabras y casi nunca coincide.
- Un término con guion bajo **nunca** coincide: `splitWords` borra el guion bajo
  del texto de la consulta, pero `matchesAllWords` no divide el término por él,
  así que `auto_size_text` se busca como una palabra que jamás existe.

La metadata estructurada **no** pasa por el stemmer. Solo `description` se reduce
a su raíz Porter, y por eso es el único campo donde "creating" alcanza a
"create".

## Fórmula del score

```
score = Σ (peso × ratio) / Σ peso     sobre las señales aplicables a la consulta
```

Qué señales son aplicables depende de la **consulta**, nunca de la skill. Un
score de 1 significa "coincidió con todo lo que la consulta pedía", no "declaró
todos los campos posibles".

## Regla de admisión

Puntuar por encima de cero no basta para ser recuperado. La skill debe coincidir
en al menos una señal de **sujeto**:

```
frameworks   languages   intents   filePatterns   tags
```

o cubrir al menos un cuarto de las palabras de contenido de la consulta en su
`description`.

`phases` y `related` están excluidos de esa lista a propósito: la fase es
contexto, no tema, y una relación solo dice que otra skill la avala. Ninguno de
los dos vuelve relevante a una skill que no lo era.
