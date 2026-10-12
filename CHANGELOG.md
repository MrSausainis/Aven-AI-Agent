# Changelog

All notable changes to Jysen AI (previously A.V.E.N.). Downloads are on the
[releases page](https://github.com/MrSausainis/Aven-AI-Agent/releases).

## [2.1.0] - 2026-10-12

The first update after 2.0.0. A.V.E.N. is now **Jysen**, with a new look and new voice controls, a much better chat window, and a long list of fixes.

### ✨ New

#### Push to talk and hotkeys
- **Push to talk.** Hold a key and talk to Jysen without saying its name.
  - A pause does not cut you off.
  - Pressing the key stops Jysen talking.
  - Letting go sends the command as soon as it is transcribed.
- **Two ways it can work** (Settings → Voice & Audio):
  - **Hold** the key while you talk;
  - **Toggle**: press once to start, press again to send.
  - After 30 seconds Jysen sends what you said instead of dropping it.
- **Push-to-talk only mode.** Jysen stops listening for its name and hears you only through the key.
- **Global hotkeys you can change.** They work even while a game is in front.

  | Action | Default key |
  |---|---|
  | Push to talk | – |
  | Stop Jysen | Ctrl+Alt+S |
  | Show Jysen | Ctrl+Alt+J |
  | New chat | – |
  | Open Settings | – |
  | Mute microphone | – |
  | Dynamic Island on/off | – |

  - Mouse 4/5, F13–F24, Caps Lock, Right Ctrl/Alt/Shift and combinations such as Ctrl+Shift+K all work.
  - Ordinary keys like **V**, **2** or **Space** work too. Because they also type text, they count only when held for a moment (0.2 s), so normal typing never triggers them.
  - Jysen only *reads* the key, so the game or app in front still receives it. There is no keyboard hook and no injection, so typing and games never lag.
- **Mute microphone.** Jysen hears nothing until you unmute, and it stays muted after a restart.

#### A better chat window
- **Multi-line messages.** Enter sends and Shift+Enter starts a new line. The box grows up to six lines, and pasted text keeps its lines.
- **↑ / ↓ message history.** Press ↑ in an empty box to bring back what you sent before.
- **Time on every message**, in live chats and when you reopen an old one.
- **Reading is no longer interrupted.** If you scroll up, new replies don't yank you back down; a **↓ New messages** button appears instead.
- **Right-click any message** to Copy it. On your own messages you also get **Edit and resend** and **Send again**; on Jysen's replies, **Retry** and **Read aloud**.

#### New name, new look
- **A.V.E.N. is now Jysen.** It has a new app icon (window, taskbar, Start menu, desktop shortcut and installer) and a new wake word, "Jysen", which also understands "Jai-sen". Wake words you added yourself keep working, and your data and settings carry over.
- **Theme families with variants:** Mature, Spectrum and Minimal. Each has its own shapes and spacing, and Jysen remembers the last variant you used in each.
- **The window works at much smaller sizes** and remembers its size between launches.
- **Settings has a search box and a per-section Reset.** Every category stays reachable even in a narrow window.
- **The onboarding and guided tour now open inside the main window** instead of separate pop-ups.

#### Conversations
- **Saved conversation history** with search by title *and* message content, rename and delete.
- **Each launch opens a fresh chat**, with a single "New chat" button that no longer creates empty chats.
- **Local commands** such as timers and app launches are saved in the chat where you gave them.

#### Features
- **Email drafts.** "compose email to … subject … body …" opens your mail app with the draft filled in. Jysen never sends mail on its own.
- **Timers:** pause/resume, natural amounts ("thirty two seconds", "a 10-minute timer"), and cancelling one specific timer.
- **Music:**
  - Spotify favorites and remembered choices;
  - smarter handling of ambiguous song requests;
  - a recent listening history you can clear.
- **Natural local voice (optional download).** Every file is verified before install, and a failed update restores the previous voice.
- **Local AI:**
  - a reasoning on/off control;
  - GPU memory is freed automatically while you play;
  - verified, resumable model downloads;
  - all-or-nothing runtime updates.
- **Gaming:** games are detected automatically, and Performance Guard keeps Jysen light while you play.
- **Permission modes:** Always Ask, Balanced (default) or Full Access. Closing apps and changing files always need an exact one-time approval.
- **System Status and a support report** that remove keys, emails, IP addresses and personal paths before anything is saved.

---

### 🐛 Bug fixes

#### Voice
- **Long or fast commands no longer get lost.**
  - Speech capture and end-of-speech detection were reworked, so a sentence said in one breath ("Jysen open Discord") is not cut off.
  - The microphone threshold no longer drops so low that fan or keyboard noise counts as speech.
- **Stop works immediately.**
  - Saying or pressing Stop cancels voice input that was already on its way.
  - A late transcription can no longer turn into a command after you stopped.
- **Voice sessions have a hard time limit**, so a session that hangs cannot fire a command much later.
- **With no AI provider set up, Jysen now tells you so** in the chat and out loud. Before, the message went only to the Telemetry log, so you got no answer and the Dynamic Island stayed on "Thinking..." forever.
- **Ordinary sentences no longer trigger actions.** Some examples:
  - "I need to stop procrastinating" used to silence Jysen;
  - "the mute button is broken" used to press mute;
  - "should I play Minecraft" used to launch the game;
  - "remove this song from favorites" used to cancel a running timer.

  Now a command has to actually *be* a command.

#### Timers
- Cancelling a timer at the exact moment it ran out made Jysen say both "Cancelled" and "The timer has finished". Now it says only one.
- "Set a thirty two second timer" set a **2**-second timer, and "32-second timer" was ignored. Both work now.
- "Cancel the timer" with several timers running could cancel the wrong one. Now Jysen asks which one you mean.

#### Chat and conversations
- A reply that arrived just after you deleted a chat could bring the deleted chat back. It no longer can.
- Pressing "New chat" repeatedly left empty "New conversation" rows in the list. It doesn't anymore.
- Conversation title search stopped after 500 results.
- Results of local commands could land in the wrong chat after you switched chats.

#### Settings and windows
- **Text broke mid-word or was clipped** when Settings was reopened after resizing the window.
- **The Settings panel could end up too wide or too narrow** after resizing, maximizing or collapsing/restoring the sidebar.
- **Settings menu labels were cut off** at narrow widths.
- Hover tooltips and overlay widgets could appear off-screen on multi-monitor setups.
- Dialogs did not handle the keyboard properly (Enter/Esc/focus).
- The Send button and helper text were hard to read in some themes.
- *Found in pre-release testing and fixed before 2.1.0:*
  - a quick tap of a hotkey could be missed if it started and ended between two key checks;
  - pressing Esc while Jysen waited for a new hotkey closed Settings but kept waiting, so the next key you pressed anywhere could be assigned. Esc or leaving Settings now cancels it, and nothing changes;
  - Show Jysen (Ctrl+Alt+J) pressed from another app only flashed the taskbar button, because Windows blocked the switch. Jysen now comes to the front;
  - Settings refused every ordinary key (letters, digits, Space), so it looked as if no key could be set.
- **Starting Jysen while a fullscreen game was open** pulled focus away from the game. Jysen now starts minimized and gives focus back.

#### Account
- **Logging out now clears your session on this PC immediately**, even offline; the server sign-out happens in the background.
- An old account tier could reappear after logging out or switching accounts.
- Clicking "Log in" twice could start two browser logins that interfered with each other.

#### Stability and Guardian
- **Guardian restarted Jysen even after you chose Quit or Restart.** It now respects your choice.
- When a helper library was missing, **Guardian could accidentally terminate Jysen** while only checking whether it was running.
- Guardian could attach to the wrong program if it had the same file name.
- Logs (error, voice, Guardian) grew without limit. They now rotate.
- Shutdown is clean, and settings and music preferences are always saved before exit.
- The Dynamic Island used CPU even when idle; its visualizer redrew every frame.
- Account tier changes could overwrite your saved Dynamic Island and widget preferences.

#### Downloads, files and security
- **A partly downloaded AI model could look "installed"** and then fail when loaded. Every model is now checked with SHA-256.
- **A failed local-AI runtime update could leave no working runtime.** The previous one is now restored.
- Installed extensions are checked for tampering before every use, and an interrupted update rolls back.
- **API keys moved out of the plain-text `.env` file** into Windows-encrypted storage, automatically.
- **Office tools:**
  - merging files dropped columns that only later files had;
  - splitting a file could overwrite outputs whose names clashed;
  - text from a spreadsheet or receipt could be stored as a formula;
  - an existing file could be overwritten.
- **Email drafts showed "+" instead of spaces** in the subject and body.
- Notes and memory changes are now saved atomically; stale buttons can no longer change the wrong item.

---

### ⚠️ Known limitations
- Push to talk and hotkeys are new. Please report any game or keyboard where they don't work.
- Hotkeys are read with standard Windows key state, which games running as administrator may block.
- Ctrl+Alt defaults can clash on keyboard layouts where AltGr = Ctrl+Alt. You can change or clear them in Settings.
- Resizing the window can still feel laggy. A reworked resize is planned for **2.2.1**.
- Media follow-ups that only say "it" ("can you resume it") are not recognized as commands yet. Say "resume", "resume Spotify" or "pause the music" instead.
- When a request goes to the AI instead of a local command, the AI can wrongly say it did something (for example "Resumed Spotify"). It cannot control apps itself yet; see 2.2.0 below.
- Holding the push-to-talk key while Jysen is speaking stops the reply at once, even if you don't say anything. In **2.2.1** Jysen will only stop once you actually start talking.
- Anything that doesn't work as expected will be fixed in **2.2.1**.

### Coming in 2.2.0
- Text size: Ctrl + / Ctrl − / Ctrl 0.
- Per-chat drafts.
- Export a conversation.
- Find in chat (Ctrl+F).
- Edit a message in place. Everything after it is replaced by the new answer, like in other chat apps.
- Jysen's AI learns what Jysen can do (Spotify, Office tools, timers...) and can use those tools itself, instead of saying it can't.
- Planned later: close to tray, undo delete, Windows notifications, replies that appear as they are written, formatted code blocks, and pasting images.

## [2.0.0] - 2026-09-14

The largest A.V.E.N. release at the time, turning the project into a much more complete and reliable Windows AI agent.

### Highlights

- Reworked Dynamic Island with smoother animations, themes, multi-monitor support, and improved action feedback
- Persistent conversation history and improved contextual memory
- More reliable voice/STT behavior and microphone handling
- Spotify song and artist playback with media controls
- Improved application, file, window, and system control
- Reasoning controls for manual chat
- Stronger Guardian watchdog, recovery, and single-instance protection
- Improved AI provider reliability and fallback behavior
- Secure desktop authentication with state validation and Windows DPAPI session storage
- Improved account integration and redesigned website/account experience
- Installer, update, runtime, and user-data handling hardened for release

## [1.2.1] - 2026-09-08

Maintenance release of A.V.E.N. No detailed notes were published.

[2.1.0]: https://github.com/MrSausainis/Aven-AI-Agent/releases/tag/2.1.0
[2.0.0]: https://github.com/MrSausainis/Aven-AI-Agent/releases/tag/2.0.0
[1.2.1]: https://github.com/MrSausainis/Aven-AI-Agent/releases/tag/1.2.1
