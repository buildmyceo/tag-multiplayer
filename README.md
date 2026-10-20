# TAG - 2 to 4 Player Multiplayer Game (Local & Online)

An exact, high-fidelity recreation of the famous **Tag by WeLoPlay** party game, built with HTML5 Canvas, responsive 60fps physics, procedural Web Audio, and support for both **1-Keyboard Local Play** and **Multi-Device Online Multiplayer**!

---

## 🌐 Playing Online Across Other Devices (Phones, Tablets & PCs)

You can play with friends across different devices on your local Wi-Fi or public network!

### 1. Host Creates a Room:
1. Open the game and click **`🌐 PLAY ONLINE`**.
2. Click **`➕ CREATE A ROOM`**.
3. Select your desired player count (2, 3, or 4 players) and map (Forest, Winter, Desert).
4. You will get a 4-letter **Room Code** (e.g. `J7KP`).

### 2. Friends Join from Other Devices:
* On another phone, tablet, or PC on the same Wi-Fi network, navigate to:
  **`http://192.168.1.192:5173/`**
* Click **`🌐 PLAY ONLINE`** -> **`🔑 JOIN WITH ROOM CODE`** and enter the code.
* Alternatively, share the direct link: **`http://192.168.1.192:5173/?room=J7KP`** to join automatically!
* Once at least 2 players are in the lobby, the host clicks **`START MATCH!`** and the game starts in sync across all devices!

---

## 🎮 Single-Keyboard Local Controls (All 4 Players on 1 Keyboard)

If you're playing locally on one PC, everyone can crowd around the same keyboard:

| Player | Color | Left / Right | Jump | Drop Through Platforms |
| :--- | :--- | :--- | :--- | :--- |
| **Player 1** | 🔴 Red | `A` / `D` | `W` (or Space) | `S` |
| **Player 2** | 🔵 Blue | `◀` / `▶` (Arrow Keys) | `▲` (Arrow Up) | `▼` (Arrow Down) |
| **Player 3** | 🟡 Yellow | `J` / `L` | `I` | `K` |
| **Player 4** | 🟢 Green | `F` / `H` | `T` | `G` |

*(In Online Mode, each player simply controls their own character with `WASD`, Arrow keys, or on-screen touch buttons!)*

---

## 🌟 Game Highlights

1. **Realtime Online Multiplayer (WebSockets)**:
   * Low-latency WebSocket synchronization between host and clients.
   * Realtime position, velocity, and jump syncing.
   * Synchronized "IT" tagging, comic starburst impacts, immunity cooldowns, and round countdowns.
2. **Visual & UI Replication**:
   * **Main Menu:** Floating 3D cartoon "TAG" title, central purple pillar with 2/3/4 Players and Online Play buttons, animated ninja playground.
   * **Choose Map Screen:** 3 interactive 3D diorama cards (Forest, Winter, Desert).
   * **Settings Modal:** Exact pink dialog with thick 6px border, BUFFS [ON][OFF] toggle, and TIME [60][120][180] selector.
   * **In-Game HUD:** Centered timer pill (pulses red when <10s), player status badges (`IT!` / `RUN!`), sound and key helper buttons.
3. **Audio Engine**:
   * Procedural Web Audio synthesizer (jump, boing, teleport whoosh, comic tag slap, countdown beeps, referee whistle, victory fanfare, and upbeat chiptune BGM).

---

## 🚀 Running the Game

To start both the client and WebSocket server:
```bash
npm install
npm run start
```

Or individually:
* Client: `npm run dev` (running on `http://localhost:5173/` and `http://192.168.1.192:5173/`)
* Server: `npm run server` (WebSocket server on port `3001`)
