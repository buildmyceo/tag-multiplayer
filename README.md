# TAG - 2 to 4 Player Multiplayer Game (Single Keyboard)

An exact, high-fidelity recreation of the famous **Tag by WeLoPlay** party game, built with HTML5 Canvas, responsive 60fps physics, procedural Web Audio, and single-keyboard local multiplayer for 2, 3, or 4 players!

---

## 🎮 Keyboard Controls (All 4 Players on 1 Keyboard)

| Player | Color | Left / Right | Jump | Drop Through Platforms |
| :--- | :--- | :--- | :--- | :--- |
| **Player 1** | 🔴 Red | `A` / `D` | `W` (or Space) | `S` |
| **Player 2** | 🔵 Blue | `◀` / `▶` (Arrow Left / Right) | `▲` (Arrow Up) | `▼` (Arrow Down) |
| **Player 3** | 🟡 Yellow | `J` / `L` | `I` | `K` |
| **Player 4** | 🟢 Green | `F` / `H` | `T` | `G` |

> [!TIP]
> Press `⌨ KEYS` in-game or `⌨ CONTROLS` on the menu to pop up the on-screen keyboard layout diagram!

---

## 🌟 Game Highlights

1. **100% Single-Keyboard Multiplayer (No Bots)**:
   * Play with 2, 3, or 4 friends crowding around a single laptop or PC keyboard!
   * Simultaneous key press detection with `e.code` and `e.key` so ghosting and Shift/CapsLock keys never interrupt movement.
   * Floating countdown player banners showing each player's exact keys before the match starts.
2. **Visual & UI Enhancements**:
   * **Main Menu:** Floating 3D extruded cartoon "TAG" title, central purple pillar with 2/3/4 Players buttons, animated ninja playground, orange bounce box, pink portal, and sound/fullscreen controls.
   * **Choose Map Screen:** 3 interactive 3D diorama cards (Forest, Winter, Desert) with hover lift & glow, map title badges, "GAME SETTINGS" button, and "⌨ CONTROLS" button.
   * **Settings Modal:** Exact pink dialog with thick 6px white border, BUFFS [ON][OFF] toggle, and TIME [60][120][180] selector.
   * **In-Game HUD:** Centered round timer pill (urgent red pulse under 10s), top-left Menu & Keys buttons, player status cards with active role (`IT!` / `RUN!`) and key reminders.
3. **Physics & Party Mechanics**:
   * **Tag Transfer:** When "IT" touches another player, the role transfers instantly with comic starburst particles, screen rumble, and a 1.3-second immunity shield to prevent instant revenge tags!
   * **Orange Bounce Pads:** Spring launch pads that compress and propel players high into the air.
   * **Teleporter Portals:** Swirling warp portals that instantly transport players across the arena.
   * **Buffs (when enabled):** Floating powerups including Speed Surge ⚡, Super Spring 🦘, and Freeze Ice ❄️.
4. **Audio Engine**:
   * Procedural Web Audio synthesizer (jump, boing, teleport whoosh, comic tag slap, countdown beeps, referee whistle, victory fanfare, and upbeat chiptune BGM).

---

## 🚀 Running Locally

```bash
npm install
npm run dev
```

Open your browser at: **[http://localhost:5173/](http://localhost:5173/)**
