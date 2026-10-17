# Changelog

All notable changes to Jysen AI (previously A.V.E.N.). Downloads are on the
[releases page](https://github.com/MrSausainis/Aven-AI-Agent/releases).

## [2.3.0] - 2026-10-17

Jysen meets your phone: calls and messages show up on the Dynamic Island, and the phone can control the PC. Jysen now hears its name on your PC, so it stops going deaf in long gaming sessions. Answers appear as they are written, the natural voice is new, Settings is rebuilt, and updates are now signed.

### ✨ New

#### Phone link (preview)
- **Pair your Android phone** in Settings → Phone link. Jysen works on the same Wi-Fi and over the internet. The connection is end-to-end encrypted, and the PC never opens a port: it always dials out to the phone.
- **Calls and messages on the Dynamic Island.** When someone calls or writes, the island shows who it is, so you don't miss it while you play. Choose what shows (calls, messages, other apps, the message text) and from whom (everyone, or only the people and apps you pick).
- **Many messages from one person** become one notice with a count, instead of a stream.
- **Missed calls when you're back.** If you were away from the PC, Jysen tells you about the calls you missed as soon as you use it again.
- The island stays solid (not see-through) while a call or message is shown.
- **Control the PC from the phone:** see its status, control music, and open or close apps. Each of these can be switched off in Settings → Phone link. A phone can never answer Jysen's own confirmations for you.
- **Confirm it's me.** The phone asks for your fingerprint or PIN once after each unlock before it controls the PC, so a lost phone can't.
- The Jysen Mobile Android app is in testing and will be on the website soon.

#### Jysen hears its name on your PC
- **A small model on your PC listens for "Jysen"**, so only what you say to Jysen goes to the cloud. Game voice chat and videos stay on your PC.
- This fixes **Jysen going deaf during long gaming sessions.** Always-on listening sent so much audio to the cloud speech service that its daily limit ran out.
- About 100 MB of memory and a sliver of one CPU core, no GPU: fine in games. It ships with the installer and sets itself up a few seconds after the first start. No download.
- It also gives **Local-only mode** a voice (English).
- If the cloud speech limit is reached anyway, Jysen switches to another speech model, and the island tells you instead of silently ignoring you.

#### Answers as they are written
- **Typed questions get their answer word by word**, as the AI writes it, instead of all at once at the end.
- **Formatting in the chat:** answers to typed questions show headings, lists, **bold** and code like other chat apps.
- **Pictures in research answers.** A web search answer can show a picture from the search, in the chat and on the island card. Switch it off in Settings → Dynamic Island → Pictures in research answers.

#### A new natural voice
- **Kokoro** replaces Pocket TTS as the natural local voice: clearer, and its first words start sooner. Get it in Settings → Voice & Audio. The old voice keeps working until you switch, and "Remove the old voice (Pocket TTS)" frees about 1.1 GB.
- **Cloud voice in games** (off by default). A game pauses the natural voice to keep the game smooth. Switch this on and a cloud voice speaks then instead of the Windows voice. It uses nothing on your PC.

#### AI
- **A new main cloud model**, GPT-OSS-120B, with the previous one as a fallback.
- **Gemma 4 as a local model.** Choose E2B, E4B or 12B in Settings → AI → Local AI model, to match your PC.
- **Games, apps and products it doesn't know** are looked up instead of guessed.
- **"Can you see my screen?"** now makes Jysen look at your screen.
- **Short media replies.** "Paused", "Next song", not a full sentence.

#### Apps
- **Jysen knows how popular apps really open and close.** Steam shuts down properly. Tray apps like Discord or FACEIT are fully closed, not just hidden. FACEIT AC is started before FACEIT, and never closed in the middle of a CS2 match.
- **Spotify questions:** "what's next?", "where is this playing from?" and "add … to the queue".
- **Undo a deleted chat** for 10 seconds.
- **An icon in the notification area** (by the clock): click it to open Jysen, right-click for Settings, the microphone and Quit. To keep Jysen running when you close the window, turn on Settings → General → Keep running when the window is closed.

#### Settings
- **Rebuilt like the Claude app.** A compact list of pages on the left with icons, your account at the top, Updates at the bottom, and Jysen's chat blurred behind.
- **Two columns** on wide windows, balanced so there are no empty gaps.
- **Account** is the first page, **Updates** the last. The old Advanced page is gone: its settings moved to AI, Voice & Audio and System.
- **Clearer rows.** Each setting has a bold name, a short grey explanation and a line between rows.

### 🐛 Bug fixes
- **Jysen woke up on its own from TikTok or game audio.** The speech service sometimes wrote "Jysen" by itself. A wake is now checked a second time before Jysen listens.
- **"Jai-sen" and a stretched "Jysen"** are now heard as the name.
- **An app Jysen had started could block the next update.** It loaded files from Jysen's own folder, so the installer couldn't replace them. Apps started by Jysen no longer do this.
- **The CS2 bomb timer** was a few seconds off. CS2 reports a plant late. The timer now measures CS2's delay from real explosions.
- **The answer card on the island** now opens on hover during a game too.

### 🔒 Security
- **Signed updates.** From this version on, Jysen installs an update only if it carries Jysen's own signature, on top of GitHub's checksum. An installer uploaded with a stolen GitHub login can't install itself.
- **Phone text is cleaned** before the island shows it, so a message can't hide or reverse what the island says.
- **Pairing limits per device.** Another device on the Wi-Fi can't use up the pairing attempts while you pair your phone.

### ⬆️ Updating from 2.2.0
**Check for updates** in Jysen finds this update. Your settings, keys, memory, chats and downloaded models carry over.

### ⚠️ Known limitations
- Phone link needs the Jysen Mobile Android app, which is not public yet.
- On Xiaomi/HyperOS phones, Autostart must be allowed for Jysen Mobile, or calls and messages don't reach the PC.
- Local listening understands English.

## [2.2.0] - 2026-10-13

A big one. Answers now appear right on the Dynamic Island, Jysen can act on your PC when you ask it in plain words, Settings opens as its own window, the chat gets the tools you know from other chat apps, resizing is several times smoother, and the last pieces of the old A.V.E.N. name are gone.

### ✨ New

#### Answers on the Dynamic Island
- **See the answer without opening Jysen.** The island grows down into a card with Jysen's last answer, so you can read it while Jysen's window is in the background. Long answers scroll with the mouse wheel.
- **On hover (default):** rest the mouse on the island for a moment to open the last answer, and move away to close it. **Open by itself** shows each answer as it arrives. **Off** turns it off. Choose in Settings → Dynamic Island → Answers on the island.
- **Copy what you need.** Drag to select text, then Ctrl+C or right-click → Copy selection. Copy answer copies all of it.
- **Click the card** (or right-click → Open in Jysen) to open Jysen at that message.
- **Sources.** Answers from a web search show their sources at the bottom of the card; click one to open it in your browser.
- The card never opens over a game by itself.

#### Jysen's AI can use Jysen
- **Ask in your own words, and it happens.** "Can you resume Spotify?", "open Discord and play some Queen", "set a timer for ten minutes" now work even when they are phrased as a question or combine several actions. The AI runs Jysen's own commands for you.
- **The same safety rules apply.** The AI goes through the exact path a typed command does: your permission mode, the confirmation before closing an app and the refusal to shut down the PC all still apply. Some things only you can ask for, never the AI on its own: shutting down, restarting or signing out, deleting history, notes or files, and uninstalling.
- **It no longer pretends.** Before, the AI could reply "Resumed Spotify" without doing anything. Now it only says something happened when it really did.
- Each request carries only the hints that matter for it (music, apps, timers…), so answers stay fast.
- **Ask how your PC is doing.** "What are my PC's stats?" now gets a real answer: the AI measures CPU, RAM, GPU and Windows version with Jysen's diagnostics. Before, it said it had no way to check.
- **Misheard names.** Speech-to-text sometimes gets names wrong. The AI now reads a misheard name as the closest real one ("damiana david" is Damiano David), looks it up when it is not sure, and does not invent facts about people.

#### A better chat window
- **Edit a message where it is.** Right-click one of your messages and choose **Edit message**. It opens in place: Enter sends, Esc cancels. Everything after that message is replaced by the new answer, like in other chat apps. The saved history and the AI's memory of the chat are trimmed the same way.
- **Text size:** Ctrl + / Ctrl − / Ctrl 0, from 10 to 24 pt.
- **Drafts per chat.** Unsent text stays with the chat you typed it in.
- **Export a chat** to a text file from the chat list menu.
- **Find in chat:** Ctrl+F. Every match is highlighted, and Enter / Shift+Enter move between them.
- **Rounded menus.** Right-click menus and Settings dropdowns are now rounded with a thin dark edge, in the app's theme, instead of the square Windows ones. They close like normal menus: choose an item, press Esc, or click anywhere else.

#### Dynamic Island
- **Include the artist** no longer keeps the artist on screen all the time. It shows for 3–5 seconds when a song starts (longer names a little longer), then hides. Switching the setting on shows it once more. A song already shown is not shown again. Rest the mouse on the island for about a second to see it again.

#### CPU and RAM alerts
- **No more alerts for short spikes.** The island warns about high CPU or RAM use only after it has lasted about 5 seconds. If you show CPU use all the time, it simply turns red instead of opening a separate alert.

#### CS2 match timer
- **Just the time**, see-through like the island over a game. The score is gone, since CS2 shows it already.
- **The bomb.** When it is planted, the timer opens up with the seconds until it explodes (blinking for the last 10), then the defuse countdown while someone defuses, then "Defused" or "Exploded" for a moment.
- **A thin line** shows the round's time left: buy time in your theme's colour, amber for the last 10 seconds. The bomb's line drains red, a defuse fills in green.
- The countdowns come straight from CS2. Restart CS2 once after updating so it picks up the new settings Jysen writes for it.

#### Settings
- **Settings opens as its own window** in the middle of Jysen, like in the Claude app, instead of a side panel. Prefer the panel? Switch back in Settings → General → Settings opens as.
- **Shorter texts.** Each setting is explained in one sentence. Credits and licences moved to the end of System.
- **Search finds settings by name.** Type a setting's own name, such as "include artist", "start minimized" or "push to talk works", and Settings opens that page and scrolls straight to it. Close spellings work too ("microfone", "transparancy").
- **Easier to scan.** A setting's name is now larger and bold, and its explanation stays small.
- **Default hotkeys.** If both were empty, Stop speaking is set to Ctrl+Alt+S and Show Jysen to Ctrl+Alt+J. You can change or clear them in Settings.
- **Voice log for an hour** (Advanced → Logs) records what Jysen heard and whether it counted as the wake word, to trace a wake you did not expect. It switches itself off after an hour.

#### Jysen everywhere
- The app is now **Jysen.exe** and its watchdog **JysenGuardian.exe**.
- The sidebar shows the Jysen logo, in your theme's colours, instead of a plain "J".
- New installs go to `Programs\Jysen AI`, and your data lives in `%LOCALAPPDATA%\Jysen`.
- See **Updating from A.V.E.N. / 2.1.0** below for what happens to an existing install.

### 🐛 Bug fixes

#### Voice
- **Jysen woke up on its own while you talked to friends.** Words one letter away from its name, such as "Tyson", "risen" or "Dyson", counted as the wake word anywhere in the first four words. Now a near-miss only counts at the start of a sentence (after "hey", "ok" or "um" at most) and must start with the same sound as "Jysen". Saying "Jysen" clearly still works, even a few words in.
- Each time Jysen wakes, the voice log now records which word woke it (only that word, never the sentence), so any future false wake can be traced.
- **Push to talk cut Jysen's answer short as soon as the key was pressed**, even when held by accident. Now Jysen stops only when you actually start talking. Its own voice coming back through the microphone is no longer taken as a command either.
- **A quick push-to-talk command was lost.** Pressing the key, saying "pause" and letting go at once ended the listening before the words had arrived. Jysen now waits a moment after you let go for words still on their way.
- **Push to talk right after starting Jysen** seemed to do nothing while the microphone was still starting. The island now says "Mic starting", and what you say still counts once it is ready.
- **The natural voice only loaded after the first answer**, so that answer always used the Windows voice. It now loads by itself a few seconds after Jysen starts (or as soon as you start typing).
- **The Windows voice answered after Jysen had been open a long time.** The natural voice was unloaded when idle and the first answer after that used the fallback. It now stays loaded and is only unloaded when the PC is short on memory.
- **"How are you, Jysen?" with push to talk** lost everything before the name when the name came last. The whole sentence now counts.

#### Commands
- **"Never mind, can you resume it" was not understood** as a music command after "pause Spotify" and went to the AI instead. Phrases that start with "never mind", "ok" and similar, followed by "can you…", are now recognised.
- **"Play the previous song"** searched Spotify for a song called "the previous song". It now goes back a track, like "previous song" did.
- **"How are you doing today?"** ran the full system diagnostics because of the word "doing". Now it is small talk again.

#### AI
- **The AI described things it could not check**, such as "your internet is working great", and asked "what would you like me to try?" after you had already agreed to its offer. It now says plainly when it cannot check something, and does what it offered once you say yes.
- **The AI was told every user had a ROG Strix G15 laptop**, a line left from development. Removed: it now checks the real PC when asked.
- **Background voices became "preferences".** Game voice chat heard as one long message was saved in the user profile as something you "hate". Jysen now only learns a short, clear preference, such as "I prefer short answers".
- **A command window flashed** on screen during some answers, from a GPU check. Fixed.
- **Diagnostics said Windows 10** on Windows 11. Fixed.

#### Window and Settings
- **An edited message lost its spacing** and stuck to the message above it. Fixed.
- **The right side of the header jumped** left for a moment when the sidebar was opened or closed. Fixed.
- **Resizing the window lagged**, badly with Settings open (up to more than a second per step). Windows repainted the whole window at every step of a drag. Now only what changed is redrawn, as Chromium-based browsers do. Measured per step:

  | | Before | After |
  |---|---|---|
  | Empty chat | ~88 ms | ~37 ms |
  | Long chat | ~125 ms | ~53 ms |
  | With Settings open | ~435 ms | ~53 ms |

  Layout work and saving the window size now wait until you let go of the edge.
- **Searching Settings for "hotkey"** opened Voice & Audio at the top, with the hotkey card far below. It now scrolls straight to the card. "Push to talk", "shortcut" and "keybind" do the same.

#### Now Playing
- **Lighter on Windows' media service.** Jysen asked Windows' "Now Playing" service for a brand-new connection up to five times a second, and kept asking when the service stopped answering. It now keeps one connection and waits longer between tries while the service is not answering. (If Task Manager shows "Service Host: Local Service – NPSMSvc" using a lot of CPU, restarting that service or the PC clears it.)

#### Logs
- **The error log filled up while the PC was locked**: every Now Playing check failed and was logged, about 2000 lines an hour. A failing check is now logged once, and once more when it works again.
- The CS2 match timer now writes one line to the log whenever the reason it is shown or hidden changes, so a timer that does not appear can be traced.

### ⬆️ Updating from A.V.E.N. / 2.1.0
**Check for updates** in A.V.E.N. 2.0.0 and Jysen 2.1.0 finds this update. Your settings, keys, memory, chats, notes and downloaded models all carry over. Nothing is downloaded again.

- **Program folder.** If Jysen was installed in the default `Programs\AVEN` folder, the update installs into `Programs\Jysen AI` and removes the old folder, which only ever held program files. If you chose your own folder, it stays where it is.
- **Your data.** On first start, `%LOCALAPPDATA%\AVEN` is renamed to `%LOCALAPPDATA%\Jysen` and its files from `aven_…` to `jysen_…`. It is a rename, not a copy, so it is instant even with large local models. If something is holding a file at that moment, Jysen keeps using the old location and finishes the move on a later start. Nothing is overwritten or lost.
- **Shortcuts.** Start menu and desktop shortcuts are recreated with the Jysen icon. The old "A.V.E.N" Start menu folder is replaced by "Jysen AI". "Launch with Windows" is pointed at the new program automatically. A taskbar pin made for the old AVEN.exe needs to be pinned again.
- **The natural voice** keeps working after the move: Jysen re-points its model files to the new folder by itself.
- **The taskbar icon** now always shows the Jysen mark. Before, a window started from an old shortcut could show a stale Python icon.
- Going back to 2.1.0 after updating would start with empty settings, because 2.1.0 looks in the old folder. Your data is still safe in `%LOCALAPPDATA%\Jysen`.

### ⚠️ Known limitations
- Hotkeys are read with standard Windows key state, which games running as administrator may block.
- The AI acts through Jysen's commands. It cannot click around in other apps.

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
