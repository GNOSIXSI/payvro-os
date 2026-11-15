#!/usr/bin/env bash
# Push this HEAD to a throwaway local anonymous Convex backend, then serve Next.
# Inherited cloud targets and the checkout's .env.local are not used.
set -euo pipefail

raiz="$(cd "$(dirname "$0")/.." && pwd)"
cd "$raiz"

home_previo="${HOME:-}"
aislamiento="$(mktemp -d "${TMPDIR:-/tmp}/payvro-e2e.XXXXXX")"
export HOME="$aislamiento/home"
export USERPROFILE="$HOME"
export XDG_CACHE_HOME="$aislamiento/cache"
export LOCALAPPDATA="$aislamiento/localapp"
mkdir -p "$HOME/.cache" "$XDG_CACHE_HOME" "$LOCALAPPDATA"
if [[ -n "$home_previo" && -d "$home_previo/.cache/convex" ]]; then
  ln -s "$home_previo/.cache/convex" "$HOME/.cache/convex"
fi

unset CONVEX_DEPLOYMENT
unset CONVEX_URL
unset NEXT_PUBLIC_CONVEX_URL
unset CONVEX_DEPLOY_KEY
unset CONVEX_DEPLOYMENT_TOKEN
while IFS= read -r nombre; do
  [[ -n "$nombre" ]] && unset "$nombre"
done < <(env | awk -F= '/^CONVEX_SELF_HOSTED_/ { print $1 }')

export CONVEX_AGENT_MODE=anonymous
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY-}"

env_aislado="$aislamiento/convex.env"
: >"$env_aislado"

backup_env_local=""
backup_env=""
backup_dot_convex=""
restaurado=0
convex_pid=""
registro="$aislamiento/convex.log"

apartar() {
  local origen="$1"
  local destino="$2"
  if [[ -e "$origen" || -L "$origen" ]]; then
    mv "$origen" "$destino"
    printf '%s' "$destino"
  fi
}

backup_env_local="$(apartar .env.local "$aislamiento/env.local.real")"
backup_env="$(apartar .env "$aislamiento/env.real")"
backup_dot_convex="$(apartar .convex "$aislamiento/convex.real")"
ln -s "$env_aislado" .env.local

restaurar() {
  local estado=$?
  set +e
  if [[ "$restaurado" -eq 1 ]]; then
    exit "$estado"
  fi
  restaurado=1
  rm -f .env.local
  if [[ -n "$backup_env_local" ]]; then
    mv "$backup_env_local" .env.local
  fi
  rm -f .env
  if [[ -n "$backup_env" ]]; then
    mv "$backup_env" .env
  fi
  rm -rf .convex
  if [[ -n "$backup_dot_convex" ]]; then
    mv "$backup_dot_convex" .convex
  fi
  if [[ -n "$convex_pid" ]]; then
    kill -TERM "$convex_pid" 2>/dev/null || true
    pkill -TERM -P "$convex_pid" 2>/dev/null || true
    wait "$convex_pid" 2>/dev/null || true
  fi
  exit "$estado"
}
trap restaurar EXIT INT TERM

valor_env() {
  local clave="$1"
  local linea valor
  linea="$(grep -E "^${clave}=" "$env_aislado" | tail -1 || true)"
  valor="${linea#*=}"
  valor="${valor%%#*}"
  valor="${valor%\"}"
  valor="${valor#\"}"
  valor="${valor%\'}"
  valor="${valor#\'}"
  valor="${valor#"${valor%%[![:space:]]*}"}"
  valor="${valor%"${valor##*[![:space:]]}"}"
  printf '%s' "$valor"
}

exigir_destino_local() {
  url="$(valor_env NEXT_PUBLIC_CONVEX_URL)"
  if [[ -z "$url" ]]; then
    url="$(valor_env CONVEX_URL)"
  fi
  deployment="$(valor_env CONVEX_DEPLOYMENT)"
  if [[ ! "$url" =~ ^https?://(127\.0\.0\.1|localhost|\[::1\]):[0-9]+/?$ ]] \
    || [[ ! "$deployment" =~ ^(anonymous|local):[^[:space:]#]+$ ]]; then
    echo "el destino resuelto no es un backend local anónimo (${deployment:-sin deployment} ${url:-sin url})" >&2
    exit 1
  fi
}

if ! npx convex dev --once --skip-push --typecheck disable --tail-logs disable >"$registro" 2>&1; then
  echo "no se pudo crear el backend local anónimo" >&2
  cat "$registro" >&2 || true
  exit 1
fi

exigir_destino_local

# auth.config.ts names CLERK_JWT_ISSUER_DOMAIN. A fresh backend has no value, so
# `convex dev --once` exits non-zero until one is set. DEMO e2e does not sign in;
# the host is reserved and is not a real issuer.
if ! npx convex env set CLERK_JWT_ISSUER_DOMAIN "https://issuer.ejemplo.invalid" >>"$registro" 2>&1; then
  echo "no se pudo preparar el backend local para el push" >&2
  cat "$registro" >&2 || true
  exit 1
fi

if ! npx convex dev --once --typecheck disable --tail-logs disable >>"$registro" 2>&1; then
  echo "el push de este HEAD al backend local de Convex falló" >&2
  cat "$registro" >&2 || true
  exit 1
fi

exigir_destino_local

export NEXT_PUBLIC_CONVEX_URL="$url"
export PORT="${PORT:-3105}"
puerto="${url##*:}"
puerto="${puerto%%/*}"

# `convex dev --once` stops the backend when it exits. Start it again for Next.
# Stay in this process group so the test runner's shutdown signal reaches it.
npx convex dev --typecheck disable --tail-logs disable >>"$registro" 2>&1 &
convex_pid=$!

listo=0
for _ in $(seq 1 60); do
  if ! kill -0 "$convex_pid" 2>/dev/null; then
    echo "convex dev terminó antes de servir el backend local" >&2
    cat "$registro" >&2 || true
    exit 1
  fi
  if (echo >/dev/tcp/127.0.0.1/"$puerto") >/dev/null 2>&1; then
    listo=1
    break
  fi
  sleep 1
done

if [[ "$listo" -ne 1 ]]; then
  echo "el backend local no aceptó conexiones en el puerto ${puerto}" >&2
  cat "$registro" >&2 || true
  exit 1
fi

npm run build
npx next start --hostname 127.0.0.1 --port "$PORT"
