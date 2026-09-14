<div align="center">

# A.V.E.N.

**A lightweight Windows AI agent built to understand your PC, remember useful context, and help you get real work done.**

[Website](https://mrsausainis.github.io/Aven-AI-Agent/) · [Latest release](https://github.com/MrSausainis/Aven-AI-Agent/releases/latest)

</div>

---

## About

A.V.E.N. is a Windows desktop AI assistant focused on practical PC interaction rather than being another chatbot in a window. It combines a compact always-on-top Dynamic Island interface with a full desktop chat experience, voice control, local tools, memory, and optional local AI.

The project is designed to stay lightweight while idle and use more expensive AI reasoning only when it is actually needed.

## Highlights

- **Dynamic Island interface** — compact always-on-top status, listening, timer, media, and action feedback without taking over the desktop.
- **Voice and manual chat** — use A.V.E.N. hands-free or from the main chat window.
- **Cloud or local AI** — connect supported cloud providers with your own API key, or run an optional local GGUF model on compatible hardware.
- **PC control** — launch and close apps, work with files and folders, inspect active windows and system state, and run supported desktop actions.
- **Memory and conversations** — persistent conversation history plus separate contextual memory designed to surface useful information when relevant.
- **Spotify and media control** — play specific songs or artists and control playback from natural-language requests.
- **Office and productivity tools** — supported spreadsheet, file-management, notes, timer, and workflow actions.
- **Guardian watchdog** — a separate supervision process monitors the desktop app and helps recover from unexpected failures.
- **Themes and multi-monitor support** — semantic themes, smooth UI motion, monitor-aware Dynamic Island placement, and per-monitor behavior.

## AI and privacy model

A.V.E.N. does not depend on one AI provider. Cloud AI can use a user-supplied provider key, while local AI is optional and downloaded separately rather than bundled into the installer.

Application settings, memory, sessions, and other user data are stored separately from the installation directory so updates can replace the application without replacing normal user data.

## Requirements

- **Windows 10 or Windows 11**
- An SSD is recommended.
- Cloud AI features require a supported provider/API key.
- Local AI is optional and benefits from a capable GPU with sufficient VRAM.
- Local model files are not included in the installer.

## Install

Download the latest Windows installer from the [Releases](https://github.com/MrSausainis/Aven-AI-Agent/releases/latest) page and run `AVEN-Setup.exe`.

A.V.E.N. is currently distributed as an unsigned Windows application, so Microsoft SmartScreen may show a warning on first launch or install.

## Project status

A.V.E.N. is under active development. The current focus is release stability, product polish, security, and turning the existing desktop-assistant foundation into a reliable long-term Windows agent platform.

For product information, downloads, account access, and current availability, use the [official website](https://mrsausainis.github.io/Aven-AI-Agent/).
