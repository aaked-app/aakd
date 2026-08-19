#!/bin/bash
# Aakd — One-command production deploy script
# Run this on a fresh Ubuntu 22.04 VM (Oracle Cloud ARM recommended)
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/aaked-app/aakd/main/scripts/deploy.sh | bash
# Or after cloning the repo:
#   bash scripts/deploy.sh

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log()    { echo -e "${BLUE}[Aakd]${NC} $1"; }
success(){ echo -e "${GREEN}[✓]${NC} $1"; }
warn()   { echo -e "${YELLOW}[!]${NC} $1"; }
error()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

DOCUSEAL_DEFAULT_IMAGE="docuseal/docuseal@sha256:063f9b89fa99816d0c2f90c33e4e176ecbbdf8cddd4958e40562643d0431dfbc"

echo ""
echo -e "${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║        Aakd Production Deploy          ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Check OS ───────────────────────────────────────────────────────────────
if [ "$(uname -s)" != "Linux" ]; then
  error "This script is for Linux only. Run it on your Oracle Cloud VM."
fi

# ── 2. Install Docker (if not installed) ─────────────────────────────────────
if ! command -v docker &> /dev/null; then
  log "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  error "Docker installed. Start a new login session so the docker group takes effect, then re-run this script with the same AAKD_REF."
else
  success "Docker already installed ($(docker --version | cut -d' ' -f3 | tr -d ','))"
fi

# ── 3. Install Docker Compose plugin (if not installed) ──────────────────────
if ! docker compose version &> /dev/null; then
  log "Installing Docker Compose plugin..."
  sudo apt-get update -qq
  sudo apt-get install -y docker-compose-plugin
  success "Docker Compose installed"
else
  success "Docker Compose already installed ($(docker compose version --short))"
fi

# ── 4. Install git (if not installed) ────────────────────────────────────────
if ! command -v git &> /dev/null; then
  log "Installing git..."
  sudo apt-get update -qq && sudo apt-get install -y git
fi

# ── 5. Clone or update repo ───────────────────────────────────────────────────
REPO_DIR="${AAKD_REPO_DIR:-${CLAUSEFLOW_REPO_DIR:-${HOME}/aakd}}"
REPO_URL="${AAKD_REPO_URL:-${CLAUSEFLOW_REPO_URL:-https://github.com/aaked-app/aakd.git}}"
AAKD_REF="${AAKD_REF:-}"

if ! [[ "$AAKD_REF" =~ ^[a-f0-9]{40}$ ]]; then
  error "Set AAKD_REF to the exact 40-character commit SHA to deploy; floating branches and tags are not allowed."
fi

if [ -d "$REPO_DIR/.git" ]; then
  if [ -n "$(git -C "$REPO_DIR" status --porcelain)" ]; then
    error "Refusing to deploy from a working tree with uncommitted changes: $REPO_DIR"
  fi
  log "Fetching the requested release commit..."
  git -C "$REPO_DIR" fetch --prune origin
else
  log "Cloning Aakd..."
  git clone --no-checkout "$REPO_URL" "$REPO_DIR"
  success "Repo cloned to $REPO_DIR"
fi

if ! git -C "$REPO_DIR" cat-file -e "$AAKD_REF^{commit}" 2>/dev/null; then
  error "AAKD_REF was not found in $REPO_URL after fetch: $AAKD_REF"
fi
git -C "$REPO_DIR" checkout --detach "$AAKD_REF"

cd "$REPO_DIR"

# shellcheck source=lib/self-hosting-config.sh
source "$REPO_DIR/scripts/lib/self-hosting-config.sh"

# ── 6. Collect configuration ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Configuration${NC}"
echo "──────────────────────────────────────────"

if [ -f ".env.prod" ]; then
  warn ".env.prod already exists. Using existing configuration."
  warn "Delete .env.prod and re-run to reconfigure."
else
  # Domain. Set AAKD_DOMAIN for a non-interactive deploy.
  if [ -n "${AAKD_DOMAIN:-}" ]; then
    DOMAIN="$AAKD_DOMAIN"
  else
    read -rp "$(echo -e "${BOLD}Your domain name${NC} (e.g. clm.example.com): ")" DOMAIN
    DOMAIN="${DOMAIN:-clm.example.com}"
  fi
  if [[ ! "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
    error "DOMAIN must be a hostname such as clm.example.com"
  fi

  # Email is optional. Configure SMTP later if renewal and invitation emails are needed.
  RESEND_API_KEY="${RESEND_API_KEY:-}"
  if [ -z "$RESEND_API_KEY" ] && [ -t 0 ]; then
    read -rp "$(echo -e "${BOLD}Resend API key${NC} (optional, press Enter to skip): ")" RESEND_API_KEY
  fi
  if [ -t 0 ]; then
    read -rp "$(echo -e "${BOLD}From email address${NC} (optional, default noreply@${DOMAIN}): ")" SMTP_FROM
  fi
  SMTP_FROM="${SMTP_FROM:-noreply@${DOMAIN}}"

  if [ -z "${ALERT_EMAIL_TO:-}" ] && [ -t 0 ]; then
    read -rp "$(echo -e "${BOLD}Your email address${NC} (optional renewal alerts): ")" ALERT_EMAIL_TO
  fi
  ALERT_EMAIL_TO="${ALERT_EMAIL_TO:-}"
  SMTP_HOST="${SMTP_HOST:-}"
  SMTP_PORT="${SMTP_PORT:-587}"
  SMTP_SECURE="${SMTP_SECURE:-false}"
  SMTP_USER="${SMTP_USER:-}"
  SMTP_PASS="${SMTP_PASS:-}"
  if [ -n "$RESEND_API_KEY" ]; then
    SMTP_HOST="smtp.resend.com"
    SMTP_PORT="465"
    SMTP_SECURE="true"
    SMTP_USER="resend"
    SMTP_PASS="$RESEND_API_KEY"
  fi

  # Auto-generate secrets
  log "Generating secrets..."
  POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 40)
  REDIS_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 40)
  MINIO_ROOT_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 40)
  BETTER_AUTH_SECRET=$(openssl rand -base64 32)
  NOTIFICATION_ENCRYPTION_KEY=$(openssl rand -hex 32)
  DOCUSEAL_SECRET_KEY_BASE=$(openssl rand -hex 64)
  # Pin DocuSeal to the reviewed digest used by the production Compose example.
  # Set DOCUSEAL_IMAGE before running this script to supply a reviewed digest instead.
  DOCUSEAL_IMAGE="${DOCUSEAL_IMAGE:-$DOCUSEAL_DEFAULT_IMAGE}"

  # Write .env.prod
  cat > .env.prod << EOF
