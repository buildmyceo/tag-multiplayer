// Central Game Engine for Tag Multiplayer

import { soundManager } from './audio.js';
import { ParticleSystem } from './particles.js';
import { Player } from './player.js';
import { MAPS, drawMap, drawDiorama } from './maps.js';

export const GAME_STATES = {
  MENU: 'MENU',
  CHOOSE_MAP: 'CHOOSE_MAP',
  SETTINGS: 'SETTINGS',
  PLAYING: 'PLAYING',
  GAME_OVER: 'GAME_OVER'
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;

    this.state = GAME_STATES.MENU;
    this.particles = new ParticleSystem();

    // Game Settings (loaded from localStorage)
    this.settings = {
      buffs: localStorage.getItem('tag_buffs') !== 'false',
      time: parseInt(localStorage.getItem('tag_time') || '60', 10)
    };

    this.playerCount = 2; // 2, 3, or 4
    this.currentMapKey = 'forest';
    this.currentMap = MAPS.forest;

    this.players = [];
    this.roundTimer = this.settings.time;
    this.roundTimerMs = this.settings.time * 1000;
    this.countdown = 3;
    this.countdownTimer = 180; // 3 seconds at 60fps
    this.isMatchStarted = false;

    // Buff orbs in arena
    this.buffOrbs = [];
    this.buffSpawnTimer = 0;

    // Keys pressed dictionary
    this.keys = {};

    // Mouse & Touch coordinates relative to canvas
    this.mouse = { x: 0, y: 0, isDown: false };
    this.hoveredButton = null;

    // Animated menu props
    this.menuAnimTime = 0;
    this.menuNinjas = [
      { x: 190, y: 490, color: '#ffd000', vy: 0, state: 'fall', headband: '#ffd000' },
      { x: 260, y: 550, color: '#eb3b47', vy: 0, state: 'stand', headband: '#eb3b47' },
      { x: 670, y: 560, color: '#38bdf8', vy: -7, state: 'jump', headband: '#38bdf8' },
      { x: 910, y: 490, color: '#00c853', vy: 0, state: 'run', headband: '#00c853' }
    ];

    // Screen Shake effect
    this.screenShake = 0;

    // Winner info
    this.loserId = null;
    this.winners = [];

    this.initEventListeners();
  }

  initEventListeners() {
    window.addEventListener('keydown', e => {
      this.keys[e.key.toLowerCase()] = true;
      this.keys[e.key] = true;
      soundManager.init();
    });

    window.addEventListener('keyup', e => {
      this.keys[e.key.toLowerCase()] = false;
      this.keys[e.key] = false;
    });

    const updateMouse = e => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.width / rect.width;
      const scaleY = this.height / rect.height;
      this.mouse.x = (e.clientX - rect.left) * scaleX;
      this.mouse.y = (e.clientY - rect.top) * scaleY;
    };

    this.canvas.addEventListener('mousemove', e => {
      updateMouse(e);
      this.checkHover();
    });

    this.canvas.addEventListener('mousedown', e => {
      updateMouse(e);
      soundManager.init();
      this.handleClick();
    });

    // Touch event support for canvas buttons
    this.canvas.addEventListener('touchstart', e => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = (touch.clientX - rect.left) * (this.width / rect.width);
        this.mouse.y = (touch.clientY - rect.top) * (this.height / rect.height);
        soundManager.init();
        this.handleClick();
      }
    }, { passive: false });

    // Touch D-Pad buttons
    document.querySelectorAll('.touch-btn').forEach(btn => {
      const key = btn.dataset.key;
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.keys[key] = true;
      });
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.keys[key] = false;
      });
    });
  }

  saveSettings() {
    localStorage.setItem('tag_buffs', this.settings.buffs);
    localStorage.setItem('tag_time', this.settings.time);
  }

  startMatch(mapKey, playerCount) {
    this.currentMapKey = mapKey;
    this.currentMap = MAPS[mapKey] || MAPS.forest;
    this.playerCount = playerCount;

    this.roundTimer = this.settings.time;
    this.roundTimerMs = this.settings.time * 1000;
    this.countdown = 3;
    this.countdownTimer = 180;
    this.isMatchStarted = false;
    this.buffOrbs = [];
    this.buffSpawnTimer = 0;
    this.loserId = null;
    this.winners = [];

    // Define player slots & controls
    // P1: WASD, P2: Arrows, P3: I/J/L, P4: T/F/H
    const configs = [
      { id: 1, color: '#eb3b47', name: 'Player 1', controls: { left: 'a', right: 'd', jump: 'w', down: 's' } },
      { id: 2, color: '#38bdf8', name: 'Player 2', controls: { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', down: 'ArrowDown' } },
      { id: 3, color: '#ffd000', name: 'Player 3', controls: { left: 'j', right: 'l', jump: 'i', down: 'k' } },
      { id: 4, color: '#00c853', name: 'Player 4', controls: { left: 'f', right: 'h', jump: 't', down: 'g' } }
    ];

    this.players = [];
    for (let i = 0; i < playerCount; i++) {
      const cfg = configs[i];
      const spawn = this.currentMap.spawns[i] || { x: 200 + i * 200, y: 500 };
      // By default Player 1 is human, other slots are bots if playing solo, or can be toggled!
      const isBot = i > 0;
      const player = new Player(cfg.id, cfg.color, cfg.name, spawn.x, spawn.y, cfg.controls, isBot);
      this.players.push(player);
    }

    // Randomly pick one player to be IT
    const itIndex = Math.floor(Math.random() * playerCount);
    this.players[itIndex].tag();

    this.state = GAME_STATES.PLAYING;
    soundManager.playCountdown();
  }

  checkHover() {
    const mx = this.mouse.x;
    const my = this.mouse.y;
    this.hoveredButton = null;

    if (this.state === GAME_STATES.MENU) {
      // Audio toggle button top-right (x: 1180, y: 25, size: 60)
      if (mx >= 1180 && mx <= 1240 && my >= 25 && my <= 85) {
        this.hoveredButton = 'audio_btn';
      }
      // 2 Players button
      if (mx >= 460 && mx <= 820 && my >= 220 && my <= 280) {
        this.hoveredButton = '2_players';
      }
      // 3 Players button
      if (mx >= 460 && mx <= 820 && my >= 305 && my <= 365) {
        this.hoveredButton = '3_players';
      }
      // 4 Players button
      if (mx >= 460 && mx <= 820 && my >= 390 && my <= 450) {
        this.hoveredButton = '4_players';
      }
    } else if (this.state === GAME_STATES.CHOOSE_MAP) {
      // Map dioramas
      // Forest: x: 120, y: 200, w: 280, h: 260
      if (mx >= 120 && mx <= 400 && my >= 190 && my <= 470) {
        this.hoveredButton = 'map_forest';
      }
      // Winter: x: 500, y: 200, w: 280, h: 260
      if (mx >= 500 && mx <= 780 && my >= 190 && my <= 470) {
        this.hoveredButton = 'map_winter';
      }
      // Desert: x: 880, y: 200, w: 280, h: 260
      if (mx >= 880 && mx <= 1160 && my >= 190 && my <= 470) {
        this.hoveredButton = 'map_desert';
      }
      // Game Settings Button (x: 520, y: 560, w: 240, h: 56)
      if (mx >= 510 && mx <= 770 && my >= 560 && my <= 620) {
        this.hoveredButton = 'open_settings';
      }
      // Back button (x: 30, y: 620, size: 60)
      if (mx >= 30 && mx <= 90 && my >= 620 && my <= 680) {
        this.hoveredButton = 'back_to_menu';
      }
    } else if (this.state === GAME_STATES.SETTINGS) {
      // Buffs ON (x: 600, y: 220, w: 90, h: 50)
      if (mx >= 600 && mx <= 690 && my >= 220 && my <= 270) {
        this.hoveredButton = 'buffs_on';
      }
      // Buffs OFF (x: 720, y: 220, w: 90, h: 50)
      if (mx >= 720 && mx <= 810 && my >= 220 && my <= 270) {
        this.hoveredButton = 'buffs_off';
      }
      // Time 60 (x: 600, y: 300, w: 65, h: 45)
      if (mx >= 600 && mx <= 665 && my >= 300 && my <= 345) {
        this.hoveredButton = 'time_60';
      }
      // Time 120 (x: 680, y: 300, w: 65, h: 45)
      if (mx >= 680 && mx <= 745 && my >= 300 && my <= 345) {
        this.hoveredButton = 'time_120';
      }
      // Time 180 (x: 760, y: 300, w: 65, h: 45)
      if (mx >= 760 && mx <= 825 && my >= 300 && my <= 345) {
        this.hoveredButton = 'time_180';
      }
      // Close button (x: 520, y: 440, w: 240, h: 56)
      if (mx >= 520 && mx <= 760 && my >= 440 && my <= 500) {
        this.hoveredButton = 'close_settings';
      }
    } else if (this.state === GAME_STATES.PLAYING) {
      // Pause / Back button top left
      if (mx >= 20 && mx <= 70 && my >= 20 && my <= 70) {
        this.hoveredButton = 'ingame_menu';
      }
      // Audio toggle top right
      if (mx >= 1210 && mx <= 1260 && my >= 20 && my <= 70) {
        this.hoveredButton = 'audio_btn';
      }
    } else if (this.state === GAME_STATES.GAME_OVER) {
      // Play Again (x: 420, y: 520, w: 200, h: 55)
      if (mx >= 420 && mx <= 620 && my >= 520 && my <= 575) {
        this.hoveredButton = 'play_again';
      }
      // Change Map (x: 660, y: 520, w: 200, h: 55)
      if (mx >= 660 && mx <= 860 && my >= 520 && my <= 575) {
        this.hoveredButton = 'change_map';
      }
    }
  }

  handleClick() {
    this.checkHover();
    if (!this.hoveredButton) return;

    soundManager.playClick();

    if (this.hoveredButton === 'audio_btn') {
      soundManager.toggleMusic();
      return;
    }

    if (this.state === GAME_STATES.MENU) {
      if (this.hoveredButton === '2_players') {
        this.playerCount = 2;
        this.state = GAME_STATES.CHOOSE_MAP;
      } else if (this.hoveredButton === '3_players') {
        this.playerCount = 3;
        this.state = GAME_STATES.CHOOSE_MAP;
      } else if (this.hoveredButton === '4_players') {
        this.playerCount = 4;
        this.state = GAME_STATES.CHOOSE_MAP;
      }
    } else if (this.state === GAME_STATES.CHOOSE_MAP) {
      if (this.hoveredButton === 'map_forest') {
        this.startMatch('forest', this.playerCount);
      } else if (this.hoveredButton === 'map_winter') {
        this.startMatch('winter', this.playerCount);
      } else if (this.hoveredButton === 'map_desert') {
        this.startMatch('desert', this.playerCount);
      } else if (this.hoveredButton === 'open_settings') {
        this.state = GAME_STATES.SETTINGS;
      } else if (this.hoveredButton === 'back_to_menu') {
        this.state = GAME_STATES.MENU;
      }
    } else if (this.state === GAME_STATES.SETTINGS) {
      if (this.hoveredButton === 'buffs_on') {
        this.settings.buffs = true;
        this.saveSettings();
      } else if (this.hoveredButton === 'buffs_off') {
        this.settings.buffs = false;
        this.saveSettings();
      } else if (this.hoveredButton === 'time_60') {
        this.settings.time = 60;
        this.saveSettings();
      } else if (this.hoveredButton === 'time_120') {
        this.settings.time = 120;
        this.saveSettings();
      } else if (this.hoveredButton === 'time_180') {
        this.settings.time = 180;
        this.saveSettings();
      } else if (this.hoveredButton === 'close_settings') {
        this.state = GAME_STATES.CHOOSE_MAP;
      }
    } else if (this.state === GAME_STATES.PLAYING) {
      if (this.hoveredButton === 'ingame_menu') {
        this.state = GAME_STATES.CHOOSE_MAP;
      }
      // Check clicking player bot toggle on HUD
      const hudY = 30;
      for (let i = 0; i < this.players.length; i++) {
        const hudX = 140 + i * 110;
        if (this.mouse.x >= hudX && this.mouse.x <= hudX + 90 && this.mouse.y >= hudY && this.mouse.y <= hudY + 36) {
          this.players[i].isBot = !this.players[i].isBot;
          soundManager.playClick();
          break;
        }
      }
    } else if (this.state === GAME_STATES.GAME_OVER) {
      if (this.hoveredButton === 'play_again') {
        this.startMatch(this.currentMapKey, this.playerCount);
      } else if (this.hoveredButton === 'change_map') {
        this.state = GAME_STATES.CHOOSE_MAP;
      }
    }
  }

  update() {
    this.particles.update();
    this.menuAnimTime += 0.05;

    if (this.screenShake > 0) {
      this.screenShake *= 0.9;
      if (this.screenShake < 0.2) this.screenShake = 0;
    }

    if (this.state === GAME_STATES.PLAYING) {
      this.updatePlayingMatch();
    }
  }

  updatePlayingMatch() {
    // 1. Handle match pre-countdown
    if (!this.isMatchStarted) {
      this.countdownTimer--;
      if (this.countdownTimer % 60 === 0 && this.countdownTimer > 0) {
        this.countdown = Math.ceil(this.countdownTimer / 60);
        soundManager.playCountdown();
      }
      if (this.countdownTimer <= 0) {
        this.isMatchStarted = true;
        soundManager.playWhistle();
        soundManager.startBGM();
      }
      return;
    }

    // 2. Decrement Round Timer
    this.roundTimerMs -= 1000 / 60;
    this.roundTimer = Math.max(0, Math.ceil(this.roundTimerMs / 1000));

    // Play suspenseful countdown beeps when <= 5 seconds left
    if (this.roundTimer <= 5 && this.roundTimerMs % 1000 < 20) {
      soundManager.playCountdown();
    }

    if (this.roundTimerMs <= 0) {
      this.endMatch();
      return;
    }

    // 3. Update Players
    for (const player of this.players) {
      player.update(this.keys, this.currentMap, this.players, this.particles);
    }

    // 4. Tag Collision Check
    const itPlayer = this.players.find(p => p.isIt);
    if (itPlayer && !itPlayer.isImmune) {
      for (const target of this.players) {
        if (target.id === itPlayer.id || target.isImmune) continue;

        // Collision check (circle or AABB)
        const dx = (target.x + target.width / 2) - (itPlayer.x + itPlayer.width / 2);
        const dy = (target.y + target.height / 2) - (itPlayer.y + itPlayer.height / 2);
        const dist = Math.hypot(dx, dy);

        if (dist < 38) {
          // TAG OCCURRED!
          itPlayer.passTag();
          target.tag();

          soundManager.playTag();
          this.screenShake = 12;

          const tagX = (itPlayer.x + target.x) / 2 + 22;
          const tagY = (itPlayer.y + target.y) / 2 + 22;
          this.particles.createTagBurst(tagX, tagY);
          break;
        }
      }
    }

    // 5. Buff Spawning Logic (if enabled)
    if (this.settings.buffs) {
      this.buffSpawnTimer++;
      if (this.buffSpawnTimer > 400 && this.buffOrbs.length < 3) {
        this.spawnBuffOrb();
        this.buffSpawnTimer = 0;
      }

      // Check player collecting buff orb
      for (let i = this.buffOrbs.length - 1; i >= 0; i--) {
        const orb = this.buffOrbs[i];
        orb.bob += 0.08;

        for (const p of this.players) {
          const dx = (p.x + p.width / 2) - orb.x;
          const dy = (p.y + p.height / 2) - (orb.y + Math.sin(orb.bob) * 6);
          if (Math.hypot(dx, dy) < 32) {
            // Collected!
            soundManager.playBuff();
            this.particles.createTagBurst(orb.x, orb.y);
            p.buff = orb.type;
            p.buffTimer = 360; // 6 seconds
            this.buffOrbs.splice(i, 1);
            break;
          }
        }
      }
    }
  }

  spawnBuffOrb() {
    const types = ['speed', 'jump', 'freeze'];
    const type = types[Math.floor(Math.random() * types.length)];
    const platforms = this.currentMap.platforms;
    const plat = platforms[Math.floor(Math.random() * platforms.length)];

    this.buffOrbs.push({
      x: plat.x + Math.random() * (plat.width - 40) + 20,
      y: plat.y - 30,
      type: type,
      bob: Math.random() * Math.PI * 2
    });
  }

  endMatch() {
    this.state = GAME_STATES.GAME_OVER;
    soundManager.playWin();

    const itPlayer = this.players.find(p => p.isIt);
    this.loserId = itPlayer ? itPlayer.id : null;
    this.winners = this.players.filter(p => !p.isIt);

    // Confetti celebration
    this.particles.createConfetti(this.width / 2, 220, 100);
    this.particles.createConfetti(this.width / 4, 300, 60);
    this.particles.createConfetti((3 * this.width) / 4, 300, 60);
  }

  render() {
    const ctx = this.ctx;
    ctx.save();

    // Apply Screen Shake
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
    }

    if (this.state === GAME_STATES.MENU) {
      this.renderMenu();
    } else if (this.state === GAME_STATES.CHOOSE_MAP) {
      this.renderChooseMap();
    } else if (this.state === GAME_STATES.SETTINGS) {
      this.renderChooseMap();
      this.renderSettingsModal();
    } else if (this.state === GAME_STATES.PLAYING) {
      this.renderPlaying();
    } else if (this.state === GAME_STATES.GAME_OVER) {
      this.renderPlaying();
      this.renderGameOverModal();
    }

    ctx.restore();
  }

  // Exact reproduction of Screenshot 1 (Main Menu)
  renderMenu() {
    const ctx = this.ctx;

    // 1. Sky Background
    ctx.fillStyle = '#3ea5e6';
    ctx.fillRect(0, 0, this.width, this.height);

    // Architectural column silhouettes
    ctx.fillStyle = '#62b6eb';
    ctx.globalAlpha = 0.55;
    for (let x = 60; x < this.width; x += 180) {
      ctx.fillRect(x, 140, 60, 520);
      ctx.fillRect(x - 12, 120, 84, 20);
      ctx.fillRect(x - 20, 105, 100, 15);
    }
    ctx.globalAlpha = 1.0;

    // 2. Pink Ground & Scalloped Green Grass
    const groundY = this.height - 65;
    ctx.fillStyle = '#f72585';
    ctx.fillRect(0, groundY, this.width, 65);

    ctx.fillStyle = '#00e676';
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    for (let x = 0; x <= this.width; x += 36) {
      ctx.quadraticCurveTo(x + 18, groundY + 10, x + 36, groundY);
    }
    ctx.lineTo(this.width, groundY);
    ctx.lineTo(0, groundY);
    ctx.fill();

    // 3. Environment Scenery
    // Left Tree
    ctx.fillStyle = '#9b1d60';
    ctx.fillRect(100, groundY - 140, 30, 140);
    ctx.fillStyle = '#00e676';
    ctx.beginPath();
    ctx.roundRect(50, groundY - 230, 130, 110, 26);
    ctx.fill();

    // Orange Bounce Box on left
    ctx.fillStyle = '#ff9100';
    ctx.beginPath();
    ctx.roundRect(320, groundY - 60, 56, 60, 8);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(330, groundY - 20);
    ctx.lineTo(348, groundY - 45);
    ctx.lineTo(366, groundY - 20);
    ctx.stroke();

    // Flowers
    this.drawSimpleFlower(200, groundY - 6, '#ffd000');
    this.drawSimpleFlower(420, groundY - 6, '#eb3b5a');
    this.drawSimpleFlower(900, groundY - 6, '#ffd000');
    this.drawSimpleFlower(1200, groundY - 6, '#eb3b5a');

    // Glowing Pink Portal Dome on right
    ctx.save();
    ctx.fillStyle = '#e040fb';
    ctx.shadowColor = '#e040fb';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(1110, groundY, 36, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(1110, groundY, 22, Math.PI, 0);
    ctx.fill();
    ctx.restore();

    // Floating speed trail on right
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(840, groundY - 20, 14, 0, Math.PI * 2);
    ctx.arc(980, groundY - 110, 18, 0, Math.PI * 2);
    ctx.fill();

    // 4. Center Purple Pillar (rounded container)
    const pillarX = 430;
    const pillarY = 180;
    const pillarW = 420;
    const pillarH = 480;

    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.roundRect(pillarX, pillarY, pillarW, pillarH, [36, 36, 0, 0]);
    ctx.fill();

    // 5. Three Big Menu Buttons:
    // 2 PLAYERS (Red)
    const isHover2 = this.hoveredButton === '2_players';
    this.drawMenuButton(470, 230, 340, 72, '#e83a48', '2 PLAYERS', '#ffffff', isHover2);

    // 3 PLAYERS (Yellow)
    const isHover3 = this.hoveredButton === '3_players';
    this.drawMenuButton(470, 325, 340, 72, '#ffd000', '3 PLAYERS', '#6a0dad', isHover3);

    // 4 PLAYERS (Green)
    const isHover4 = this.hoveredButton === '4_players';
    this.drawMenuButton(470, 420, 340, 72, '#00c853', '4 PLAYERS', '#ffffff', isHover4);

    // 6. Huge 3D Cartoon Title: "TAG"
    this.drawTitleTAG(640, 125);

    // 7. Top-Right Music Toggle Button
    const isHoverAudio = this.hoveredButton === 'audio_btn';
    this.drawAudioButton(1190, 25, 62, soundManager.musicEnabled, isHoverAudio);

    // 8. Animated Little Ninja Characters around the menu (Exact layout from Screenshot 1!)
    this.renderMenuNinjas(groundY);

    this.particles.draw(ctx);
  }

  drawTitleTAG(x, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 130px "Lilita One", "Fredoka", cursive';

    // 3D Extruded Drop Shadow (Dark Navy / Black)
    ctx.fillStyle = '#151928';
    for (let off = 12; off >= 1; off--) {
      ctx.fillText('TAG', x, y + off);
    }

    // Thick Black Outline
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#151928';
    ctx.lineJoin = 'round';
    ctx.strokeText('TAG', x, y);

    // Crisp White Fill
    ctx.fillStyle = '#ffffff';
    ctx.fillText('TAG', x, y);

    ctx.restore();
  }

  drawMenuButton(x, y, w, h, bgColor, text, textColor, isHovered) {
    const ctx = this.ctx;
    ctx.save();
    const offsetY = isHovered ? -3 : 0;
    ctx.translate(x, y + offsetY);

    if (isHovered) {
      ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
      ctx.shadowBlur = 14;
    }

    // Button Background
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 12);
    ctx.fill();

    // Text
    ctx.font = '900 34px "Lilita One", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Soft text shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillText(text, w / 2, h / 2 + 3);

    ctx.fillStyle = textColor;
    ctx.fillText(text, w / 2, h / 2);

    ctx.restore();
  }

  drawAudioButton(x, y, size, isEnabled, isHovered) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);

    // Blue rounded box
    ctx.fillStyle = isHovered ? '#60a5fa' : '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, 14);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Musical eighth note icon
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    // Note head
    ctx.ellipse(size / 2 - 4, size / 2 + 10, 6, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Stem
    ctx.fillRect(size / 2 + 1, size / 2 - 12, 4, 22);
    // Flag
    ctx.beginPath();
    ctx.arc(size / 2 + 12, size / 2 - 4, 8, Math.PI, 0.4);
    ctx.lineTo(size / 2 + 5, size / 2 - 4);
    ctx.fill();

    // If muted, draw diagonal red slash
    if (!isEnabled) {
      ctx.strokeStyle = '#eb3b47';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(10, 10);
      ctx.lineTo(size - 10, size - 10);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawSimpleFlower(x, y, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  renderMenuNinjas(groundY) {
    const ctx = this.ctx;
    const t = this.menuAnimTime;

    // 1. Yellow Ninja (P3) falling from sky with speed streaks (Screenshot 1 top left)
    const yBob = Math.sin(t * 1.5) * 8;
    this.drawMiniNinja(ctx, 230, groundY - 140 + yBob, '#ffd000', 1, -0.2);
    // Speed lines above yellow ninja
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(224, groundY - 200 + yBob);
    ctx.lineTo(224, groundY - 170 + yBob);
    ctx.moveTo(242, groundY - 200 + yBob);
    ctx.lineTo(242, groundY - 170 + yBob);
    ctx.stroke();

    // 2. Red Ninja (P1) on top of the orange bounce box
    this.drawMiniNinja(ctx, 350, groundY - 95, '#eb3b47', 1, 0);

    // 3. Blue Ninja (P2) jumping near the pillar
    const blueJump = Math.abs(Math.sin(t * 2)) * 60;
    this.drawMiniNinja(ctx, 890, groundY - 35 - blueJump, '#38bdf8', -1, 0.1);
    // Dust arc under jump
    if (blueJump < 10) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(890, groundY - 6, 12, Math.PI, 0);
      ctx.stroke();
    }

    // 4. Green Ninja (P4) running on the right side
    const greenBob = Math.sin(t * 3) * 6;
    this.drawMiniNinja(ctx, 1140, groundY - 130 + greenBob, '#00c853', -1, -0.25);
  }

  drawMiniNinja(ctx, x, y, headbandColor, facing = 1, tilt = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(facing, 1);

    const w = 42;
    const h = 42;

    // Body: Black rounded box with horns
    ctx.fillStyle = '#161922';
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 8);
    ctx.fill();

    // Ninja ears/horns
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2 + 8);
    ctx.lineTo(-w / 2 - 2, -h / 2 - 5);
    ctx.lineTo(-w / 2 + 10, -h / 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(w / 2 - 10, -h / 2);
    ctx.lineTo(w / 2 + 2, -h / 2 - 5);
    ctx.lineTo(w / 2, -h / 2 + 8);
    ctx.fill();

    // Headband
    ctx.fillStyle = headbandColor;
    ctx.fillRect(-w / 2 + 3, -10, w - 6, 8);
    // Ribbon tails
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 4, -8);
    ctx.quadraticCurveTo(-w / 2 - 16, -10, -w / 2 - 22, -4);
    ctx.lineTo(-w / 2 - 18, 2);
    ctx.quadraticCurveTo(-w / 2 - 10, -2, -w / 2 + 4, -3);
    ctx.fill();

    // Face: Large white oval eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(2, 0, 6, 8, 0, 0, Math.PI * 2);
    ctx.ellipse(14, 0, 6, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = '#161922';
    ctx.beginPath();
    ctx.ellipse(3, 0, 3, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(15, 0, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(8, 9, 3.5, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    ctx.restore();
  }

  // Exact reproduction of Screenshot 2 (Choose Map)
  renderChooseMap() {
    const ctx = this.ctx;

    // Ocean blue background
    ctx.fillStyle = '#3a8bc8';
    ctx.fillRect(0, 0, this.width, this.height);

    // Title: "CHOOSE MAP"
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 84px "Lilita One", cursive';

    // Shadow
    ctx.fillStyle = '#1f5380';
    ctx.fillText('CHOOSE MAP', this.width / 2, 105);

    // White text
    ctx.fillStyle = '#ffffff';
    ctx.fillText('CHOOSE MAP', this.width / 2, 100);
    ctx.restore();

    // 3 Diorama Cards:
    // 1. Forest Map Diorama
    const isHoverForest = this.hoveredButton === 'map_forest';
    drawDiorama(ctx, 'forest', 130, 200, 310, 250, isHoverForest);

    // 2. Winter Map Diorama
    const isHoverWinter = this.hoveredButton === 'map_winter';
    drawDiorama(ctx, 'winter', 485, 200, 310, 250, isHoverWinter);

    // 3. Desert Map Diorama
    const isHoverDesert = this.hoveredButton === 'map_desert';
    drawDiorama(ctx, 'desert', 840, 200, 310, 250, isHoverDesert);

    // Bottom Center: "GAME SETTINGS" Button
    const isHoverSettings = this.hoveredButton === 'open_settings';
    ctx.save();
    ctx.translate(510, 560);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.fillStyle = isHoverSettings ? 'rgba(255, 255, 255, 0.2)' : 'transparent';
    ctx.beginPath();
    ctx.roundRect(0, 0, 260, 56, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 28px "Lilita One", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME SETTINGS', 130, 28);
    ctx.restore();

    // Bottom Left: Back Button
    const isHoverBack = this.hoveredButton === 'back_to_menu';
    ctx.save();
    ctx.translate(36, 620);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.fillStyle = isHoverBack ? 'rgba(255, 255, 255, 0.25)' : 'transparent';
    ctx.beginPath();
    ctx.roundRect(0, 0, 64, 64, 8);
    ctx.fill();
    ctx.stroke();

    // Left arrow
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(42, 22);
    ctx.lineTo(24, 32);
    ctx.lineTo(42, 42);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Exact reproduction of Screenshot 3 (Settings Modal)
  renderSettingsModal() {
    const ctx = this.ctx;

    // Dark semi-transparent dim overlay
    ctx.fillStyle = 'rgba(11, 26, 45, 0.82)';
    ctx.fillRect(0, 0, this.width, this.height);

    // Ghost title behind modal
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 84px "Lilita One", cursive';
    ctx.fillStyle = 'rgba(30, 60, 85, 0.6)';
    ctx.fillText('SETTINGS', this.width / 2, 130);
    ctx.restore();

    // Pink Rounded Box with thick 6px white border
    const modalW = 520;
    const modalH = 390;
    const modalX = (this.width - modalW) / 2;
    const modalY = (this.height - modalH) / 2 + 20;

    ctx.save();
    ctx.translate(modalX, modalY);

    // Pink Body
    ctx.fillStyle = '#f78da7';
    ctx.beginPath();
    ctx.roundRect(0, 0, modalW, modalH, 32);
    ctx.fill();

    // Thick White Border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.stroke();

    // Option 1: BUFFS [ ON ] [ OFF ]
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 44px "Lilita One", cursive';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('BUFFS', 40, 80);

    // BUFFS ON Button
    const buffsOn = this.settings.buffs;
    this.drawSettingPill(ctx, 230, 52, 90, 56, 'ON', buffsOn, this.hoveredButton === 'buffs_on');
    // BUFFS OFF Button
    this.drawSettingPill(ctx, 350, 52, 90, 56, 'OFF', !buffsOn, this.hoveredButton === 'buffs_off');

    // Option 2: TIME [ 60 ] [ 120 ] [ 180 ]
    ctx.fillText('TIME', 40, 175);
    const timeVal = this.settings.time;
    this.drawSettingPill(ctx, 230, 147, 75, 56, '60', timeVal === 60, this.hoveredButton === 'time_60');
    this.drawSettingPill(ctx, 320, 147, 85, 56, '120', timeVal === 120, this.hoveredButton === 'time_120');
    this.drawSettingPill(ctx, 420, 147, 85, 56, '180', timeVal === 180, this.hoveredButton === 'time_180');

    // Caption: "THE SETTINGS ARE SAVED AUTOMATICALLY"
    ctx.font = '800 16px "Lilita One", cursive';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('THE SETTINGS ARE SAVED AUTOMATICALLY', modalW / 2, 255);

    // CLOSE Button in White Outlined Box
    const isHoverClose = this.hoveredButton === 'close_settings';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.fillStyle = isHoverClose ? 'rgba(255, 255, 255, 0.25)' : 'transparent';
    ctx.beginPath();
    ctx.roundRect(140, 290, 240, 60, 6);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 32px "Lilita One", cursive';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('CLOSE', modalW / 2, 320);

    ctx.restore();
  }

  drawSettingPill(ctx, x, y, w, h, text, isActive, isHovered) {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.fillStyle = isActive ? 'rgba(255, 255, 255, 0.35)' : (isHovered ? 'rgba(255, 255, 255, 0.15)' : 'transparent');
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 30px "Lilita One", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
    ctx.restore();
  }

  // In-Game match rendering
  renderPlaying() {
    const ctx = this.ctx;

    // 1. Draw Map & Platforms & Decor
    drawMap(ctx, this.currentMap);

    // 2. Draw Floating Buff Orbs
    for (const orb of this.buffOrbs) {
      this.drawBuffOrb(ctx, orb);
    }

    // 3. Draw Players
    for (const player of this.players) {
      player.draw(ctx);
    }

    // 4. Draw Particles
    this.particles.draw(ctx);

    // 5. Draw HUD (Top bar: Timer, Player slots, Menu icon)
    this.renderHUD(ctx);

    // 6. Draw Countdown banner if not started
    if (!this.isMatchStarted) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.font = '900 120px "Lilita One", cursive';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd000';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 12;
      ctx.strokeText(`${this.countdown}`, this.width / 2, this.height / 2 - 20);
      ctx.fillText(`${this.countdown}`, this.width / 2, this.height / 2 - 20);

      ctx.font = '900 36px "Lilita One", cursive';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('GET READY TO RUN!', this.width / 2, this.height / 2 + 70);
      ctx.restore();
    }
  }

  drawBuffOrb(ctx, orb) {
    ctx.save();
    const y = orb.y + Math.sin(orb.bob) * 6;
    ctx.translate(orb.x, y);

    // Glow
    ctx.shadowColor = orb.type === 'speed' ? '#00e5ff' : (orb.type === 'jump' ? '#ffd000' : '#80d8ff');
    ctx.shadowBlur = 14;

    // Circle
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    // Icon
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icon = orb.type === 'speed' ? '⚡' : (orb.type === 'jump' ? '🦘' : '❄️');
    ctx.fillText(icon, 0, 2);

    ctx.restore();
  }

  renderHUD(ctx) {
    ctx.save();

    // Top-Center Timer Pill
    const min = Math.floor(this.roundTimer / 60);
    const sec = this.roundTimer % 60;
    const timeStr = `${min}:${sec < 10 ? '0' : ''}${sec}`;

    const isUrgent = this.roundTimer <= 10;
    ctx.fillStyle = isUrgent ? '#ff1744' : 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.roundRect(this.width / 2 - 70, 16, 140, 48, 24);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 32px "Lilita One", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, this.width / 2, 40);

    // Top-Left Menu button
    const isHoverMenu = this.hoveredButton === 'ingame_menu';
    ctx.fillStyle = isHoverMenu ? '#60a5fa' : 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.roundRect(20, 18, 50, 44, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px "Lilita One", cursive';
    ctx.fillText('◀', 45, 40);

    // Player Status Pills (Click to toggle Human/Bot)
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      const x = 90 + i * 115;
      const y = 20;

      ctx.fillStyle = p.isIt ? '#ff1744' : p.color;
      ctx.beginPath();
      ctx.roundRect(x, y, 105, 40, 10);
      ctx.fill();

      // Border if IT
      if (p.isIt) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 15px "Lilita One", cursive';
      ctx.textAlign = 'center';
      const label = p.isIt ? 'IT!' : (p.isBot ? 'BOT' : 'YOU');
      ctx.fillText(`P${p.id} ${label}`, x + 52, y + 21);
    }

    // Audio Button top right
    this.drawAudioButton(1210, 16, 48, soundManager.musicEnabled, this.hoveredButton === 'audio_btn');

    ctx.restore();
  }

  // Game Over Modal with Winner Podium
  renderGameOverModal() {
    const ctx = this.ctx;

    // Dark backdrop
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.textAlign = 'center';

    // Banner: "TIME'S UP!"
    ctx.font = '900 78px "Lilita One", cursive';
    ctx.fillStyle = '#ffd000';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 10;
    ctx.strokeText("TIME'S UP!", this.width / 2, 170);
    ctx.fillText("TIME'S UP!", this.width / 2, 170);

    // Subtitle: Who got caught
    const loser = this.players.find(p => p.id === this.loserId);
    if (loser) {
      ctx.font = '900 32px "Lilita One", cursive';
      ctx.fillStyle = '#ff4d6d';
      ctx.fillText(`${loser.name} WAS CAUGHT!`, this.width / 2, 230);
    }

    // Surviving Winners
    ctx.font = '900 36px "Lilita One", cursive';
    ctx.fillStyle = '#00e676';
    const winnerNames = this.winners.map(w => w.name).join(', ');
    ctx.fillText(`🎉 WINNERS: ${winnerNames}! 🎉`, this.width / 2, 310);

    // Draw Winner Ninjas Celebrating
    for (let i = 0; i < this.winners.length; i++) {
      const w = this.winners[i];
      const spacing = 100;
      const startX = this.width / 2 - ((this.winners.length - 1) * spacing) / 2;
      const wx = startX + i * spacing;
      const bounce = Math.abs(Math.sin(Date.now() / 200 + i)) * 25;
      this.drawMiniNinja(ctx, wx, 420 - bounce, w.color, 1, 0);
    }

    // Action Buttons:
    // PLAY AGAIN
    const isHoverPlay = this.hoveredButton === 'play_again';
    this.drawMenuButton(420, 520, 200, 56, '#00c853', 'PLAY AGAIN', '#ffffff', isHoverPlay);

    // CHOOSE MAP
    const isHoverMap = this.hoveredButton === 'change_map';
    this.drawMenuButton(650, 520, 200, 56, '#38bdf8', 'CHOOSE MAP', '#ffffff', isHoverMap);

    ctx.restore();
  }
}
