#!/usr/bin/env bash
# Shared validation guards for production self-hosting scripts.

validate_docuseal_image() {
  local image="${1:-}"
  if [[ ! "$image" =~ ^[^[:space:]@]+@sha256:[a-f0-9]{64}$ ]]; then
    echo "DOCUSEAL_IMAGE must be an immutable image digest (for example docuseal/docuseal@sha256:<64 lowercase hex characters>)." >&2
    return 1
  fi
}

read_env_value() {
  local env_file="$1"
  local key="$2"

  awk -v key="$key" '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    {
      separator = index($0, "=")
      if (separator == 0) next
      name = substr($0, 1, separator - 1)
      if (name != key) next
      value = substr($0, separator + 1)
      count++
      if (value ~ /\$\(|`|\$\{/) unsafe = 1
    }
    END {
      if (unsafe) exit 2
      if (count == 0) exit 1
      if (count != 1) exit 3
      print value
    }
  ' "$env_file"
}

ensure_docuseal_image() {
  local env_file="$1"
  local default_image="$2"
  local domain
  local image
  local status=0

  if ! domain="$(read_env_value "$env_file" DOMAIN)" || [ -z "$domain" ]; then
    echo "Refusing to modify an incomplete production environment file: DOMAIN is required." >&2
    return 1
  fi

  image="$(read_env_value "$env_file" DOCUSEAL_IMAGE)" || status=$?
  if [ "$status" -eq 1 ] || { [ "$status" -eq 0 ] && [ -z "$image" ]; }; then
    image="$default_image"
    printf '\n# Added by deploy.sh: pin DocuSeal to the reviewed deployment digest\nDOCUSEAL_IMAGE=%s\n' "$image" >> "$env_file"
    chmod 600 "$env_file"
  elif [ "$status" -ne 0 ]; then
    echo "DOCUSEAL_IMAGE is missing, duplicated, or contains shell syntax in $env_file." >&2
    return "$status"
  fi

  validate_docuseal_image "$image"
}

validate_deploy_ref() {
  local ref="${1:-}"
  if [[ ! "$ref" =~ ^[a-f0-9]{40}$ ]]; then
    echo "AAKD_REF must be an exact 40-character lowercase Git commit SHA." >&2
    return 1
  fi
}
