---
name: "Workflow and CI Practices"
description: "Use for GitHub Actions workflows and CI automation changes where runner environments, action dependencies, and generated release artifacts must remain secure and portable."
applyTo: ".github/workflows/**/*"
---

- Follow least-privilege principles: define explicit top-level or job-level `permissions` blocks for all workflows; never grant default write access when read-only suffices.
- Pin external third-party GitHub Actions to full immutable commit SHAs with an inline comment indicating the release tag (e.g. `uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2`).
- Check that build steps properly distinguish Node.js/pnpm setup from Rust toolchain setup (`wasm-pack`, `wasm32-unknown-unknown`).
- Treat PR branches, secrets, and release publishing jobs as distinct trust boundaries: do not expose secrets to untrusted fork PRs, and verify that publish jobs run only on protected releases/tags.
- Prevent script injection: never interpolate untrusted runner context expressions (`${{ github.event.* }}`, `${{ inputs.* }}`) directly into inline `run:` scripts, as quoting does not prevent breakout during expression evaluation. Instead, assign untrusted values to intermediate environment variables via `env:` and reference them with shell syntax (`"$VAR"`).
- When adding or modifying workflows, validate syntax and matrix combinations, and ensure artifact uploads/downloads specify accurate retention and path filters.
