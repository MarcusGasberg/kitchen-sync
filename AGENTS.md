# Kitchen Sync — Agent Context

<!-- intent-skills:start -->
## Skill Loading

Before substantial work:
- Skill check: run `npx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `npx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

## Project Overview

A minimal TanStack Start app served by Nitro on Node.

## Scaffolding Commands

```bash
# Initial scaffold
npx @tanstack/cli@latest create kitchen-sync --agent --deployment cloudflare
# (the Cloudflare deployment was later replaced by Nitro/Node -- see Deployment Notes)

# TanStack Intent skill management
npx @tanstack/intent@latest install
npx @tanstack/intent@latest list
```

## Stack

- **Framework**: TanStack Start (React 19)
- **Router**: TanStack Router (file-based routing)
- **Build Tool**: Vite 8
- **Language**: TypeScript 6
- **Package Manager**: pnpm
- **Toolchain**: Biome (formatting + linting + import sorting)
- **Deployment**: Nitro (`nitro/vite`) building a Node server to `.output/`
- **Testing**: Vitest + jsdom + @testing-library/react

## Architecture

- `src/routes/` — File-based routes (`__root.tsx`, `index.tsx`, `about.tsx`)
- `src/router.tsx` — Router factory with type-safe registration
- `vite.config.ts` — Vite + TanStack Start plugin + Nitro plugin + React plugin
- `vitest.config.ts` — Vitest config (jsdom environment; no Nitro plugin, tests don't need a server build)
- `biome.json` — Single source of truth for formatting, linting, and import organization

## Scripts

| Script | Command |
|--------|---------|
| dev | `pnpm dev` — Vite dev server on port 3000 |
| build | `pnpm build` — Production build |
| preview | `pnpm preview` — Preview production build |
| test | `pnpm test` — Run Vitest |
| start | `pnpm start` — Serve the production build from `.output/` |
| lint | `pnpm lint` — Run Biome check |
| lint:fix | `pnpm lint:fix` — Run Biome check with auto-fix |
| format | `pnpm format` — Format with Biome |

## Environment Variables

- Local development and the production server both read `.env` (gitignored). Copy `.env.example` to `.env`.
- `DATABASE_URL` is required; without it every API route fails with a `ConfigError`.
- Client-side env vars: must use `VITE_` prefix; server-side can use `process.env`

## Deployment Notes

1. `pnpm build` — Nitro emits a Node server to `.output/server/index.mjs`
2. `pnpm start` — runs it (`node --env-file-if-exists=.env .output/server/index.mjs`)
3. `PORT` selects the listen port (default 3000)
4. Nitro is host-agnostic: the same `.output/` runs on any Node host, and Nitro
   presets can retarget other platforms without touching app code

## Key Dependencies Removed (Intentionally)

The following were present in the default TanStack CLI scaffold but removed to keep the app blank:
- **Tailwind CSS** — Removed to avoid locking in a CSS framework
- **lucide-react** — Removed; add back if icons are needed
- **@tanstack/react-devtools / devtools-vite / router-devtools** — Removed to keep the app minimal; add back for debugging
- **@tanstack/react-router-ssr-query** — Removed; add back if using TanStack Query with SSR
- **@tailwindcss/typography** — Removed with Tailwind

## Known Gotchas

- Plugin order in `vite.config.ts` follows the TanStack docs: `tanstackStart()`, then `nitro()`, then `viteReact()`.
- `nitro` is currently a beta release (3.0.x-beta), which is the version the TanStack Start docs target.
- File-based routing is automatic; adding a file to `src/routes/` creates a route. Run `pnpm dev` to regenerate `routeTree.gen.ts`.
- Biome ignores `node_modules`, `dist`, and generated `*.gen.ts` files.
- `tsconfig.json` sets `verbatimModuleSyntax: true` — use `import type {}` for type-only imports.
- Nitro does **not** load `.env` by itself in production, which is why `pnpm start` passes `--env-file-if-exists=.env`. Vitest reads `DATABASE_URL` from the shell.
- An unhandled failure in a route handler (e.g. a missing `DATABASE_URL` producing a `ConfigError`) currently returns **HTTP 200** with the error text as the body, instead of a 500. See the open review item.

## Next Steps

- Add routes by creating files in `src/routes/`
- Add styling by editing `src/styles.css` or bringing in a CSS framework
- Add TanStack Query if data fetching is needed
- Add authentication using `createServerFn` and session cookies
- Pick a Node host for deployment, or a Nitro preset if you want to target a specific platform
- Run `pnpm exec biome check --write .` after any bulk edits to auto-format and lint
