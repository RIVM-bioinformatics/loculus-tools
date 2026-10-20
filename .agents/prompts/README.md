# Portable Prompts

Store reusable, task-specific `*.prompt.md` templates in this directory. Prompts are manual entry points: they frame a request, collect variables, and define the desired output. They do not provide always-on project rules or own a multi-step workflow.

Use a skill when the agent should recognize and execute a reusable procedure. Use a prompt only when the user benefits from an explicit command or input template. If a prompt invokes a skill, keep it short and reference the skill instead of copying its steps.

Recommended structure:

```markdown
# Task name

Use `.agents/skills/<skill-name>/SKILL.md` for the procedure.

Input: [task-specific value]
Scope: [optional package, files, or subsystem]
Output: [expected result or report shape]
```

VS Code and GitHub Copilot discover these templates via the `chat.promptFilesLocations` setting configured in `.vscode/settings.json`.