# Generated by deploy.sh on $(date)
DOMAIN=${DOMAIN}

# Database
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# Redis
REDIS_PASSWORD=${REDIS_PASSWORD}

# Storage (MinIO)
MINIO_ROOT_USER=clauseflow
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}

# Auth
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}

# Notifications
NOTIFICATION_ENCRYPTION_KEY=${NOTIFICATION_ENCRYPTION_KEY}

# Email (Resend)
RESEND_API_KEY=${RESEND_API_KEY}
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_SECURE=${SMTP_SECURE}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM=${SMTP_FROM}
ALERT_EMAIL_TO=${ALERT_EMAIL_TO}

# DocuSeal
DOCUSEAL_IMAGE=${DOCUSEAL_IMAGE}
DOCUSEAL_SECRET_KEY_BASE=${DOCUSEAL_SECRET_KEY_BASE}
DOCUSEAL_API_KEY=
DOCUSEAL_WEBHOOK_SECRET=

# AI (optional — leave empty for BYOK)
AI_PROVIDER=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-haiku-4-5
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OLLAMA_BASE_URL=
EOF
  chmod 600 .env.prod
  success ".env.prod created and locked (chmod 600)"
fi

if ! ensure_docuseal_image ".env.prod" "$DOCUSEAL_DEFAULT_IMAGE"; then
  error "Refusing a mutable or malformed DOCUSEAL_IMAGE in .env.prod"
fi

# ── 7. Configure host firewall when explicitly requested ─────────────────────
if [ "${CONFIGURE_FIREWALL:-false}" = "true" ]; then
  log "Configuring host firewall (iptables)..."
if command -v iptables &> /dev/null; then
  # Oracle Cloud blocks all ports by default via iptables rules.
  # These rules allow HTTP and HTTPS traffic.
  sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
  sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
  sudo iptables -I INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null || true
  # Persist rules across reboots
  if command -v netfilter-persistent &> /dev/null; then
    sudo netfilter-persistent save 2>/dev/null || true
  elif command -v iptables-save &> /dev/null; then
    iptables-save | sudo tee /etc/iptables/rules.v4 >/dev/null 2>&1 || true
  fi
  success "Firewall ports 80 and 443 opened"
else
  warn "iptables not found — make sure ports 80 and 443 are open in your VM's security list"
fi
else
  log "Skipping host firewall changes. Open ports 80 and 443 in your cloud firewall/security list."
fi

# ── 8. Build and start ───────────────────────────────────────────────────────
echo ""
log "Building Docker images (first build takes ~5 min)..."
docker compose -f docker-compose.prod.yml --env-file .env.prod config --quiet
docker compose -f docker-compose.prod.yml --env-file .env.prod build --parallel

log "Starting all services..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# ── 9. Verify infrastructure readiness ───────────────────────────────────────
log "Waiting for app to be ready..."
ATTEMPTS=0
MAX_ATTEMPTS=30
until docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T app node -e "fetch(process.env.INTERNAL_APP_URL + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" 2>/dev/null; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
    error "App health check timed out. Inspect: docker compose -f docker-compose.prod --env-file .env.prod logs app"
  fi
  sleep 5
done

log "Waiting for public TLS and dependent services..."
ATTEMPTS=0
until bash scripts/verify-production.sh; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
    error "Infrastructure verification timed out. Inspect: docker compose -f docker-compose.prod.yml --env-file .env.prod ps"
  fi
  sleep 5
done

# ── 10. Done ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║  Infrastructure verification passed     ║${NC}"
echo -e "${GREEN}${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""

DOMAIN="$(read_env_value .env.prod DOMAIN 2>/dev/null || true)"

echo -e "  ${BOLD}App:${NC}      https://${DOMAIN:-your-domain.com}"
echo -e "  ${BOLD}DocuSeal:${NC} https://sign.${DOMAIN:-your-domain.com}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Wait 1-2 min for Caddy to get SSL certificates"
echo "  2. Open https://${DOMAIN:-your-domain.com}, create an organization, and complete the first-value journey"
echo "  3. Go to sign.${DOMAIN:-your-domain.com} → API → copy the key"
echo "     Then run: ./scripts/set-docuseal-key.sh YOUR_KEY"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  Logs:    docker compose -f docker-compose.prod.yml logs -f"
echo "  Status:  docker compose -f docker-compose.prod.yml ps"
echo "  Restart: docker compose -f docker-compose.prod.yml restart"
echo "  Update:  AAKD_REF=<reviewed-commit-sha> bash scripts/update.sh"
echo ""
echo -e "${YELLOW}Pilot status:${NC} Infrastructure is verified; do not claim pilot completion until the user journey and restore drill are recorded."
echo ""
