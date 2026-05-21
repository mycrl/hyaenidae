# AGENTS.md — Hyaenidae

Guide for coding agents working in this repository. Read this before making changes.

## What this project is

**Hyaenidae** is a desktop **AI browser** (Electron on Windows). Users browse the web in content tabs while an autonomous **agent** can navigate pages, run scripts, call tools, and stream responses in a side panel.

Design priorities (from product/runtime prompts):

- **DOM-first** automation; vision and mouse only when DOM is insufficient
- **Tab-aware** workflows (open, switch, close tabs)
- **Multi-provider** LLM support (OpenAI, Google, custom OpenAI-compatible HTTP endpoints)
- Long-running sessions with **compressed context** between turns

License: **GPL-3.0-only**.

## Monorepo layout

Yarn workspaces (`package.json` at repo root):

| Package             | Path      | Role                                                                                         |
| ------------------- | --------- | -------------------------------------------------------------------------------------------- |
| `@hyaenidae/app`    | `app/`    | Electron **main process**: window, tabs, downloads, settings persistence, agent RPC handlers |
| `@hyaenidae/ui`     | `ui/`     | **Renderer**: React 19 + Vite + Tailwind 4 + Zustand + i18next                               |
| `@hyaenidae/mavis`  | `mavis/`  | **Agent runtime**: AI SDK streaming, browser tools, in-memory sessions                       |
| `@hyaenidae/bridge` | `bridge/` | **IPC contract**: typed `Events` map, `BridgeMain` / `BridgeRenderer`                        |

Agent logic lives in **mavis** (there is no `core/` package).

```
┌─────────────────────────────────────────────────────────────┐
│  ui (renderer)          hyaenidae.bridge.request / .on      │
│  pages/shell, settings, downloads                           │
└───────────────────────────────┬─────────────────────────────┘
                                │ preload (contextBridge)
┌───────────────────────────────▼─────────────────────────────┐
│  app (main)             browser.shell.bridge.handle(...)    │
│  Browser, tabs, ElectronBrowserRuntime, settings, downloads │
└───────────────────────────────┬─────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────┐
│  mavis                  Mavis.ask(), SessionManager, tools    │
└─────────────────────────────────────────────────────────────┘
```

## How processes communicate

1. **Preload** (`app/src/browser/inject.ts`) exposes `globalThis.hyaenidae.bridge` to renderers.
2. **Types and event names** are defined once in `bridge/src/index.ts` (`Events` interface) and `bridge/src/types.ts`.
3. **Main handlers** are registered in:
    - `app/src/index.ts` — shell tabs, window chrome, **all `agent:*` RPC**
    - `app/src/browser/tab.ts` — per-tab views: settings and downloads
4. **UI callers** use thin wrappers in `ui/src/services/*.ts` (e.g. `agent.ts`, `shell.ts`, `settings.ts`).

When adding or changing an API:

1. Add the event to `bridge` `Events` + types in `bridge/src/types.ts`
2. Implement `.handle()` or `.send()` in `app` (correct file: main vs tab)
3. Call it from `ui/src/services/`
4. Rebuild `bridge` (`tsc`) if types are consumed across packages

Renderer global typing: `ui/src/vite-env.d.ts`.

## Agent / chat data flow

**Sessions** are owned by `mavis` (`mavis/src/sessions.ts` — `SessionManager`). Storage is **in-memory** today; disk persistence is intended to be added in mavis/app, not in the UI.

| RPC                         | Purpose                                                      |
| --------------------------- | ------------------------------------------------------------ |
| `agent:session-list`        | List session metadata                                        |
| `agent:session-get`         | Session + `chats[]` history (source of truth for UI history) |
| `agent:session-create`      | New session                                                  |
| `agent:session-remove`      | Delete session                                               |
| `agent:chat-ask`            | Start a turn; returns `askId`                                |
| `agent:chat-response`       | Stream: `text` \| `activity` \| `done` (main → renderer)     |
| `agent:chat-stop`           | Cancel by `askId`                                            |
| `agent:provider-get-models` | List models for a provider config                            |

**UI state** (`ui/src/services/agent.state.ts`):

- Loads history via `getAgentSession` on init and when switching sessions
- Keeps **ephemeral** state during streaming (`isResponding`, partial text, activities)
- Does **not** persist chat history locally; after a turn completes, mavis appends to `chats` on the main side

**Mavis** (`mavis/src/index.ts`):

- `ask()` runs LangChain `createAgent` with browser tools from `createBrowserUseTools`
- On success, `SessionManager.finishing()` compresses context, may rename session, appends user/assistant pair to `chats`
- `ElectronBrowserRuntime` in `app/src/runtime/` implements `BrowserRuntime` for tools (DOM, scripts, tabs, screenshots)

