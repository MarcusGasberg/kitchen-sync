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

A minimal, blank TanStack Start app deployed to Cloudflare Workers.

## Scaffolding Commands

```bash
# Initial scaffold
npx @tanstack/cli@latest create kitchen-sync --agent --deployment cloudflare

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
- **Deployment**: Cloudflare Workers via Wrangler + @cloudflare/vite-plugin
- **Testing**: Vitest + jsdom + @testing-library/react

## Architecture

- `src/routes/` — File-based routes (`__root.tsx`, `index.tsx`, `about.tsx`)
- `src/router.tsx` — Router factory with type-safe registration
- `vite.config.ts` — Vite + Cloudflare plugin + TanStack Start plugin + React plugin
- `vitest.config.ts` — Vitest config (excludes Cloudflare plugin to avoid SSR external resolution conflict)
- `wrangler.jsonc` — Cloudflare Workers config
- `biome.json` — Single source of truth for formatting, linting, and import organization

## Scripts

| Script | Command |
|--------|---------|
| dev | `pnpm dev` — Vite dev server on port 3000 |
| build | `pnpm build` — Production build |
| preview | `pnpm preview` — Preview production build |
| test | `pnpm test` — Run Vitest |
| deploy | `pnpm deploy` — Build + deploy to Cloudflare Workers |
| lint | `pnpm lint` — Run Biome check |
| lint:fix | `pnpm lint:fix` — Run Biome check with auto-fix |
| format | `pnpm format` — Format with Biome |

## Environment Variables

- Public (non-secret) vars: configure in `wrangler.jsonc` under `vars`
- Secrets: use `wrangler secret put <NAME>` after authenticating with `wrangler login`
- Client-side env vars: must use `VITE_` prefix; server-side can use `process.env`

## Deployment Notes

1. Authenticate: `wrangler login`
2. Deploy: `pnpm deploy` (or `npx wrangler deploy` after building)
3. Compatibility date/flags are set in `wrangler.jsonc`
4. The Cloudflare Vite plugin handles the Worker build; `main` points to `@tanstack/react-start/server-entry`

## Key Dependencies Removed (Intentionally)

The following were present in the default TanStack CLI scaffold but removed to keep the app blank:
- **Tailwind CSS** — Removed to avoid locking in a CSS framework
- **lucide-react** — Removed; add back if icons are needed
- **@tanstack/react-devtools / devtools-vite / router-devtools** — Removed to keep the app minimal; add back for debugging
- **@tanstack/react-router-ssr-query** — Removed; add back if using TanStack Query with SSR
- **@tailwindcss/typography** — Removed with Tailwind

## Known Gotchas

- The Cloudflare Vite plugin must come **before** `tanstackStart()` in the Vite plugins array.
- `wrangler.jsonc` uses `"main": "@tanstack/react-start/server-entry"` — do not change this unless you provide a custom server entry.
- File-based routing is automatic; adding a file to `src/routes/` creates a route. Run `pnpm dev` to regenerate `routeTree.gen.ts`.
- Biome ignores `node_modules`, `dist`, and generated `*.gen.ts` files.
- `tsconfig.json` sets `verbatimModuleSyntax: true` — use `import type {}` for type-only imports.
- **Vitest + Cloudflare plugin conflict**: The Cloudflare Vite plugin conflicts with Vitest's default SSR external resolution. A separate `vitest.config.ts` is provided that excludes the Cloudflare plugin. Do not merge the Cloudflare plugin into Vitest config.

## Next Steps

- Add routes by creating files in `src/routes/`
- Add styling by editing `src/styles.css` or bringing in a CSS framework
- Add TanStack Query if data fetching is needed
- Add authentication using `createServerFn` and session cookies
- Configure Cloudflare bindings (KV, D1, R2, Durable Objects) in `wrangler.jsonc`
- Run `pnpm exec biome check --write .` after any bulk edits to auto-format and lint
