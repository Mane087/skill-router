# Curación de metadata

Cómo decidir el valor de cada campo. Estas reglas se derivan del modelo de
scoring descrito en `schema.md`; no son preferencias de estilo.

## La distinción que ordena todo lo demás

Hay dos familias de campos, con reglas opuestas:

**Ratio medido contra la lista de la propia skill** — `intents` y `tags`.

> "share of the skill's intents found in the text"

Cada término declarado que la consulta no menciona _baja_ el score. Una skill con
veinte tags de los que la consulta menciona uno obtiene ratio 0.05. Declarar de
más aquí es contraproducente.

**Ratio medido contra la consulta** — `frameworks`, `languages`, `filePatterns`.

> "share of stack terms in the skill frameworks"

Declarar de más no diluye el score. El costo de declarar de más aquí no es un
puntaje bajo, es un falso positivo: la skill se recupera para tareas que no le
corresponden.

Regla práctica: **sé tacaño con `intents` y `tags`; sé exhaustivo pero honesto
con `frameworks` y `languages`.**

## `description`

Es el único campo con stemming y el único que salva a una skill sin metadata
estructurada. Reescríbelo solo si no dice **cuándo** usar la skill.

- Es la frase que dice en qué momento alcanzar la skill, no un título.
- Debe contener las palabras de contenido que un agente escribiría en su tarea.
- Máximo 1024 caracteres.
- Un patrón que funciona bien: qué hace la skill, seguido de "Úsala cuando…" con
  dos o tres situaciones concretas.

Si el catálogo está en español pero las tareas pueden llegar en inglés, apóyate
en los términos técnicos que son iguales en ambos idiomas (`metadata`,
`frontmatter`, `routing`, `component`, `testing`). Son las palabras de contenido
que realmente puntúan.

## `phases`

Solo del conjunto cerrado. Declara las que realmente apliquen:

- `planning` — diseño, arquitectura, especificación
- `implementation` — escribir o modificar código
- `testing` — escribir o arreglar pruebas
- `review` — revisar, auditar, verificar

Casi toda skill es de `implementation`, así que declararlo aporta poco por sí
solo. Recuerda que `phases` no admite: una skill que solo declare fases es
inalcanzable.

## `frameworks` y `languages`

En minúsculas, con el término que un agente escribiría literalmente.

- `languages` — lenguajes de programación: `typescript`, `elixir`, `dart`,
  `python`, `javascript`
- `frameworks` — frameworks y librerías: `angular`, `nestjs`, `flutter`, `ash`,
  `phoenix`, `tailwind`, `jest`

El router mezcla ambos bajo el concepto de _stack_ al consultar, porque el agente
que llama no tiene por qué saber en cuál de los dos cae "typescript". Aun así,
clasificarlos correctamente importa: los pesos son distintos (25 contra 10).

Declara lo que la skill realmente cubre. Una skill de Angular no declara `react`
solo porque menciona React en una comparación.

## `intents`

Verbo-objeto en kebab-case, **exactamente dos palabras**, máximo 6 términos.

```yaml
intents:
  - create-component
  - write-tests
  - review-diff
  - fix-migration
```

La restricción de dos palabras es dura: el router exige que **cada** parte del
término aparezca como palabra completa en la consulta. `audit-skill-metadata`
necesita las tres palabras y prácticamente nunca coincide, y como el ratio se
mide contra la lista propia, ese término solo resta.

Usa la forma base del verbo. No hay stemming aquí: `create` no alcanza a
"creating".

Prueba para cada intent: ¿qué escribiría un agente para que las dos palabras
aparezcan? Si no hay una frase natural, descarta el término.

## Nunca uses guion bajo

`splitWords` divide el texto de la consulta por todo lo que no sea `[a-z0-9]`, así
que `auto_size_text` escrito en una tarea se convierte en `auto`, `size`, `text`.
Pero `matchesAllWords` solo divide el término por **guiones**, no por guiones
bajos. Un término declarado como `auto_size_text` se busca como una sola palabra
que nunca existe en el texto.

**Todo término con guion bajo es peso muerto.** Convierte siempre el guion bajo
en guion, en `tags`, `intents`, `frameworks` y `languages`:

