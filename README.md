<p align="center">
  <img src="./logo.svg" alt="Hyaenidae logo" width="160" />
</p>
<h1 align="center">Hyaenidae</h1>
<p align="center">
  An AI browser with DOM-first automation, vision fallback, tool calling, and flexible multi-provider support.
</p>
<div align="center">
    <img src="https://img.shields.io/github/license/mycrl/hyaenidae?style=flat-square"/>
    <img src="https://img.shields.io/github/issues/mycrl/hyaenidae?style=flat-square"/>
    <img src="https://img.shields.io/github/stars/mycrl/hyaenidae?style=flat-square"/>
</div>

## Features

Hyaenidae combines a browser shell, agent runtime, and UI layer into one desktop app for running autonomous web tasks. It focuses on reliable navigation and page interaction first, then falls back to vision when DOM access is not enough.

The app is designed for long-running agent sessions, tab-aware workflows, and provider flexibility. It can stream agent activity while keeping browser state, settings, and downloads coordinated across the shell and renderer.

## How It Works

The Electron main process owns browser control and IPC, while the core package handles agent turns, session management, and model routing. The bridge package keeps the shared event and type contract between layers so the UI and runtime stay in sync.

The renderer is built separately with Vite and focuses on presentation, while the runtime code in app coordinates browser tabs, downloads, and execution helpers. That split keeps automation logic, browser control, and UI concerns isolated without making the app fragmented.

## License

[GPL-3.0](./LICENSE)
Copyright (c) 2026 Mycrl.
