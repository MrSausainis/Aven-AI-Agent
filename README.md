<div align="center">

# Jysen AI

**A lightweight Windows AI assistant that understands your PC, remembers useful context, and helps you get real work done.**

[Website](https://get-avenai.netlify.app) · [Download](https://github.com/MrSausainis/Aven-AI-Agent/releases/latest) · [Changelog](CHANGELOG.md)

*Previously A.V.E.N. Same app, same data, new name.*

</div>

---

## About

Jysen is a Windows desktop AI assistant built for practical PC work rather than being another chatbot in a window. It combines a compact always-on-top Dynamic Island with a full desktop chat window, voice control, local tools, memory, and optional local AI.

Jysen stays light while idle and only uses heavier AI reasoning when it is actually needed.

## Highlights

- **Voice, push to talk and hotkeys.** Say "Jysen", or hold a key and talk. Global hotkeys you can change work even while a game is in front. Keys are only read, never hooked or injected.
- **Chat window.** Multi-line messages, message history on ↑/↓, time on every message, and right-click actions (copy, edit and resend, retry, read aloud). New replies don't pull you away while you are reading.
- **Dynamic Island.** Compact status for listening, timers, media and action feedback, with multi-monitor support.
- **Cloud or local AI.** Use a supported cloud provider with your own API key, or run an optional local GGUF model on compatible hardware.
- **PC control.** Launch and close apps, work with files and folders, check windows and system state. Closing apps and changing files always need an exact one-time approval.
- **Memory and conversations.** Searchable conversation history plus separate memory that brings back useful context when it matters.
- **Spotify and media.** Play specific songs or artists, use favorites, and control playback in plain language.
- **Office and productivity.** Spreadsheet, file, notes, timer and email-draft tools.
- **Guardian.** A separate watchdog process restarts Jysen after an unexpected failure, and respects Quit and Restart.
- **Themes.** Mature, Spectrum and Minimal theme families with variants.

## AI and privacy

Jysen does not depend on one AI provider. Cloud AI uses your own provider key, which is stored with Windows encryption, never in a plain-text file. Local AI is optional and downloaded separately; every model file is checked with SHA-256.

Settings, memory, conversations and other user data are stored separately from the app itself, so updates never replace them. Support reports remove keys, emails, IP addresses and personal paths before anything is saved.

## Requirements

- Windows 10 or Windows 11
- An SSD is recommended
- Cloud AI needs a supported provider API key
- Local AI is optional and works best with a GPU that has enough VRAM; model files are not in the installer

## Install

Download **`Jysen-AI-Setup.exe`** from the [latest release](https://github.com/MrSausainis/Aven-AI-Agent/releases/latest) and run it. Updating from A.V.E.N. keeps all your settings and data.

Jysen is currently unsigned, so Microsoft SmartScreen may show a warning the first time you install or run it.

## Project status

Jysen is under active development. See the [changelog](CHANGELOG.md) for what changed in each version and what is coming next.

Product information, account access and support are on the [website](https://get-avenai.netlify.app).

> This repository keeps its old name for now because installed copies of A.V.E.N. and Jysen look for updates here. It will be renamed once every supported version can follow the new name.
