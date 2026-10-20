---
name: "Frontend Application and Component Guidelines"
description: "Use for React, Vite, TypeScript, and styling changes across frontend packages in the monorepo."
applyTo: "packages/apps/**/frontend/**/*.{ts,tsx,js,jsx,json,html}"
---

- Respect package heterogeneity: always inspect the package manifest (`package.json`) before executing scripts (`lint`, `check-types`, `validate`, `build`, `start`, `preview`, `test`). Do not assume every application defines identical script names.
- Maintain strict architectural boundaries:
  - React components own UI layout, theme styling (MUI/Emotion), accessibility, and user events.
  - State management lives in Zustand stores or React hooks.
  - Computationally heavy tasks (tree calculations, alignment slicing, large FASTA parsing) belong in background Web Workers or services, never on the React render thread.
- For worker bridges (e.g. sequence editor's `EngineClient`), ensure requests and responses maintain proper sequence correlation, transferred ArrayBuffers are not reused after posting, and errors propagate cleanly to the UI.
- Preserve existing ESLint flat configuration (`eslint.config.js` with `@gen-epix/eslint-config`). Try `pnpm --filter <package> lint` and ESLint auto-fix before manual formatting edits.
- Use named types and existing models from package model directories instead of repeating anonymous shapes in components.
- Keep user-facing strings localized using the existing i18next configuration.
