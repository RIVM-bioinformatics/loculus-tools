---
name: review-pr
description: >-
  Review a GitHub pull request for correctness, task fulfillment, repository
  conventions, and test coverage. Use when asked to review a PR or branch;
  require approval before posting any generated inline comments.
argument-hint: '[task description] [#PR-number]'
---

# Pull Request Review

Review the exact GitHub PR diff. Remain read-only unless the user approves
specific comments for posting.

## Inputs

The task description and PR number are optional. A PR number must be a trailing
`#<integer>`; without one, resolve the open PR for the current branch. Read
[references/invocation-and-posting.md](references/invocation-and-posting.md)
when parsing is ambiguous, when comments will be posted, or when posting fails.

Require an existing PR and authenticated `gh` CLI. Resolve a supplied PR with
`gh pr view <number>`; otherwise use `gh pr view` for the current branch. Stop
when no PR can be resolved.

## Workflow

1. Read `AGENTS.md`, applicable scoped instructions, and any task description.
   Fetch the exact PR diff with `gh pr diff <number>` rather than assuming the
   local branch matches the PR.
2. Run quality checks appropriate to the changed scope:
   - For frontend packages: inspect `package.json` for available scripts; run
     `pnpm --filter <package> lint` and `pnpm --filter <package> check-types`
     (or `pnpm --filter <package> validate` if provided).
   - For Rust engine packages (`packages/apps/<app>/engine`):
     `cargo fmt -- --check`,
     `cargo test`, and
     `cargo clippy --all-targets --all-features -- -D warnings`.
   - When WASM bindings or exports change, verify `pnpm run build-wasm` and
     `pnpm update-exports`.
   Report actual results and stop on a failing required gate.
3. Analyze changed code and tests for:
   - task fulfillment and unrelated scope, when a task was supplied;
   - correctness, boundary cases, error handling, and security implications;
   - the architecture and backend-parity rules in `AGENTS.md`;
   - regression coverage and consistency with nearby implementation patterns.
4. Report only actionable findings, ordered by severity. Give each finding a
   file and diff line, concrete evidence, impact, and a concise correction. Do
   not invent repository conventions. State explicitly when no findings remain.
5. Show proposed inline comments and obtain approval for all or selected
   comments. Approval to review is not approval to post.
6. Post only approved comments through
   `.agents/scripts/post-pr-comments.sh`. The helper uses `gh api` to create
   inline comments and appends its AI-generated attribution. Report partial
   failures from its JSON result; do not silently retry writes.
