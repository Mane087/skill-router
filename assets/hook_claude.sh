#!/usr/bin/env bash
# Sugiere skill-router cuando Claude va a descubrir/cargar skills a mano.
set -uo pipefail

input=$(cat)
session_id=$(jq -r '.session_id // "unknown"' <<<"$input")
tool=$(jq -r '.tool_name // ""'   <<<"$input")
target=$(jq -r '[.tool_input.file_path, .tool_input.path, .tool_input.pattern, .tool_input.command]
                | map(select(. != null)) | join(" ")' <<<"$input")

# La herramienta Skill siempre interesa; para las demás, solo si apuntan al catálogo.
if [[ "$tool" != "Skill" ]]; then
  case "$target" in
    *SKILL.md*|*skills/*|*.claude/skills*) ;;
    *) exit 0 ;;
  esac
fi

# Una sola vez por sesión, para no repetir el aviso en cada llamada.
marker="${TMPDIR:-/tmp}/skill-router-nudge-${session_id}"
[[ -e "$marker" ]] && exit 0
: > "$marker"

jq -n '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    additionalContext: "Esta sesión tiene conectado el servidor MCP skill-router. mcp__skill-router__skills_search recibe una descripción de la tarea (task, y opcionalmente phase, stack, files, keywords) y devuelve una lista corta y ordenada de skills candidatas con el motivo de cada una. mcp__skill-router__skills_get carga una sola skill por id, y mcp__skill-router__skills_get_reference un documento de referencia concreto. Recorrer o leer el catálogo de archivos SKILL.md directamente carga más contexto que consultar el router primero."
  }
}'