| Nombre real del paquete  | Término a declarar       |
| ------------------------ | ------------------------ |
| `auto_size_text`         | `auto-size-text`         |
| `go_router`              | `go-router`              |
| `flutter_secure_storage` | `flutter-secure-storage` |
| `integration_test`       | `integration-test`       |

El techo de dos palabras aplica solo a `intents`, porque su ratio se mide contra
la lista propia de la skill. Un `framework` de tres partes como
`auto-size-text` está bien: su ratio se mide contra la consulta, y las tres
palabras aparecen juntas cuando alguien escribe el nombre del paquete.

## `tags`

Máximo 6, términos que un agente escribiría literalmente.

**Prohibidos por colisión léxica:**

```
design   test   code   web   app   data   build   file   project
```

La evaluación del propio router documenta el caso: la skill `tailwind` se
recupera para la consulta "Design the schema" porque declara el tag `design`. Un
tag genérico no discrimina, y como el ratio se mide contra la lista propia,
además arrastra el score hacia abajo en las consultas donde sí correspondía.

Prefiere el nombre concreto de la tecnología, el patrón o el artefacto:
`riverpod`, `changeset`, `liveview`, `frontmatter`, `migration`.

Cuidado con singular y plural: `skill` y `skills` son términos distintos para el
router. Elige el que un agente escribiría más a menudo y usa solo ese.

## `filePatterns`

Globs de los archivos que la skill realmente toca. Conservan mayúsculas y
minúsculas porque se comparan contra rutas reales.

```yaml
filePatterns:
  - '*.component.ts'
  - '**/*.ex'
  - pubspec.yaml
  - SKILL.md
  - '**/SKILL.md'
```

Un patrón sin `**` solo coincide con el nombre suelto. Si el archivo suele venir
con su ruta, declara también la variante con `**/`.

## `related`

Nombres exactos de skills hermanas que existan en el catálogo. Una relación solo
eleva a una skill que ya entró como candidata por su cuenta; nunca admite a una
irrelevante. Un nombre que no existe es simplemente peso muerto.

## `excludes`

Política conservadora. Escríbelo solo cuando:

- el cuerpo de la skill dice explícitamente que no aplica a algo, o
- existe una skill hermana que cubre ese caso y ambas competirían.

```yaml
excludes:
  frameworks:
    - react
    - vue
  languages:
    - python
```

Es un filtro duro: la skill se elimina antes de puntuar. En un repositorio
poliglota, excluir `react` de una skill de Angular la borra de cualquier consulta
que mencione ambos, aunque la tarea fuera de Angular. Ante la duda, no lo
escribas.

Solo `intents`, `frameworks` y `languages`. Una clave distinta rechaza el
manifiesto completo.

## Mapeo de campos legacy

Estas claves aparecen en catálogos reales y el router las descarta. Promueve su
contenido y elimina la clave original:

| Clave legacy                      | Destino                                      |
| --------------------------------- | -------------------------------------------- |
| `metadata.stack`, `stack`         | `languages` o `frameworks`, según el término |
| `metadata.framework`, `framework` | `frameworks`                                 |
| `metadata.tags`, `tag`            | `tags`                                       |
| `metadata.area`, `area`           | `tags` o `intents`, según el término         |
| `triggers`                        | `tags` o `intents`, podando hasta el techo   |
| `category`                        | `tags`                                       |

Criterio para `stack`: si el término nombra un lenguaje (`elixir`, `typescript`,
`dart`) va a `languages`; si nombra un framework o una librería (`ash`,
`angular`, `flutter`) va a `frameworks`. Un `stack` que contenga ambos se reparte.

`triggers` suele traer más términos de los que caben bajo el techo de 6. Conserva
los más discriminantes y descarta los genéricos; el resto de la señal ya vive en
la `description`.

### Claves que se conservan intactas

El router tolera a propósito las claves que otras herramientas escriben en el
mismo archivo. **No las elimines:**

```
license   author   based_on   allowed-tools   version
```

Esta skill no limpia frontmatter ajeno. Solo promueve la señal que el router
puede consumir y retira las claves de las que la extrajo.

## Cobertura mínima

Toda skill debe terminar con al menos un `tag` o un `intent`. Sin una señal de
sujeto, la regla de admisión la deja fuera aunque puntúe, y solo podría
recuperarse cubriendo un cuarto de las palabras de la consulta en su
`description` — lo que depende de cómo esté redactada la tarea y no es
controlable.
