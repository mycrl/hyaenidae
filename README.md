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

## Features

- DOM-first browser automation for navigation, clicking, typing, tab management, and page inspection.
- Vision fallback when visible page state is not well represented in the DOM.
- Tool-based agent runtime built on `@openai/agents`.
- Configurable model providers through the settings UI.
- User-in-the-loop handling for login, captcha, OTP, payment approval, and other sensitive steps.
- Session memory with local fallback history and automatic context compression.
- Multi-tab browser workflow with an integrated AI side panel.

## License

This project is licensed under the GNU General Public License v3.0 only.
See [LICENSE](./LICENSE) for details.
