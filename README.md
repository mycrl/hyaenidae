<p align="center">
  <img src="./logo.svg" alt="Hyaenidae logo" width="160" />
</p>
<h1 align="center">Hyaenidae</h1>
<p align="center">
  An AI browser agent with DOM-first automation, vision fallback, tool calling, and flexible multi-provider support.
</p>

## Overview

Hyaenidae is a desktop AI browser agent designed to complete real web tasks with a browser-native workflow.
It combines DOM-first page automation with screenshot-based fallback reasoning, provider-configurable models, structured tool calling, and session context management for longer-running tasks.

The project is organized as a small monorepo with separate packages for the desktop shell, shared bridge contracts, core agent runtime, and renderer UI.

## Features

- DOM-first browser automation for navigation, clicking, typing, tab management, and page inspection.
- Vision fallback when visible page state is not well represented in the DOM.
- Tool-based agent runtime built on `@openai/agents`.
- Configurable model providers through the settings UI.
- User-in-the-loop handling for login, captcha, OTP, payment approval, and other sensitive steps.
- Session memory with local fallback history and automatic context compression.
- Multi-tab browser workflow with an integrated AI side panel.

## Architecture

The repository is split into four workspaces:

- `app` - desktop shell, browser runtime, IPC handlers, and window/tab orchestration.
- `ui` - renderer application, settings UI, agent panel, and local UI state.
- `core` - agent runtime, prompts, tools, session handling, and provider integration.
- `bridge` - shared RPC contracts used across the application.

## Getting Started

### Prerequisites

- Node.js 20+
- Yarn 1.x

### Install

```bash
yarn install
```

### Development

Start the renderer in one terminal:

```bash
yarn workspace @hyaenidae/ui dev
```

Build the shared packages and start the desktop app in another terminal:

```bash
yarn workspace @hyaenidae/bridge build
yarn workspace @hyaenidae/core build
yarn workspace @hyaenidae/app dev
```

The default local shell URL is configured for the renderer dev server at `http://localhost:5173`.

### Build

```bash
yarn workspace @hyaenidae/bridge build
yarn workspace @hyaenidae/core build
yarn workspace @hyaenidae/ui build
yarn workspace @hyaenidae/app build
```

## Configuration

Runtime shell configuration lives in [config.json](./config.json).

By default it defines:

- the initial tab URL
- the renderer shell URL
- the settings page URL
- the default window size
- whether devtools open automatically

Model providers are configured from the in-app settings page rather than hard-coded in source.

## Project Structure

```text
.
├── app/
├── bridge/
├── core/
├── ui/
├── config.json
├── logo.svg
└── package.json
```

## Current Focus

Hyaenidae is focused on practical browser-agent execution:

- continue tasks across turns without losing key context
- ask for clarification when the user goal is underspecified
- pause for user-owned actions such as login or payment confirmation
- keep future turns compact through post-run context compression

## Contributing

Issues and pull requests are welcome.

If you plan to contribute significant changes, open an issue first so the approach can be discussed before implementation.

## License

This project is licensed under the GNU General Public License v3.0 only.
See [LICENSE](./LICENSE) for details.
