#!/usr/bin/env bash
set -euo pipefail

title=""
body=""
body_file=""
labels=()
assignee="@me"
dry_run=false
print_command=false
body_only=false

ai_attribution='*AI-generated issue description; not written by the person posting this issue.*'

usage() {
  cat <<'USAGE'
Usage: create-issue.sh [options]

Options:
  --title TITLE        Issue title (required unless --body-only).
  --body TEXT          Markdown body text.
  --body-file FILE     Path to a file containing the markdown body.
  --label LABEL        Label to apply (can be repeated or comma-separated).
  --assignee ASSIGNEE  Assignee username or @me (defaults to @me). Pass "" for none.
  --dry-run            Print planned issue fields without creating it.
  --print-command      Print a ready-to-run gh issue create command without executing it.
  --body-only          Print only the prepared body with attribution and exit.
  -h, --help           Show this help.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --title)
      title="${2:?missing value for --title}"
      shift 2
      ;;
    --body)
      body="${2:?missing value for --body}"
      shift 2
      ;;
    --body-file)
      body_file="${2:?missing value for --body-file}"
      shift 2
      ;;
    --label)
      IFS=',' read -ra split_labels <<< "${2:?missing value for --label}"
      for l in "${split_labels[@]}"; do
        labels+=("$(echo "$l" | xargs)")
      done
      shift 2
      ;;
    --assignee)
      assignee="$2"
      shift 2
      ;;
    --dry-run)
      dry_run=true
      shift
      ;;
    --print-command)
      print_command=true
      shift
      ;;
    --body-only)
      body_only=true
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

if [[ -n "$body_file" ]]; then
  if [[ ! -f "$body_file" ]]; then
    echo "Body file not found: $body_file" >&2
    exit 1
  fi
  body="$(cat "$body_file")"
fi

if [[ -z "$body" && ! -t 0 ]]; then
  body="$(cat)"
fi

if [[ -z "$body" ]]; then
  echo "Issue body is required (provide via --body, --body-file, or stdin)." >&2
  exit 1
fi

# Ensure proper AI attribution is appended if not already present
if [[ "$body" != *"$ai_attribution"* ]]; then
  body="$body

---
$ai_attribution"
fi

if [[ "$body_only" == true ]]; then
  printf "%s\n" "$body"
  exit 0
fi

if [[ -z "$title" ]]; then
  echo "Issue title is required (--title)." >&2
  exit 1
fi

if [[ "$print_command" == true ]]; then
  printf "gh issue create \\\\\n"
  printf "  --title %q \\\\\n" "$title"
  printf "  --body %q" "$body"
  for l in "${labels[@]}"; do
    printf " \\\\\n  --label %q" "$l"
  done
  if [[ -n "$assignee" ]]; then
    printf " \\\\\n  --assignee %q" "$assignee"
  fi
  printf "\n"
  exit 0
fi

if [[ "$dry_run" == true ]]; then
  echo "=== Planned Issue Creation ==="
  echo "Title:    $title"
  echo "Assignee: ${assignee:-<none>}"
  echo "Labels:   ${labels[*]:-<none>}"
  echo "Body:"
  echo "----------------------------------------"
  printf "%s\n" "$body"
  echo "----------------------------------------"
  exit 0
fi

require_command git
require_command gh
gh auth status >/dev/null

temp_body_file="$(mktemp "${TMPDIR:-/tmp}/gh-issue-body.XXXXXX.md")"
printf "%s\n" "$body" > "$temp_body_file"
trap 'rm -f "$temp_body_file"' EXIT

build_gh_args() {
  local -n ref_args=$1
  ref_args=(--title "$title" --body-file "$temp_body_file")
  for l in "${labels[@]}"; do
    ref_args+=(--label "$l")
  done
  if [[ -n "$assignee" ]]; then
    ref_args+=(--assignee "$assignee")
  fi
}

cmd_args=()
build_gh_args cmd_args
gh issue create "${cmd_args[@]}"