**Provider types** (settings + agent): `openai`, `google`, `custom` (OpenAI-compatible base URL). Legacy `local-runner` entries in saved settings are ignored or mapped to `custom` in the UI filter only.

## UI architecture

- **Entry**: `ui/src/main.tsx` — routes: `/` shell, `/settings`, `/downloads`
- **Production**: `MemoryRouter` + custom URLs (`hyaenidae://settings`, `hyaenidae://downloads`, shell webview)
- **Dev**: `BrowserRouter` for normal Vite dev
- **State**: Zustand stores in `ui/src/services/*.state.ts`; RPC helpers in sibling `*.ts` files
- **i18n**: `ui/src/i18n/` — keys in `locales/en-US.json` and `zh-CN.json` (add both when adding user-visible strings)
- **Styles**: feature CSS under `ui/src/styles/`; global `select` option styling in `index.css`; components use optional `tag` prop for debugging (see `vite-env.d.ts`)

Key shell UI: `ui/src/pages/shell/` (tabs, nav bar, agent panel).  
Settings sections: **Providers** (`provider.tsx`), **Browser** (`browser.tsx`).

## App / browser architecture

- `app/src/browser/` — `Browser`, `Tab`, protocol handler `hyaenidae://`, context menus, downloads
- `app/src/settings.ts` — encrypted user settings on disk
- `app/src/runtime/` — `ElectronBrowserRuntime` for mavis browser tools
- Content tabs vs shell webview: shell loads built UI from `ui/dist` (packaged as `webview/` via electron-builder)

**Platform**: `app/package.json` targets **win32** only.

## Build and run

From repo root (Yarn 4, `nodeLinker: node-modules`):

```bash
# Format
yarn format

# Bridge + mavis (TypeScript compile; bridge also runs preinstall build)
yarn workspace @hyaenidae/bridge build
yarn workspace @hyaenidae/mavis build

# UI production bundle (required before packaging app)
yarn workspace @hyaenidae/ui build

# App: preload bundle + main tsc + Electron
yarn workspace @hyaenidae/app build
yarn workspace @hyaenidae/app start   # or dev
```

Typical local dev:

1. `yarn workspace @hyaenidae/ui dev` (Vite, if testing UI in isolation)
2. `yarn workspace @hyaenidae/app dev` (builds preload, compiles main, launches Electron)

`app/build.js` bundles preload with esbuild → `app/dist/preload.js`.

## Conventions for agents

- **Minimize scope** — match existing patterns; avoid drive-by refactors
- **TypeScript** 6.x across packages; respect workspace package boundaries
- **Shared types** belong in `@hyaenidae/bridge`, not duplicated in ui/mavis
- **Agent behavior / tools / session storage** → `mavis` (+ handlers in `app/src/index.ts`)
- **Browser control / Electron** → `app`
- **Presentation / client state** → `ui`
- **IPC surface** → `bridge` first, then wire both sides
- No automated test suite in repo today; verify with `tsc` / package `build` scripts
- **Do not commit** unless the user asks
- **Prettier** is the formatter (`yarn format`)

## Common tasks (where to edit)

| Task                                 | Location                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------- |
| New IPC method                       | `bridge/src/index.ts`, `bridge/src/types.ts`, `app/...`, `ui/src/services/` |
| Agent prompt / tools / session logic | `mavis/src/`                                                                |
| Browser tool implementation          | `mavis/src/tools.ts` + `app/src/runtime/`                                   |
| Agent panel UX                       | `ui/src/pages/shell/agent-panel.tsx`, `agent.state.ts`                      |
| Tab / navigation                     | `ui/src/pages/shell/`, `app/src/browser/`                                   |
| API provider settings UI             | `ui/src/pages/settings/provider.tsx`                                        |
| Browser / font / homepage settings   | `ui/src/pages/settings/browser.tsx`                                         |

## Dependencies worth knowing

- **AI**: LangChain.js (`langchain`, `@langchain/openai`, `@langchain/google-genai`) in mavis
- **UI**: React 19, Zustand, react-i18next, Heroicons, markdown-it
- **Desktop**: Electron 41

## Out of scope / pitfalls

- **No local model runner** — Hugging Face download, on-device runners, and `model:*` IPC were removed; do not reintroduce without an explicit product decision
- UI user messages may differ from stored `chats` content (UI sends display text; main stores full prompt with injected browser context)
- Reloading session history while `isResponding` is intentionally skipped to avoid clobbering the stream
- `agent:session-get` uses `includeSummary: false` in the handler; summaries are for prompt building, not the chat transcript UI

## Related docs

- Human-oriented overview: `README.md`
- RPC catalog: `bridge/src/index.ts` (`Events` interface comments)
