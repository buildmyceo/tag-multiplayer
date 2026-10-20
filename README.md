# TAG - 2 to 4 Player Multiplayer Game

An exact, high-fidelity recreation of the famous **Tag by WeLoPlay** multiplayer game, built with HTML5 Canvas, modern physics, procedural Web Audio, and responsive graphics.

---

## 🎮 How to Play

### Player Controls (Single Keyboard Shared)
* **Player 1 (Red):** `A` / `D` to move left/right, `W` to jump, `S` to drop through platforms
* **Player 2 (Blue):** `◀` / `▶` arrow keys to move, `▲` to jump, `▼` to drop through platforms
* **Player 3 (Yellow):** `J` / `L` to move, `I` to jump, `K` to drop through platforms
* **Player 4 (Green):** `F` / `H` to move, `T` to jump, `G` to drop through platforms
* **AI Bot Option:** You can also play solo! Any player slot can be toggled to a smart AI Bot right from the in-game HUD!

---

## 🌟 Game Features

1. **Exact Visual Replica of WeLoPlay Tag:**
   * **Main Menu:** 3D extruded cartoon "TAG" title, central purple pillar container, 2 PLAYERS / 3 PLAYERS / 4 PLAYERS buttons, animated bouncing ninjas, trees, bounce box, and portal!
   * **Choose Map Screen:** 3 diorama cards (Forest, Winter, Desert) with hover lift & glow animations, "GAME SETTINGS" button, and back button.
   * **Settings Modal:** Exact pink dialog with thick 6px white border, "BUFFS [ON][OFF]" toggle, and "TIME [60][120][180]" selector.
2. **Dynamic Physics & Mechanics:**
   * **Tagging Transfer:** When "IT" touches another player, the role transfers instantly with comic starburst effects, screen rumble, and a 1.3-second immunity cooldown to prevent instant tag-backs!
   * **Orange Bounce Pads:** Spring-loaded launch pads that launch you high into the air.
   * **Teleporter Portals:** Swirling warp portals that instantly transport you across the map.
   * **Semi-Solid Platforms:** Jump through from underneath or drop through by pressing Down.
   * **Buffs (When Enabled):** Spawnable powerups including Speed Surge ⚡, Super Spring 🦘, and Freeze Ice ❄️.
3. **Audio Engine:**
   * Procedural synthesized sound effects (jump, boing, teleport whoosh, tag slap, countdown beep, victory fanfare) and upbeat chiptune BGM with a top-right toggle button.

---

## 🚀 Running Locally

```bash
npm install
npm run dev
```

Open your browser at: **[http://localhost:5173/](http://localhost:5173/)**
