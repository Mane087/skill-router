#!/usr/bin/env bash
# Sugiere skill-router cuando Codex intenta descubrir/cargar skills manualmente.
set -uo pipefail

input=$(cat)

session_id=$(jq -r '.session_id // "unknown"' <<<"$input")
tool=$(jq -r '.tool_name // ""' <<<"$input")

# No interferir con el propio skill-router.
case "$tool" in
  mcp__skill-router__*)
    exit 0
    ;;
esac

# Codex puede usar distintas herramientas y cada una puede estructurar
# tool_input de forma diferente. Extraemos todos los strings para no
# depender de file_path/path/pattern/command concretos.
target=$(
  jq -r '
    .tool_input // {}
    | [.. | strings]
    | join(" ")
  ' <<<"$input"
)

target_lc=$(printf '%s' "$target" | tr '[:upper:]' '[:lower:]')

# Detectar únicamente ubicaciones relacionadas con Agent Skills.
#
# Evito "*skills/*" genérico porque podría dispararse con directorios
# normales de una aplicación como src/skills/, app/skills/, etc.
case "$target_lc" in
  *skill.md*|*.agents/skills*|*.codex/skills*|*/etc/codex/skills*)
    ;;
  *)
    exit 0
    ;;
esac

# Una sola vez por sesión.
#
# mkdir es atómico, a diferencia de:
#   [[ -e "$marker" ]] && exit
#   : > "$marker"
#
# Esto evita avisos duplicados si Codex ejecuta varias herramientas
# concurrentemente.
safe_session_id=$(printf '%s' "$session_id" | tr -c 'A-Za-z0-9._-' '_')
marker="${TMPDIR:-/tmp}/skill-router-nudge-${safe_session_id}"

mkdir "$marker" 2>/dev/null || exit 0

jq -n '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    additionalContext: "Esta sesión tiene conectado el servidor MCP skill-router. Antes de recorrer, buscar o leer manualmente el catálogo de Agent Skills, usa mcp__skill-router__skills_search con una descripción de la tarea (task y, opcionalmente, phase, stack, files y keywords). El resultado devuelve una lista corta y ordenada de skills candidatas con el motivo de selección. Usa mcp__skill-router__skills_get para cargar una skill concreta por id y mcp__skill-router__skills_get_reference para obtener únicamente una referencia específica. Evita recorrer directorios .agents/skills, .codex/skills, /etc/codex/skills o múltiples archivos SKILL.md cuando el router pueda resolver primero qué skill es relevante."
  }
}'
