// Central Game Engine for Tag Multiplayer - 100% Single-Keyboard Local Multiplayer

import { soundManager } from './audio.js';
import { ParticleSystem } from './particles.js';
import { Player } from './player.js';
import { MAPS, drawMap, drawDiorama } from './maps.js';

export const GAME_STATES = {
  MENU: 'MENU',
  CHOOSE_MAP: 'CHOOSE_MAP',
  SETTINGS: 'SETTINGS',
  CONTROLS_MODAL: 'CONTROLS_MODAL',
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
    this.previousState = GAME_STATES.MENU;
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

    // Robust multi-key tracking Set
    this.keys = new Set();

    // Mouse coordinates relative to canvas
    this.mouse = { x: 0, y: 0 };
    this.hoveredButton = null;

    // Animated menu props
    this.menuAnimTime = 0;

    // Screen Shake effect
    this.screenShake = 0;

    // Winner info
    this.loserId = null;
    this.winners = [];

    this.initEventListeners();
  }

  initEventListeners() {
    window.addEventListener('keydown', e => {
      this.keys.add(e.key);
      this.keys.add(e.code);
      this.keys.add(e.key.toLowerCase());
      soundManager.init();

      // Quick ESC key to close modal or return to menu
      if (e.key === 'Escape') {
        if (this.state === GAME_STATES.SETTINGS || this.state === GAME_STATES.CONTROLS_MODAL) {
          this.state = this.previousState;
        } else if (this.state === GAME_STATES.PLAYING) {
          this.state = GAME_STATES.CHOOSE_MAP;
        }
      }
    });

    window.addEventListener('keyup', e => {
      this.keys.delete(e.key);
      this.keys.delete(e.code);
      this.keys.delete(e.key.toLowerCase());
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

    // Touch event support
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
  }

  saveSettings() {
    localStorage.setItem('tag_buffs', this.settings.buffs);
    localStorage.setItem('tag_time', this.settings.time);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
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

    // Distinct 4-Player single-keyboard setup
    const configs = [
      {
        id: 1,
        color: '#eb3b47',
        name: 'Player 1',
        label: 'W-A-S-D',
        controls: {
          leftKeys: ['a', 'A', 'KeyA'],
          rightKeys: ['d', 'D', 'KeyD'],
          jumpKeys: ['w', 'W', 'KeyW', ' '],
          downKeys: ['s', 'S', 'KeyS']
        }
      },
      {
        id: 2,
        color: '#38bdf8',
        name: 'Player 2',
        label: 'ARROWS',
        controls: {
          leftKeys: ['arrowleft', 'ArrowLeft'],
          rightKeys: ['arrowright', 'ArrowRight'],
          jumpKeys: ['arrowup', 'ArrowUp'],
          downKeys: ['arrowdown', 'ArrowDown']
        }
      },
      {
        id: 3,
        color: '#ffd000',
        name: 'Player 3',
        label: 'I-J-K-L',
        controls: {
          leftKeys: ['j', 'J', 'KeyJ'],
          rightKeys: ['l', 'L', 'KeyL'],
          jumpKeys: ['i', 'I', 'KeyI'],
          downKeys: ['k', 'K', 'KeyK']
        }
      },
      {
        id: 4,
        color: '#00c853',
        name: 'Player 4',
        label: 'T-F-G-H',
        controls: {
          leftKeys: ['f', 'F', 'KeyF'],
          rightKeys: ['h', 'H', 'KeyH'],
          jumpKeys: ['t', 'T', 'KeyT'],
          downKeys: ['g', 'G', 'KeyG']
        }
      }
    ];

    this.players = [];
    for (let i = 0; i < playerCount; i++) {
      const cfg = configs[i];
      const spawn = this.currentMap.spawns[i] || { x: 200 + i * 200, y: 500 };
      // 100% Real Human Player on Keyboard
      const player = new Player(cfg.id, cfg.color, cfg.name, cfg.label, spawn.x, spawn.y, cfg.controls);
      this.players.push(player);
    }

    // Pick one random player to be IT
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
      // Audio toggle button top-right (x: 1200, y: 24, size: 56)
      if (mx >= 1200 && mx <= 1256 && my >= 24 && my <= 80) {
        this.hoveredButton = 'audio_btn';
      }
      // Controls button top-right (x: 1130, y: 24, size: 56)
      if (mx >= 1130 && mx <= 1186 && my >= 24 && my <= 80) {
        this.hoveredButton = 'controls_btn';
      }
      // Fullscreen button top-right (x: 1060, y: 24, size: 56)
      if (mx >= 1060 && mx <= 1116 && my >= 24 && my <= 80) {
        this.hoveredButton = 'fullscreen_btn';
      }
      // 2 Players button
      if (mx >= 460 && mx <= 820 && my >= 225 && my <= 295) {
        this.hoveredButton = '2_players';
      }
      // 3 Players button
      if (mx >= 460 && mx <= 820 && my >= 320 && my <= 390) {
        this.hoveredButton = '3_players';
      }
      // 4 Players button
      if (mx >= 460 && mx <= 820 && my >= 415 && my <= 485) {
        this.hoveredButton = '4_players';
      }
    } else if (this.state === GAME_STATES.CHOOSE_MAP) {
      // Map dioramas
      if (mx >= 120 && mx <= 420 && my >= 185 && my <= 475) {
        this.hoveredButton = 'map_forest';
      }
      if (mx >= 480 && mx <= 800 && my >= 185 && my <= 475) {
        this.hoveredButton = 'map_winter';
      }
      if (mx >= 840 && mx <= 1160 && my >= 185 && my <= 475) {
        this.hoveredButton = 'map_desert';
      }
      // Game Settings Button (center)
      if (mx >= 400 && mx <= 630 && my >= 570 && my <= 626) {
        this.hoveredButton = 'open_settings';
      }
      // Keyboard Controls Button
      if (mx >= 650 && mx <= 880 && my >= 570 && my <= 626) {
        this.hoveredButton = 'controls_btn';
      }
      // Back button (x: 36, y: 620, size: 64)
      if (mx >= 36 && mx <= 100 && my >= 620 && my <= 684) {
        this.hoveredButton = 'back_to_menu';
      }
    } else if (this.state === GAME_STATES.SETTINGS) {
      // Buffs ON
      if (mx >= 600 && mx <= 690 && my >= 220 && my <= 276) {
        this.hoveredButton = 'buffs_on';
      }
      // Buffs OFF
      if (mx >= 710 && mx <= 800 && my >= 220 && my <= 276) {
        this.hoveredButton = 'buffs_off';
      }
      // Time 60, 120, 180
      if (mx >= 600 && mx <= 675 && my >= 310 && my <= 366) {
        this.hoveredButton = 'time_60';
      }
      if (mx >= 690 && mx <= 775 && my >= 310 && my <= 366) {
        this.hoveredButton = 'time_120';
      }
      if (mx >= 790 && mx <= 875 && my >= 310 && my <= 366) {
        this.hoveredButton = 'time_180';
      }
      // Close button
      if (mx >= 520 && mx <= 760 && my >= 450 && my <= 510) {
        this.hoveredButton = 'close_settings';
      }
    } else if (this.state === GAME_STATES.CONTROLS_MODAL) {
      // Close controls modal button
      if (mx >= 520 && mx <= 760 && my >= 520 && my <= 580) {
        this.hoveredButton = 'close_controls';
      }
    } else if (this.state === GAME_STATES.PLAYING) {
      // Menu button top left
      if (mx >= 20 && mx <= 130 && my >= 18 && my <= 64) {
        this.hoveredButton = 'ingame_menu';
      }
      // Controls helper button
      if (mx >= 145 && mx <= 255 && my >= 18 && my <= 64) {
        this.hoveredButton = 'ingame_controls';
      }
      // Audio toggle top right
      if (mx >= 1205 && mx <= 1260 && my >= 18 && my <= 68) {
        this.hoveredButton = 'audio_btn';
      }
    } else if (this.state === GAME_STATES.GAME_OVER) {
      // Play Again
      if (mx >= 420 && mx <= 620 && my >= 530 && my <= 588) {
        this.hoveredButton = 'play_again';
      }
      // Change Map
      if (mx >= 660 && mx <= 860 && my >= 530 && my <= 588) {
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

    if (this.hoveredButton === 'fullscreen_btn') {
      this.toggleFullscreen();
      return;
    }

    if (this.hoveredButton === 'controls_btn' || this.hoveredButton === 'ingame_controls') {
      this.previousState = this.state;
      this.state = GAME_STATES.CONTROLS_MODAL;
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
        this.previousState = this.state;
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
    } else if (this.state === GAME_STATES.CONTROLS_MODAL) {
      if (this.hoveredButton === 'close_controls') {
        this.state = this.previousState;
      }
    } else if (this.state === GAME_STATES.PLAYING) {
      if (this.hoveredButton === 'ingame_menu') {
        this.state = GAME_STATES.CHOOSE_MAP;
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
    this.menuAnimTime += 0.045;

    if (this.screenShake > 0) {
      this.screenShake *= 0.88;
      if (this.screenShake < 0.2) this.screenShake = 0;
    }

    if (this.state === GAME_STATES.PLAYING) {
      this.updatePlayingMatch();
    }
  }

  updatePlayingMatch() {
    // 1. Weather particles
    this.particles.spawnAmbient(this.currentMap.ambientType, this.width, this.height);

    // 2. Pre-match countdown
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

    // 3. Decrement Round Timer
    this.roundTimerMs -= 1000 / 60;
    this.roundTimer = Math.max(0, Math.ceil(this.roundTimerMs / 1000));

    // Suspense countdown when <= 5 seconds
    if (this.roundTimer <= 5 && this.roundTimerMs % 1000 < 20) {
      soundManager.playCountdown();
    }

    if (this.roundTimerMs <= 0) {
      this.endMatch();
      return;
    }

    // 4. Update 100% Human Players
    for (const player of this.players) {
      player.update(this.keys, this.currentMap, this.players, this.particles);
    }

    // 5. Tag Collision Check
    const itPlayer = this.players.find(p => p.isIt);
    if (itPlayer && !itPlayer.isImmune) {
      for (const target of this.players) {
        if (target.id === itPlayer.id || target.isImmune) continue;

        const dx = (target.x + target.width / 2) - (itPlayer.x + itPlayer.width / 2);
        const dy = (target.y + target.height / 2) - (itPlayer.y + itPlayer.height / 2);
        const dist = Math.hypot(dx, dy);

        if (dist < 40) {
          // TAG OCCURRED!
          itPlayer.passTag();
          target.tag();

          soundManager.playTag();
          this.screenShake = 14;

          const tagX = (itPlayer.x + target.x) / 2 + 23;
          const tagY = (itPlayer.y + target.y) / 2 + 23;
          this.particles.createTagBurst(tagX, tagY);
          break;
        }
      }
    }

    // 6. Buff Spawning Logic (if enabled)
    if (this.settings.buffs) {
      this.buffSpawnTimer++;
      if (this.buffSpawnTimer > 380 && this.buffOrbs.length < 3) {
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
    this.particles.createConfetti(this.width / 2, 220, 110);
    this.particles.createConfetti(this.width / 4, 300, 70);
    this.particles.createConfetti((3 * this.width) / 4, 300, 70);
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
    } else if (this.state === GAME_STATES.CONTROLS_MODAL) {
      if (this.previousState === GAME_STATES.PLAYING) {
        this.renderPlaying();
      } else {
        this.renderChooseMap();
      }
      this.renderControlsModal();
    } else if (this.state === GAME_STATES.PLAYING) {
      this.renderPlaying();
    } else if (this.state === GAME_STATES.GAME_OVER) {
      this.renderPlaying();
      this.renderGameOverModal();
    }

    ctx.restore();
  }

  // Exact reproduction of Screenshot 1 (Main Menu) with UI improvements
  renderMenu() {
    const ctx = this.ctx;

    // 1. Sky Background
    ctx.fillStyle = '#3ea5e6';
    ctx.fillRect(0, 0, this.width, this.height);

    // Architectural column silhouettes
    ctx.fillStyle = '#62b6eb';
    ctx.globalAlpha = 0.55;
    for (let x = 60; x < this.width; x += 180) {
      ctx.fillRect(x, 140, 64, 520);
      ctx.fillRect(x - 12, 120, 88, 20);
      ctx.fillRect(x - 20, 105, 104, 15);
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
      ctx.quadraticCurveTo(x + 18, groundY + 11, x + 36, groundY);
    }
    ctx.lineTo(this.width, groundY);
    ctx.lineTo(0, groundY);
    ctx.fill();

    // 3. Environment Scenery
    // Left Tree
    ctx.fillStyle = '#9b1d60';
    ctx.fillRect(100, groundY - 140, 32, 140);
    ctx.fillStyle = '#00e676';
    ctx.beginPath();
    ctx.roundRect(46, groundY - 235, 138, 115, 28);
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
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(1110, groundY, 38, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(1110, groundY, 22, Math.PI, 0);
    ctx.fill();
    ctx.restore();

    // 4. Center Purple Pillar
    const pillarX = 430;
    const pillarY = 175;
    const pillarW = 420;
    const pillarH = 485;

    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.roundRect(pillarX, pillarY, pillarW, pillarH, [40, 40, 0, 0]);
    ctx.fill();

    // 5. Three Big Menu Buttons:
    // 2 PLAYERS (Red)
    const isHover2 = this.hoveredButton === '2_players';
    this.drawMenuButton(460, 225, 360, 74, '#e83a48', '2 PLAYERS', '#ffffff', isHover2, 'WASD vs ARROWS');

    // 3 PLAYERS (Yellow)
    const isHover3 = this.hoveredButton === '3_players';
    this.drawMenuButton(460, 320, 360, 74, '#ffd000', '3 PLAYERS', '#6a0dad', isHover3, '+ IJKL');

    // 4 PLAYERS (Green)
    const isHover4 = this.hoveredButton === '4_players';
    this.drawMenuButton(460, 415, 360, 74, '#00c853', '4 PLAYERS', '#ffffff', isHover4, '+ TFGH');

    // Single Keyboard Badge at bottom of pillar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.roundRect(470, 505, 340, 40, 12);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 16px "Lilita One", cursive';
    ctx.textAlign = 'center';
    ctx.fillText('⌨ 1 KEYBOARD MULTIPLAYER', 640, 530);

    // 6. Huge 3D Cartoon Title: "TAG"
    const floatY = Math.sin(this.menuAnimTime * 1.5) * 6;
    this.drawTitleTAG(640, 118 + floatY);

    // 7. Top-Right Action Buttons
    this.drawTopButtons();

    // 8. Animated Little Ninja Characters around the menu
    this.renderMenuNinjas(groundY);

    this.particles.draw(ctx);
  }

  drawTopButtons() {
    const ctx = this.ctx;

    // 1. Audio toggle (x: 1200, y: 24)
    this.drawIconButton(1200, 24, 56, '#38bdf8', '🎵', soundManager.musicEnabled, this.hoveredButton === 'audio_btn');

    // 2. Controls toggle (x: 1130, y: 24)
    this.drawIconButton(1130, 24, 56, '#9381ff', '⌨', true, this.hoveredButton === 'controls_btn');

    // 3. Fullscreen toggle (x: 1060, y: 24)
    this.drawIconButton(1060, 24, 56, '#06d6a0', '⛶', true, this.hoveredButton === 'fullscreen_btn');
  }

  drawIconButton(x, y, size, bgColor, icon, isEnabled = true, isHovered = false) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y + (isHovered ? -2 : 0));

    if (isHovered) {
      ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
      ctx.shadowBlur = 14;
    }

    ctx.fillStyle = isHovered ? '#ffffff' : bgColor;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, 14);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.font = '26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isHovered ? bgColor : '#ffffff';
    ctx.fillText(icon, size / 2, size / 2 + 1);

    if (!isEnabled) {
      ctx.strokeStyle = '#eb3b47';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(8, 8);
      ctx.lineTo(size - 8, size - 8);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawTitleTAG(x, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 134px "Lilita One", "Fredoka", cursive';

    // 3D Extruded Drop Shadow
    ctx.fillStyle = '#151928';
    for (let off = 14; off >= 1; off--) {
      ctx.fillText('TAG', x, y + off);
    }

    // Thick Black Outline
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#151928';
    ctx.lineJoin = 'round';
    ctx.strokeText('TAG', x, y);

    // Crisp White Fill
    ctx.fillStyle = '#ffffff';
    ctx.fillText('TAG', x, y);

    ctx.restore();
  }

  drawMenuButton(x, y, w, h, bgColor, text, textColor, isHovered, subtext = '') {
    const ctx = this.ctx;
    ctx.save();
    const offsetY = isHovered ? -4 : 0;
    ctx.translate(x, y + offsetY);

    if (isHovered) {
      ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
      ctx.shadowBlur = 18;
    }

    // Button Background
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 14);
    ctx.fill();

    // Subtle 3D bottom bevel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.beginPath();
    ctx.roundRect(0, h - 8, w, 8, [0, 0, 14, 14]);
    ctx.fill();

    // Text
    ctx.font = '900 34px "Lilita One", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Soft text shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillText(text, w / 2, h / 2 - (subtext ? 6 : 0) + 3);

    ctx.fillStyle = textColor;
    ctx.fillText(text, w / 2, h / 2 - (subtext ? 6 : 0));

    // Optional Key Hint Subtext
    if (subtext) {
      ctx.font = '900 13px "Lilita One", cursive';
      ctx.fillStyle = textColor;
      ctx.globalAlpha = 0.85;
      ctx.fillText(subtext, w / 2, h / 2 + 18);
      ctx.globalAlpha = 1.0;
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

    // 1. Yellow Ninja (P3) falling from sky with speed streaks
    const yBob = Math.sin(t * 1.5) * 8;
    this.drawMiniNinja(ctx, 230, groundY - 140 + yBob, '#ffd000', 1, -0.2);
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

    const w = 44;
    const h = 44;

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
    ctx.fillRect(-w / 2 + 3, -10, w - 6, 9);
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 4, -8);
    ctx.quadraticCurveTo(-w / 2 - 16, -10, -w / 2 - 22, -4);
    ctx.lineTo(-w / 2 - 18, 2);
    ctx.quadraticCurveTo(-w / 2 - 10, -2, -w / 2 + 4, -3);
    ctx.fill();

    // Face: Large white oval eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(2, 0, 6.5, 8.5, 0, 0, Math.PI * 2);
    ctx.ellipse(15, 0, 6.5, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = '#161922';
    ctx.beginPath();
    ctx.ellipse(3, 0, 3.2, 4.2, 0, 0, Math.PI * 2);
    ctx.ellipse(16, 0, 3.2, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(8.5, 9, 3.5, 0.1 * Math.PI, 0.9 * Math.PI);
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
    ctx.font = '900 86px "Lilita One", cursive';

    // Shadow
    ctx.fillStyle = '#1f5380';
    ctx.fillText('CHOOSE MAP', this.width / 2, 105);

    // White text
    ctx.fillStyle = '#ffffff';
    ctx.fillText('CHOOSE MAP', this.width / 2, 100);
    ctx.restore();

    // 3 Diorama Cards
    const isHoverForest = this.hoveredButton === 'map_forest';
    drawDiorama(ctx, 'forest', 125, 195, 310, 260, isHoverForest);

    const isHoverWinter = this.hoveredButton === 'map_winter';
    drawDiorama(ctx, 'winter', 485, 195, 310, 260, isHoverWinter);

    const isHoverDesert = this.hoveredButton === 'map_desert';
    drawDiorama(ctx, 'desert', 845, 195, 310, 260, isHoverDesert);

    // Bottom Center 1: "GAME SETTINGS" Button
    const isHoverSettings = this.hoveredButton === 'open_settings';
    this.drawOutlinedButton(400, 570, 230, 56, 'GAME SETTINGS', isHoverSettings);

    // Bottom Center 2: "KEYBOARD CONTROLS" Button
    const isHoverControls = this.hoveredButton === 'controls_btn';
    this.drawOutlinedButton(650, 570, 230, 56, '⌨ CONTROLS', isHoverControls);

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

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(42, 22);
    ctx.lineTo(24, 32);
    ctx.lineTo(42, 42);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Top Right Buttons
    this.drawTopButtons();
  }

  drawOutlinedButton(x, y, w, h, text, isHovered) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y + (isHovered ? -3 : 0));
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.fillStyle = isHovered ? 'rgba(255, 255, 255, 0.25)' : 'transparent';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px "Lilita One", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
    ctx.restore();
  }

  // Exact reproduction of Screenshot 3 (Settings Modal)
  renderSettingsModal() {
    const ctx = this.ctx;

    // Dark semi-transparent backdrop
    ctx.fillStyle = 'rgba(11, 26, 45, 0.82)';
    ctx.fillRect(0, 0, this.width, this.height);

    // Pink Rounded Box
    const modalW = 540;
    const modalH = 410;
    const modalX = (this.width - modalW) / 2;
    const modalY = (this.height - modalH) / 2 + 15;

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

    // Title: "SETTINGS"
    ctx.font = '900 44px "Lilita One", cursive';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SETTINGS', modalW / 2, 42);

    // Option 1: BUFFS
    ctx.font = '900 38px "Lilita One", cursive';
    ctx.textAlign = 'left';
    ctx.fillText('BUFFS', 50, 115);

    const buffsOn = this.settings.buffs;
    this.drawSettingPill(ctx, 240, 88, 90, 56, 'ON', buffsOn, this.hoveredButton === 'buffs_on');
    this.drawSettingPill(ctx, 350, 88, 90, 56, 'OFF', !buffsOn, this.hoveredButton === 'buffs_off');

    // Option 2: TIME
    ctx.fillText('TIME', 50, 205);
    const timeVal = this.settings.time;
    this.drawSettingPill(ctx, 240, 178, 80, 56, '60', timeVal === 60, this.hoveredButton === 'time_60');
    this.drawSettingPill(ctx, 330, 178, 90, 56, '120', timeVal === 120, this.hoveredButton === 'time_120');
    this.drawSettingPill(ctx, 430, 178, 90, 56, '180', timeVal === 180, this.hoveredButton === 'time_180');

    // Caption: "THE SETTINGS ARE SAVED AUTOMATICALLY"
    ctx.font = '800 16px "Lilita One", cursive';
    ctx.textAlign = 'center';
    ctx.fillText('THE SETTINGS ARE SAVED AUTOMATICALLY', modalW / 2, 275);

    // CLOSE Button in White Outlined Box
    const isHoverClose = this.hoveredButton === 'close_settings';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.fillStyle = isHoverClose ? 'rgba(255, 255, 255, 0.25)' : 'transparent';
    ctx.beginPath();
    ctx.roundRect(150, 315, 240, 60, 8);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 32px "Lilita One", cursive';
    ctx.fillText('CLOSE', modalW / 2, 345);

    ctx.restore();
  }

  // Keyboard Controls Guide Modal (for 1-Keyboard Local Multiplayer)
  renderControlsModal() {
    const ctx = this.ctx;

    // Dark backdrop
    ctx.fillStyle = 'rgba(11, 26, 45, 0.88)';
    ctx.fillRect(0, 0, this.width, this.height);

    const modalW = 820;
    const modalH = 490;
    const modalX = (this.width - modalW) / 2;
    const modalY = (this.height - modalH) / 2;

    ctx.save();
    ctx.translate(modalX, modalY);

    // Purple / Indigo Box
    ctx.fillStyle = '#6c5ce7';
    ctx.beginPath();
    ctx.roundRect(0, 0, modalW, modalH, 28);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.stroke();

    // Title
    ctx.font = '900 42px "Lilita One", cursive';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⌨ 1 KEYBOARD MULTIPLAYER CONTROLS', modalW / 2, 44);

    // 4 Player Stations Cards
    const cards = [
      { id: 1, name: 'PLAYER 1', color: '#eb3b47', jump: 'W', left: 'A', down: 'S', right: 'D' },
      { id: 2, name: 'PLAYER 2', color: '#38bdf8', jump: '▲', left: '◀', down: '▼', right: '▶' },
      { id: 3, name: 'PLAYER 3', color: '#ffd000', jump: 'I', left: 'J', down: 'K', right: 'L' },
      { id: 4, name: 'PLAYER 4', color: '#00c853', jump: 'T', left: 'F', down: 'G', right: 'H' }
    ];

    const cardW = 180;
    const cardH = 260;
    const startX = 35;

    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const cx = startX + i * 190;
      const cy = 90;

      // Card Box
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.roundRect(cx, cy, cardW, cardH, 16);
      ctx.fill();

      ctx.strokeStyle = c.color;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Header Tag
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.roundRect(cx + 15, cy - 14, cardW - 30, 28, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 15px "Lilita One", cursive';
      ctx.fillText(c.name, cx + cardW / 2, cy);

      // Key Layout Diagram (Jump on top, Left/Down/Right below)
      this.drawKeyCap(ctx, cx + cardW / 2 - 22, cy + 45, 44, 40, c.jump);
      this.drawKeyCap(ctx, cx + 18, cy + 95, 44, 40, c.left);
      this.drawKeyCap(ctx, cx + cardW / 2 - 22, cy + 95, 44, 40, c.down);
      this.drawKeyCap(ctx, cx + cardW - 62, cy + 95, 44, 40, c.right);

      // Actions explanation
      ctx.font = '800 13px "Lilita One", cursive';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`▲ Jump: [${c.jump}]`, cx + cardW / 2, cy + 165);
      ctx.fillText(`◀ ▶ Move: [${c.left}][${c.right}]`, cx + cardW / 2, cy + 195);
      ctx.fillText(`▼ Drop: [${c.down}]`, cx + cardW / 2, cy + 225);
    }

    // CLOSE Button
    const isHoverClose = this.hoveredButton === 'close_controls';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.fillStyle = isHoverClose ? 'rgba(255, 255, 255, 0.25)' : 'transparent';
    ctx.beginPath();
    ctx.roundRect(modalW / 2 - 120, 395, 240, 56, 8);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 28px "Lilita One", cursive';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('GOT IT!', modalW / 2, 423);

    ctx.restore();
  }

  drawKeyCap(ctx, x, y, w, h, keyText) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();

    // 3D bottom bevel
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.roundRect(x, y + h - 5, w, 5, [0, 0, 6, 6]);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.font = '900 18px "Lilita One", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(keyText, x + w / 2, y + h / 2 - 1);
    ctx.restore();
  }

  drawSettingPill(ctx, x, y, w, h, text, isActive, isHovered) {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.fillStyle = isActive ? 'rgba(255, 255, 255, 0.38)' : (isHovered ? 'rgba(255, 255, 255, 0.18)' : 'transparent');
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

  // In-Game match rendering with complete HUD
  renderPlaying() {
    const ctx = this.ctx;

    // 1. Draw Map & Platforms & Decor
    drawMap(ctx, this.currentMap);

    // 2. Draw Floating Buff Orbs
    for (const orb of this.buffOrbs) {
      this.drawBuffOrb(ctx, orb);
    }

    // 3. Draw 100% Real Players
    for (const player of this.players) {
      player.draw(ctx, this.players);
    }

    // 4. Draw Particles
    this.particles.draw(ctx);

    // 5. Draw Enhanced HUD
    this.renderHUD(ctx);

    // 6. Draw Pre-Match Countdown with Player Key Guides!
    if (!this.isMatchStarted) {
      this.renderCountdownOverlay(ctx);
    }
  }

  renderCountdownOverlay(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, this.width, this.height);

    // Big 3D Countdown Number
    ctx.font = '900 130px "Lilita One", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd000';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 14;
    ctx.strokeText(`${this.countdown}`, this.width / 2, this.height / 2 - 40);
    ctx.fillText(`${this.countdown}`, this.width / 2, this.height / 2 - 40);

    ctx.font = '900 36px "Lilita One", cursive';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('GET READY TO RUN!', this.width / 2, this.height / 2 + 50);

    // Key reminders under each player
    for (const p of this.players) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(p.x - 20, p.y + p.height + 14, p.width + 40, 28, 8);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 14px "Lilita One", cursive';
      ctx.fillText(`${p.name}: ${p.label}`, p.x + p.width / 2, p.y + p.height + 28);
    }

    ctx.restore();
  }

  drawBuffOrb(ctx, orb) {
    ctx.save();
    const y = orb.y + Math.sin(orb.bob) * 6;
    ctx.translate(orb.x, y);

    ctx.shadowColor = orb.type === 'speed' ? '#00e5ff' : (orb.type === 'jump' ? '#ffd000' : '#80d8ff');
    ctx.shadowBlur = 16;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icon = orb.type === 'speed' ? '⚡' : (orb.type === 'jump' ? '🦘' : '❄️');
    ctx.fillText(icon, 0, 2);

    ctx.restore();
  }

  renderHUD(ctx) {
    ctx.save();

    // Top-Center Round Timer Pill
    const min = Math.floor(this.roundTimer / 60);
    const sec = this.roundTimer % 60;
    const timeStr = `${min}:${sec < 10 ? '0' : ''}${sec}`;

    const isUrgent = this.roundTimer <= 10;
    ctx.fillStyle = isUrgent ? '#ff1744' : 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(this.width / 2 - 75, 14, 150, 52, 26);
    ctx.fill();

    ctx.strokeStyle = isUrgent ? '#ffffff' : 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 34px "Lilita One", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, this.width / 2, 40);

    // Top-Left: Menu & Controls buttons
    const isHoverMenu = this.hoveredButton === 'ingame_menu';
    this.drawHudButton(20, 16, 110, 48, '◀ MENU', isHoverMenu);

    const isHoverControls = this.hoveredButton === 'ingame_controls';
    this.drawHudButton(140, 16, 110, 48, '⌨ KEYS', isHoverControls);

    // Top-Right: Player Status Cards
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      const cardX = 270 + i * 125;
      const cardY = 16;

      ctx.fillStyle = p.isIt ? '#ff1744' : 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 115, 48, 12);
      ctx.fill();

      ctx.strokeStyle = p.isIt ? '#ffffff' : p.color;
      ctx.lineWidth = p.isIt ? 3.5 : 2;
      ctx.stroke();

      // Player name & key bindings
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 14px "Lilita One", cursive';
      ctx.textAlign = 'center';
      ctx.fillText(`P${p.id} ${p.isIt ? '🔥 IT!' : 'RUN!'}`, cardX + 57, cardY + 18);

      ctx.font = '800 11px "Lilita One", cursive';
      ctx.fillStyle = p.isIt ? '#ffebee' : p.color;
      ctx.fillText(`[${p.label}]`, cardX + 57, cardY + 36);
    }

    // Top Right: Audio Button
    this.drawIconButton(1205, 14, 52, '#38bdf8', '🎵', soundManager.musicEnabled, this.hoveredButton === 'audio_btn');

    ctx.restore();
  }

  drawHudButton(x, y, w, h, text, isHovered) {
    const ctx = this.ctx;
    ctx.fillStyle = isHovered ? '#3b82f6' : 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 16px "Lilita One", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
  }

  // Game Over Modal with Winner Podium
  renderGameOverModal() {
    const ctx = this.ctx;

    // Dark backdrop
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.textAlign = 'center';

    // Banner: "TIME'S UP!"
    ctx.font = '900 86px "Lilita One", cursive';
    ctx.fillStyle = '#ffd000';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 12;
    ctx.strokeText("TIME'S UP!", this.width / 2, 160);
    ctx.fillText("TIME'S UP!", this.width / 2, 160);

    // Subtitle: Caught Player
    const loser = this.players.find(p => p.id === this.loserId);
    if (loser) {
      ctx.font = '900 34px "Lilita One", cursive';
      ctx.fillStyle = '#ff4d6d';
      ctx.fillText(`${loser.name} WAS CAUGHT!`, this.width / 2, 225);
    }

    // Surviving Winners
    ctx.font = '900 36px "Lilita One", cursive';
    ctx.fillStyle = '#00e676';
    const winnerNames = this.winners.map(w => w.name).join(', ');
    ctx.fillText(`🎉 WINNERS: ${winnerNames}! 🎉`, this.width / 2, 305);

    // Draw Winner Ninjas Celebrating
    for (let i = 0; i < this.winners.length; i++) {
      const w = this.winners[i];
      const spacing = 110;
      const startX = this.width / 2 - ((this.winners.length - 1) * spacing) / 2;
      const wx = startX + i * spacing;
      const bounce = Math.abs(Math.sin(Date.now() / 200 + i)) * 25;
      this.drawMiniNinja(ctx, wx, 420 - bounce, w.color, 1, 0);
    }

    // Action Buttons:
    // PLAY AGAIN
    const isHoverPlay = this.hoveredButton === 'play_again';
    this.drawMenuButton(420, 530, 200, 58, '#00c853', 'PLAY AGAIN', '#ffffff', isHoverPlay);

    // CHOOSE MAP
    const isHoverMap = this.hoveredButton === 'change_map';
    this.drawMenuButton(660, 530, 200, 58, '#38bdf8', 'CHOOSE MAP', '#ffffff', isHoverMap);

    ctx.restore();
  }
}
