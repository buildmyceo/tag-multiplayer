// Central Game Engine for Tag Multiplayer - Supports Local 1-Keyboard & Online Multiplayer

import { soundManager } from './audio.js';
import { ParticleSystem } from './particles.js';
import { Player } from './player.js';
import { MAPS, drawMap, drawDiorama, clearCachedMap } from './maps.js';
import { networkManager } from './network.js';

// Preload uploaded official front page image with asynchronous decode
const frontPageImg = new Image();
frontPageImg.src = '/front_page.png';
if (frontPageImg.decode) {
  frontPageImg.decode().catch(() => {});
}

let cachedFrontPageCanvas = null;
function getCachedFrontPage(img, width, height) {
  if (cachedFrontPageCanvas) return cachedFrontPageCanvas;
  if (!img || !img.complete || img.naturalWidth <= 0) return null;
  try {
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext('2d');
    offCtx.drawImage(img, 0, 0, width, height);
    cachedFrontPageCanvas = offscreen;
    return cachedFrontPageCanvas;
  } catch (e) {
    cachedFrontPageCanvas = null;
    return null;
  }
}

export const GAME_STATES = {
  MENU: 'MENU',
  CHOOSE_MAP: 'CHOOSE_MAP',
  SETTINGS: 'SETTINGS',
  CONTROLS_MODAL: 'CONTROLS_MODAL',
  ONLINE_MENU: 'ONLINE_MENU',
  ONLINE_CREATE: 'ONLINE_CREATE',
  ONLINE_LOBBY: 'ONLINE_LOBBY',
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

    // Mode: 'LOCAL' or 'ONLINE'
    this.gameMode = 'LOCAL';

    // Game Settings (persisted)
    this.settings = {
      time: parseInt(localStorage.getItem('tag_time') || '60', 10),
      playerName: localStorage.getItem('tag_player_name') || 'Player 1'
    };

    this.playerCount = 2; // 2, 3, or 4
    this.currentMapKey = 'forest';
    this.currentMap = MAPS.forest;

    this.players = [];
    this.roundTimer = this.settings.time;
    this.roundTimerMs = this.settings.time * 1000;
    this.countdown = 3;
    this.countdownTimer = 180;
    this.isMatchStarted = false;
    this.isPaused = false;

    // Dynamic 20s Random Portal System
    this.portalActive = false;
    this.portalSpawnTimer = 0;
    this.portalDurationTimer = 0;

    // Multi-key tracking Set
    this.keys = new Set();

    // Mouse coordinates relative to canvas
    this.mouse = { x: 0, y: 0 };
    this.hoveredButton = null;

    // Online Room Data
    this.onlineRoom = null;
    this.myOnlinePlayerId = 1;
    this.onlineErrorMessage = '';
    this.syncTick = 0;

    // Menu animations
    this.menuAnimTime = 0;
    this.screenShake = 0;

    // Bot AI & Toast state
    this.botsEnabled = false;
    this.isVsBot = false;
    this.toastMessage = '';
    this.toastTimer = 0;

    // Winner info
    this.loserId = null;
    this.winners = [];

    this.initEventListeners();
    this.initNetworkListeners();
    this.checkUrlDeepLink();
  }

  rebindCanvas(newCanvas) {
    this.canvas = newCanvas;
    this.ctx = newCanvas.getContext('2d');
    this.width = newCanvas.width;
    this.height = newCanvas.height;
    cachedFrontPageCanvas = null;
    clearCachedMap();
    this.initEventListeners();
    this.render();
  }

  initEventListeners() {
    window.addEventListener('keydown', e => {
      this.keys.add(e.key);
      this.keys.add(e.code);
      this.keys.add(e.key.toLowerCase());
      try { soundManager.init(); } catch (err) {}

      // Prevent window scrolling on arrow keys and space during gameplay
      const scrollKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
      if (scrollKeys.includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (this.state === GAME_STATES.PLAYING) {
          this.togglePause();
        } else if (this.state === GAME_STATES.SETTINGS || this.state === GAME_STATES.CONTROLS_MODAL) {
          this.state = this.previousState;
        } else if (this.state === GAME_STATES.CHOOSE_MAP || this.state === GAME_STATES.ONLINE_MENU || this.state === GAME_STATES.ONLINE_CREATE) {
          this.state = GAME_STATES.MENU;
        }
      }

      // Quick start shortcuts from Main Menu
      if (this.state === GAME_STATES.MENU) {
        if (e.key === '1') {
          this.startLocalMatch('forest', 1, true);
        } else if (e.key === '2') {
          this.startLocalMatch('forest', 2, false);
        } else if (e.key === '3') {
          this.startLocalMatch('forest', 3, false);
        } else if (e.key === '4') {
          this.startLocalMatch('forest', 4, false);
        } else if (e.code === 'Space' || e.code === 'Enter') {
          this.startLocalMatch('forest', 1, true);
        }
      }

      // Toggle Bot AI during in-game local match with 'B'
      if (e.key === 'b' || e.key === 'B') {
        if (this.state === GAME_STATES.PLAYING && this.gameMode === 'LOCAL') {
          this.toggleBotMode();
        }
      }

      // Enter or Space to start match on ARENA SELECT
      if (e.code === 'Space' || e.code === 'Enter' || e.key === ' ' || e.key === 'Enter') {
        if (this.state === GAME_STATES.CHOOSE_MAP) {
          this.startLocalMatch('forest', this.playerCount, this.isVsBot);
        }
      }
    });

    window.addEventListener('keyup', e => {
      this.keys.delete(e.key);
      this.keys.delete(e.code);
      this.keys.delete(e.key.toLowerCase());
    });

    const updateMouse = e => {
      if (!e) return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = rect.width ? this.width / rect.width : 1;
      const scaleY = rect.height ? this.height / rect.height : 1;
      this.mouse.x = (e.clientX - rect.left) * scaleX;
      this.mouse.y = (e.clientY - rect.top) * scaleY;
    };

    this.canvas.addEventListener('mousemove', e => {
      updateMouse(e);
      this.checkHover();
    });

    let lastClickTime = 0;
    const triggerClickAction = e => {
      const now = performance.now();
      if (now - lastClickTime < 80) return;
      lastClickTime = now;

      if (e) updateMouse(e);
      try {
        soundManager.init();
      } catch (err) {}
      this.handleClick();
    };

    // Use pointerdown for instantaneous cross-device response
    if (window.PointerEvent) {
      this.canvas.addEventListener('pointerdown', e => {
        triggerClickAction(e);
      });
    } else {
      this.canvas.addEventListener('mousedown', triggerClickAction);
      this.canvas.addEventListener('touchstart', e => {
        if (e.touches && e.touches.length > 0) {
          const touch = e.touches[0];
          const rect = this.canvas.getBoundingClientRect();
          this.mouse.x = (touch.clientX - rect.left) * (this.width / (rect.width || 1));
          this.mouse.y = (touch.clientY - rect.top) * (this.height / (rect.height || 1));
        }
        triggerClickAction();
      }, { passive: false });
    }
  }

  // Network event callbacks
  initNetworkListeners() {
    networkManager.on('roomCreated', (data) => {
      this.onlineRoom = data.room;
      this.myOnlinePlayerId = data.playerId;
      this.state = GAME_STATES.ONLINE_LOBBY;
    });

    networkManager.on('joinSuccess', (data) => {
      this.onlineRoom = data.room;
      this.myOnlinePlayerId = data.playerId;
      this.state = GAME_STATES.ONLINE_LOBBY;
    });

    networkManager.on('joinError', (msg) => {
      this.onlineErrorMessage = msg;
      setTimeout(() => { this.onlineErrorMessage = ''; }, 5000);
    });

    networkManager.on('error', (msg) => {
      this.onlineErrorMessage = msg;
      setTimeout(() => { this.onlineErrorMessage = ''; }, 6000);
    });

    networkManager.on('ping', (pingVal) => {
      // Live ping updated
    });

    networkManager.on('playerJoined', (room) => {
      this.onlineRoom = room;
      soundManager.playClick();
    });

    networkManager.on('playerLeft', (room) => {
      this.onlineRoom = room;
    });

    networkManager.on('gameStarted', (data) => {
      this.startOnlineMatch(data);
    });

    networkManager.on('remotePlayerSync', (data) => {
      if (this.state !== GAME_STATES.PLAYING) return;
      const remotePlayer = this.players.find(p => p.id === data.playerId);
      if (remotePlayer && remotePlayer.isRemote) {
        remotePlayer.updateRemote(data);
      }
    });

    networkManager.on('tagSync', (data) => {
      if (this.state !== GAME_STATES.PLAYING) return;
      const fromP = this.players.find(p => p.id === data.fromId);
      const toP = this.players.find(p => p.id === data.toId);
      if (fromP && toP) {
        fromP.passTag();
        toP.tag();
        soundManager.playTag();
        this.screenShake = 14;
        this.particles.createTagBurst(data.x, data.y);
      }
    });

    networkManager.on('portalUsedSync', () => {
      if (this.state !== GAME_STATES.PLAYING) return;
      this.consumePortals(false);
    });

    networkManager.on('portalsSpawnedSync', (data) => {
      if (this.state !== GAME_STATES.PLAYING) return;
      this.applyPortalsSpawned(data.portals);
    });

    networkManager.on('gameRestarted', (data) => {
      this.startOnlineMatch({
        map: this.currentMapKey,
        itPlayerId: data.itPlayerId,
        time: data.time
      });
    });
  }

  // Check URL param ?room=CODE
  checkUrlDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode) {
      setTimeout(() => {
        this.joinOnlineRoom(roomCode);
      }, 500);
    }
  }

  saveSettings() {
    localStorage.setItem('tag_time', this.settings.time);
    localStorage.setItem('tag_player_name', this.settings.playerName);
  }

  toggleFullscreen() {
    const doc = document;
    const docEl = document.documentElement;
    const isFullscreen = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement;
    if (!isFullscreen) {
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(() => {});
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        docEl.mozRequestFullScreen();
      }
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
      }
    }
  }

  // Start Local Match - Supports 1 Player (Vs Bot) and 2-4 Players (1-Keyboard)
  startLocalMatch(mapKey, playerCount, isVsBot = false) {
    try {
      this.gameMode = 'LOCAL';
      this.currentMapKey = mapKey || 'forest';
      this.currentMap = MAPS[this.currentMapKey] || MAPS.forest;

      if (playerCount === 1) {
        isVsBot = true;
        this.playerCount = 2;
      } else {
        this.playerCount = Math.max(2, Math.min(4, playerCount || this.playerCount || 2));
      }
      this.isVsBot = isVsBot;
      this.botsEnabled = isVsBot;

      const duration = Number(this.settings.time) || 60;
      this.roundTimer = Math.max(10, duration);
      this.roundTimerMs = this.roundTimer * 1000;
      this.countdown = 3;
      this.countdownTimer = 180;
      this.isMatchStarted = false;
      this.isPaused = false;

      // Reset dynamic portals
      this.currentMap.portals = [];
      this.currentMap.onPortalUsed = (p1, p2) => this.consumePortals(true);
      this.portalActive = false;
      this.portalSpawnTimer = 0;
      this.portalDurationTimer = 0;

      this.loserId = null;
      this.winners = [];

      // Universal controls for Solo Player: accepts WASD, Arrow keys, Space
      const soloControls = {
        leftKeys: ['a', 'A', 'KeyA', 'arrowleft', 'ArrowLeft'],
        rightKeys: ['d', 'D', 'KeyD', 'arrowright', 'ArrowRight'],
        jumpKeys: ['w', 'W', 'KeyW', 'arrowup', 'ArrowUp', ' ', 'Space'],
        downKeys: ['s', 'S', 'KeyS', 'arrowdown', 'ArrowDown']
      };

      const configs = [
        {
          id: 1,
          color: '#eb3b47',
          name: 'Player 1',
          label: isVsBot ? 'WASD / ARROWS' : 'W-A-S-D',
          controls: isVsBot ? soloControls : {
            leftKeys: ['a', 'A', 'KeyA'],
            rightKeys: ['d', 'D', 'KeyD'],
            jumpKeys: ['w', 'W', 'KeyW', ' ', 'Space'],
            downKeys: ['s', 'S', 'KeyS']
          }
        },
        {
          id: 2,
          color: '#38bdf8',
          name: isVsBot ? 'Ninja Bot 🤖' : 'Player 2',
          label: isVsBot ? 'AI BOT' : 'ARROWS',
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
          name: isVsBot ? 'Ninja Bot 3 🤖' : 'Player 3',
          label: isVsBot ? 'AI BOT' : 'I-J-K-L',
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
          name: isVsBot ? 'Ninja Bot 4 🤖' : 'Player 4',
          label: isVsBot ? 'AI BOT' : 'T-F-G-H',
          controls: {
            leftKeys: ['f', 'F', 'KeyF'],
            rightKeys: ['h', 'H', 'KeyH'],
            jumpKeys: ['t', 'T', 'KeyT'],
            downKeys: ['g', 'G', 'KeyG']
          }
        }
      ];

      this.players = [];
      for (let i = 0; i < this.playerCount; i++) {
        const cfg = configs[i] || configs[0];
        const spawn = (this.currentMap && this.currentMap.spawns && this.currentMap.spawns[i]) ? this.currentMap.spawns[i] : { x: 200 + i * 200, y: 500 };
        const isBot = isVsBot ? (i > 0) : false;
        const player = new Player(cfg.id, cfg.color, cfg.name, cfg.label, spawn.x, spawn.y, cfg.controls, false, isBot);
        this.players.push(player);
      }

      if (this.players.length > 0) {
        const itIndex = Math.floor(Math.random() * this.players.length);
        if (this.players[itIndex]) {
          this.players[itIndex].tag();
        }
      }

      this.state = GAME_STATES.PLAYING;
      console.log('[TAG] Match started! Players:', this.playerCount, 'VsBot:', isVsBot, 'State:', this.state);
      try {
        soundManager.playCountdown();
      } catch (e) {}
    } catch (err) {
      console.error('[TAG startLocalMatch error]:', err);
    }
  }

  toggleBotMode() {
    this.botsEnabled = !this.botsEnabled;
    const defaultLabels = ['', 'WASD', 'ARROWS', 'I-J-K-L', 'T-F-G-H'];
    for (const p of this.players) {
      if (p.id > 1) {
        p.isBot = this.botsEnabled;
        p.name = this.botsEnabled ? `Ninja Bot ${p.id} 🤖` : `Player ${p.id}`;
        p.label = this.botsEnabled ? 'AI BOT' : (defaultLabels[p.id] || 'KEYS');
      }
    }
    soundManager.playClick();
    this.showToast(this.botsEnabled ? '🤖 BOTS ACTIVATED!' : '👤 HUMAN 1-KEYBOARD MODE!');
  }

  showToast(msg) {
    this.toastMessage = msg;
    this.toastTimer = 110;
  }

  togglePause() {
    if (this.state !== GAME_STATES.PLAYING) return;
    this.isPaused = !this.isPaused;
    try {
      soundManager.playClick();
    } catch (e) {}
  }

  // Start Online Match (Synced across devices)
  startOnlineMatch(data) {
    this.gameMode = 'ONLINE';
    this.currentMapKey = data.map || 'forest';
    this.currentMap = MAPS[this.currentMapKey] || MAPS.forest;
    this.playerCount = this.onlineRoom.players.length;

    this.roundTimer = data.time || this.settings.time;
    this.roundTimerMs = this.roundTimer * 1000;
    this.countdown = 3;
    this.countdownTimer = 180;
    this.isMatchStarted = false;
    this.isPaused = false;

    // Reset dynamic portals
    this.currentMap.portals = [];
    this.currentMap.onPortalUsed = (p1, p2) => this.consumePortals(true);
    this.portalActive = false;
    this.portalSpawnTimer = 0;
    this.portalDurationTimer = 0;

    this.loserId = null;
    this.winners = [];

    // Each device controls ONLY its own player!
    // Other players are marked isRemote = true!
    const universalControls = {
      leftKeys: ['a', 'A', 'KeyA', 'arrowleft', 'ArrowLeft'],
      rightKeys: ['d', 'D', 'KeyD', 'arrowright', 'ArrowRight'],
      jumpKeys: ['w', 'W', 'KeyW', 'arrowup', 'ArrowUp', ' '],
      downKeys: ['s', 'S', 'KeyS', 'arrowdown', 'ArrowDown']
    };

    const colors = ['#eb3b47', '#38bdf8', '#ffd000', '#00c853'];
    this.players = [];

    for (let i = 0; i < this.onlineRoom.players.length; i++) {
      const roomP = this.onlineRoom.players[i];
      const isMe = roomP.id === this.myOnlinePlayerId;
      const spawn = this.currentMap.spawns[i] || { x: 200 + i * 200, y: 500 };

      const player = new Player(
        roomP.id,
        colors[i],
        roomP.name + (isMe ? ' (YOU)' : ''),
        isMe ? 'WASD / ARROWS' : 'REMOTE',
        spawn.x,
        spawn.y,
        isMe ? universalControls : {},
        !isMe // isRemote
      );

      if (roomP.id === data.itPlayerId) {
        player.tag();
      }

      this.players.push(player);
    }

    this.state = GAME_STATES.PLAYING;
    soundManager.playCountdown();
  }

  createOnlineRoom(maxPlayers, mapKey) {
    this.playerCount = maxPlayers;
    this.currentMapKey = mapKey;
    networkManager.createRoom(
      mapKey,
      maxPlayers,
      this.settings.playerName,
      this.settings.time,
      false
    );
  }

  joinOnlineRoom(code) {
    if (!code) {
      code = prompt('Enter 4-Letter Room Code (e.g. W8NZ):');
    }
    if (code) {
      code = code.trim().toUpperCase();
      networkManager.joinRoom(code, this.settings.playerName);
    }
  }

  checkHover() {
    const mx = this.mouse.x;
    const my = this.mouse.y;
    this.hoveredButton = null;

    if (this.state === GAME_STATES.MENU) {
      // Top buttons on front_page.png
      if (mx >= 14 && mx <= 106 && my >= 14 && my <= 90) this.hoveredButton = 'settings_btn';
      if (mx >= 1036 && mx <= 1120 && my >= 14 && my <= 90) this.hoveredButton = 'fullscreen_btn';
      if (mx >= 1120 && mx <= 1200 && my >= 14 && my <= 90) this.hoveredButton = 'sound_btn';
      if (mx >= 1200 && mx <= 1276 && my >= 14 && my <= 90) this.hoveredButton = 'music_btn';

      // Main Menu 5 Choice Pills on front_page.png (X: 428 to 852)
      if (mx >= 428 && mx <= 852 && my >= 300 && my <= 370) this.hoveredButton = '1_player';
      if (mx >= 428 && mx <= 852 && my >= 374 && my <= 448) this.hoveredButton = '2_players';
      if (mx >= 428 && mx <= 852 && my >= 454 && my <= 528) this.hoveredButton = '3_players';
      if (mx >= 428 && mx <= 852 && my >= 534 && my <= 606) this.hoveredButton = '4_players';
      if (mx >= 428 && mx <= 852 && my >= 612 && my <= 682) this.hoveredButton = 'play_online';
    } else if (this.state === GAME_STATES.ONLINE_MENU) {
      if (mx >= 380 && mx <= 900 && my >= 220 && my <= 320) this.hoveredButton = 'online_create';
      if (mx >= 380 && mx <= 900 && my >= 330 && my <= 420) this.hoveredButton = 'online_join';
      if (mx >= this.width / 2 - 150 && mx <= this.width / 2 + 150 && my >= 435 && my <= 470) this.hoveredButton = 'online_server_config';
      if (mx >= 36 && mx <= 100 && my >= 620 && my <= 684) this.hoveredButton = 'back_to_menu';
    } else if (this.state === GAME_STATES.ONLINE_CREATE) {
      // Choose Players: 2, 3, 4
      if (mx >= 420 && mx <= 520 && my >= 220 && my <= 280) this.hoveredButton = 'create_2p';
      if (mx >= 540 && mx <= 640 && my >= 220 && my <= 280) this.hoveredButton = 'create_3p';
      if (mx >= 660 && mx <= 760 && my >= 220 && my <= 280) this.hoveredButton = 'create_4p';

      // CREATE ROOM Button
      if (mx >= 460 && mx <= 760 && my >= 440 && my <= 510) this.hoveredButton = 'submit_create_room';
      if (mx >= 36 && mx <= 100 && my >= 620 && my <= 684) this.hoveredButton = 'back_to_online_menu';
    } else if (this.state === GAME_STATES.ONLINE_LOBBY) {
      // Start Game (Host only)
      if (mx >= 460 && mx <= 820 && my >= 460 && my <= 530) this.hoveredButton = 'lobby_start_game';
      if (mx >= 36 && mx <= 100 && my >= 620 && my <= 684) this.hoveredButton = 'lobby_leave';
      if (mx >= 460 && mx <= 820 && my >= 550 && my <= 600) this.hoveredButton = 'copy_room_link';
    } else if (this.state === GAME_STATES.CHOOSE_MAP) {
      // Top buttons
      if (mx >= 1200 && mx <= 1256 && my >= 24 && my <= 80) this.hoveredButton = 'audio_btn';
      if (mx >= 1130 && mx <= 1186 && my >= 24 && my <= 80) this.hoveredButton = 'controls_btn';
      if (mx >= 1060 && mx <= 1116 && my >= 24 && my <= 80) this.hoveredButton = 'fullscreen_btn';

      // Start Game Button + Official Arena Card (generous hit box for instant start)
      if (mx >= 350 && mx <= 930 && my >= 120 && my <= 555) this.hoveredButton = 'map_forest';
      if (mx >= 400 && mx <= 630 && my >= 565 && my <= 630) this.hoveredButton = 'open_settings';
      if (mx >= 650 && mx <= 880 && my >= 565 && my <= 630) this.hoveredButton = 'controls_btn';
      if (mx >= 36 && mx <= 100 && my >= 615 && my <= 685) this.hoveredButton = 'back_to_menu';
    } else if (this.state === GAME_STATES.SETTINGS) {
      if (mx >= 600 && mx <= 675 && my >= 310 && my <= 366) this.hoveredButton = 'time_60';
      if (mx >= 690 && mx <= 775 && my >= 310 && my <= 366) this.hoveredButton = 'time_120';
      if (mx >= 790 && mx <= 875 && my >= 310 && my <= 366) this.hoveredButton = 'time_180';
      if (mx >= 520 && mx <= 760 && my >= 450 && my <= 510) this.hoveredButton = 'close_settings';
    } else if (this.state === GAME_STATES.CONTROLS_MODAL) {
      if (mx >= 520 && mx <= 760 && my >= 520 && my <= 580) this.hoveredButton = 'close_controls';
    } else if (this.state === GAME_STATES.PLAYING) {
      if (this.isPaused) {
        const btnX = 470;
        const btnW = 340;
        const btnH = 64;

        if (mx >= 20 && mx <= 72 && my >= 14 && my <= 66) {
          this.hoveredButton = 'pause_btn';
        } else if (mx >= btnX && mx <= btnX + btnW) {
          if (my >= 275 && my <= 275 + btnH) this.hoveredButton = 'pause_resume';
          else if (my >= 360 && my <= 360 + btnH) this.hoveredButton = 'pause_settings';
          else if (my >= 445 && my <= 445 + btnH) this.hoveredButton = 'pause_exit';
        }
      } else {
        if (mx >= 20 && mx <= 72 && my >= 14 && my <= 66) this.hoveredButton = 'pause_btn';
      }
    } else if (this.state === GAME_STATES.GAME_OVER) {
      if (mx >= 420 && mx <= 620 && my >= 530 && my <= 588) this.hoveredButton = 'play_again';
      if (mx >= 660 && mx <= 860 && my >= 530 && my <= 588) this.hoveredButton = 'change_map';
    }

    if (this.canvas && this.canvas.style) {
      this.canvas.style.cursor = this.hoveredButton ? 'pointer' : 'default';
    }
  }

  handleClick() {
    this.checkHover();
    if (!this.hoveredButton) return;

    soundManager.playClick();

    if (this.hoveredButton === 'settings_btn') {
      this.previousState = this.state;
      this.state = GAME_STATES.SETTINGS;
      return;
    }

    if (this.hoveredButton === 'fullscreen_btn') {
      this.toggleFullscreen();
      return;
    }

    if (this.hoveredButton === 'sound_btn') {
      soundManager.toggleSound();
      this.showToast(soundManager.soundEnabled ? '🔊 SOUND: ON' : '🔇 SOUND: MUTED');
      return;
    }

    if (this.hoveredButton === 'music_btn' || this.hoveredButton === 'audio_btn') {
      soundManager.toggleMusic();
      this.showToast(soundManager.musicEnabled ? '🎵 MUSIC: ON' : '🎵 MUSIC: MUTED');
      return;
    }

    if (this.hoveredButton === 'controls_btn' || this.hoveredButton === 'ingame_controls') {
      this.previousState = this.state;
      this.state = GAME_STATES.CONTROLS_MODAL;
      return;
    }

    if (this.state === GAME_STATES.MENU) {
      if (this.hoveredButton === '1_player') {
        this.playerCount = 1;
        this.startLocalMatch('forest', 1, true);
      } else if (this.hoveredButton === '2_players') {
        this.playerCount = 2;
        this.startLocalMatch('forest', 2, false);
      } else if (this.hoveredButton === '3_players') {
        this.playerCount = 3;
        this.startLocalMatch('forest', 3, false);
      } else if (this.hoveredButton === '4_players') {
        this.playerCount = 4;
        this.startLocalMatch('forest', 4, false);
      } else if (this.hoveredButton === 'play_online') {
        this.state = GAME_STATES.ONLINE_MENU;
      }
    } else if (this.state === GAME_STATES.ONLINE_MENU) {
      if (this.hoveredButton === 'online_create') {
        this.tempOnlinePlayers = 2;
        this.tempOnlineMap = 'forest';
        this.state = GAME_STATES.ONLINE_CREATE;
      } else if (this.hoveredButton === 'online_join') {
        this.joinOnlineRoom();
      } else if (this.hoveredButton === 'online_server_config') {
        const cur = networkManager.getServerUrl();
        const entered = prompt('Enter custom WebSocket server URL (e.g. wss://your-server.onrender.com), or leave blank for auto-detect:', cur);
        if (entered !== null) {
          networkManager.setServerUrl(entered);
          networkManager.disconnect();
          networkManager.connect().catch(() => {});
          this.onlineErrorMessage = entered ? `Server URL set to: ${entered}` : 'Server URL reset to auto-detect';
          setTimeout(() => { this.onlineErrorMessage = ''; }, 3000);
        }
      } else if (this.hoveredButton === 'back_to_menu') {
        this.state = GAME_STATES.MENU;
      }
    } else if (this.state === GAME_STATES.ONLINE_CREATE) {
      if (this.hoveredButton === 'create_2p') this.tempOnlinePlayers = 2;
      if (this.hoveredButton === 'create_3p') this.tempOnlinePlayers = 3;
      if (this.hoveredButton === 'create_4p') this.tempOnlinePlayers = 4;
      this.tempOnlineMap = 'forest';

      if (this.hoveredButton === 'submit_create_room') {
        this.createOnlineRoom(this.tempOnlinePlayers || 2, 'forest');
      } else if (this.hoveredButton === 'back_to_online_menu') {
        this.state = GAME_STATES.ONLINE_MENU;
      }
    } else if (this.state === GAME_STATES.ONLINE_LOBBY) {
      if (this.hoveredButton === 'lobby_start_game') {
        if (networkManager.isHost && this.onlineRoom.players.length >= 2) {
          networkManager.startGame();
        }
      } else if (this.hoveredButton === 'lobby_leave') {
        networkManager.disconnect();
        this.state = GAME_STATES.ONLINE_MENU;
      } else if (this.hoveredButton === 'copy_room_link') {
        const url = `${window.location.origin}/?room=${this.onlineRoom.code}`;
        navigator.clipboard.writeText(url).then(() => {
          this.onlineErrorMessage = 'Room link copied to clipboard!';
          setTimeout(() => { this.onlineErrorMessage = ''; }, 3000);
        }).catch(() => {});
      }
    } else if (this.state === GAME_STATES.CHOOSE_MAP) {
      if (this.hoveredButton === 'map_forest' || this.hoveredButton === 'start_match') {
        this.startLocalMatch('forest', this.playerCount);
      } else if (this.hoveredButton === 'open_settings') {
        this.previousState = this.state;
        this.state = GAME_STATES.SETTINGS;
      } else if (this.hoveredButton === 'back_to_menu') {
        this.state = GAME_STATES.MENU;
      }
    } else if (this.state === GAME_STATES.SETTINGS) {
      if (this.hoveredButton === 'time_60') {
        this.settings.time = 60;
        this.saveSettings();
      } else if (this.hoveredButton === 'time_120') {
        this.settings.time = 120;
        this.saveSettings();
      } else if (this.hoveredButton === 'time_180') {
        this.settings.time = 180;
        this.saveSettings();
      } else if (this.hoveredButton === 'close_settings') {
        this.state = this.previousState;
      }
    } else if (this.state === GAME_STATES.CONTROLS_MODAL) {
      if (this.hoveredButton === 'close_controls') {
        this.state = this.previousState;
      }
    } else if (this.state === GAME_STATES.PLAYING) {
      if (this.hoveredButton === 'pause_btn') {
        this.togglePause();
      } else if (this.hoveredButton === 'pause_resume') {
        this.isPaused = false;
      } else if (this.hoveredButton === 'pause_settings') {
        this.previousState = this.state;
        this.state = GAME_STATES.SETTINGS;
      } else if (this.hoveredButton === 'pause_exit') {
        this.isPaused = false;
        if (this.gameMode === 'ONLINE') {
          networkManager.disconnect();
          this.state = GAME_STATES.ONLINE_MENU;
        } else {
          this.state = GAME_STATES.MENU;
        }
      }
    } else if (this.state === GAME_STATES.GAME_OVER) {
      if (this.hoveredButton === 'play_again') {
        if (this.gameMode === 'ONLINE') {
          networkManager.restartMatch();
        } else {
          this.startLocalMatch(this.currentMapKey, this.playerCount, this.isVsBot);
        }
      } else if (this.hoveredButton === 'change_map') {
        if (this.gameMode === 'ONLINE') {
          networkManager.disconnect();
          this.state = GAME_STATES.ONLINE_MENU;
        } else {
          this.state = GAME_STATES.MENU;
        }
      }
    }
  }

  update() {
    if (this.state !== GAME_STATES.PLAYING || !this.isPaused) {
      this.particles.update();
    }
    this.menuAnimTime += 0.045;

    if (this.toastTimer > 0) {
      this.toastTimer--;
      if (this.toastTimer <= 0) {
        this.toastMessage = '';
      }
    }

    if (this.screenShake > 0) {
      this.screenShake *= 0.88;
      if (this.screenShake < 0.2) this.screenShake = 0;
    }

    if (this.state === GAME_STATES.PLAYING) {
      if (!this.isPaused) {
        this.updatePlayingMatch();
      }
    } else if (this.state === GAME_STATES.MENU) {
      this.particles.spawnAmbient('petals', this.width, this.height);
    }
  }

  updatePlayingMatch() {
    this.particles.spawnAmbient(this.currentMap.ambientType, this.width, this.height);

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

        const canManagePortals = (this.gameMode === 'LOCAL') || (this.gameMode === 'ONLINE' && networkManager.isHost);
        if (canManagePortals) {
          this.spawnRandomPortals();
        }
      }
      return;
    }

    this.roundTimerMs -= 1000 / 60;
    this.roundTimer = Math.max(0, Math.ceil(this.roundTimerMs / 1000));

    if (this.roundTimer <= 5 && this.roundTimerMs % 1000 < 20) {
      soundManager.playCountdown();
    }

    if (this.roundTimerMs <= 0) {
      this.endMatch();
      return;
    }

    // Update players
    for (const player of this.players) {
      player.update(this.keys, this.currentMap, this.players, this.particles);
    }

    // ONLINE MODE: Send player updates to server at ~30Hz
    if (this.gameMode === 'ONLINE') {
      this.syncTick++;
      if (this.syncTick % 2 === 0) {
        const myP = this.players.find(p => p.id === this.myOnlinePlayerId);
        if (myP) {
          networkManager.sendPlayerSync(myP);
        }
      }
    }

    // Tag Collision Check (adjusted for 34px player size)
    const itPlayer = this.players.find(p => p.isIt);
    if (itPlayer && !itPlayer.isImmune) {
      // In online mode, the player who is IT detects tags to avoid desync
      const canCheckTag = (this.gameMode === 'LOCAL') || (this.gameMode === 'ONLINE' && itPlayer.id === this.myOnlinePlayerId);

      if (canCheckTag) {
        for (const target of this.players) {
          if (target.id === itPlayer.id || target.isImmune) continue;

          const dx = (target.x + target.width / 2) - (itPlayer.x + itPlayer.width / 2);
          const dy = (target.y + target.height / 2) - (itPlayer.y + itPlayer.height / 2);
          const dist = Math.hypot(dx, dy);

          if (dist < 32) {
            itPlayer.passTag();
            target.tag();

            soundManager.playTag();
            this.screenShake = 14;

            const tagX = (itPlayer.x + target.x) / 2 + 17;
            const tagY = (itPlayer.y + target.y) / 2 + 17;
            this.particles.createTagBurst(tagX, tagY);

            if (this.gameMode === 'ONLINE') {
              networkManager.sendTagEvent(itPlayer.id, target.id, tagX, tagY);
            }
            break;
          }
        }
      }
    }

    // Dynamic 20s Portal Loop (Host in online mode or Local)
    const canManagePortals = (this.gameMode === 'LOCAL') || (this.gameMode === 'ONLINE' && networkManager.isHost);
    if (canManagePortals) {
      if (!this.portalActive) {
        this.portalSpawnTimer--;
        if (this.portalSpawnTimer <= 0) {
          this.spawnRandomPortals();
        }
      } else {
        // Portals active: if unused for 20s (1200 frames), randomly relocate them
        this.portalDurationTimer--;
        if (this.portalDurationTimer <= 0) {
          this.spawnRandomPortals();
        }
      }
    }
  }

  // Generate pair of portals on two distinct platforms separated by distance
  spawnRandomPortals() {
    if (!this.currentMap || !this.currentMap.platforms) return;

    // Filter platforms: elevated non-ground platforms wide enough for portal (above water)
    const validPlatforms = this.currentMap.platforms.filter(p => !p.isGround && p.width >= 70 && p.y < 650);
    if (validPlatforms.length < 2) return;

    // Shuffle platforms
    const shuffled = [...validPlatforms].sort(() => Math.random() - 0.5);

    let platA = shuffled[0];
    let platB = null;

    for (let i = 1; i < shuffled.length; i++) {
      const candidate = shuffled[i];
      const dist = Math.hypot((candidate.x + candidate.width / 2) - (platA.x + platA.width / 2), candidate.y - platA.y);
      if (dist >= 280) {
        platB = candidate;
        break;
      }
    }

    if (!platB) {
      platB = shuffled[1];
    }

    const portalW = 42;
    const portalH = 50;

    const xA = platA.x + Math.max(6, Math.min(platA.width - portalW - 6, (platA.width - portalW) / 2));
    const yA = platA.y - portalH;

    const xB = platB.x + Math.max(6, Math.min(platB.width - portalW - 6, (platB.width - portalW) / 2));
    const yB = platB.y - portalH;

    const portals = [
      {
        id: 'portal_a',
        targetId: 'portal_b',
        label: 'PORTAL A',
        color: '#d946ef',
        x: Math.round(xA),
        y: Math.round(yA),
        width: portalW,
        height: portalH
      },
      {
        id: 'portal_b',
        targetId: 'portal_a',
        label: 'PORTAL B',
        color: '#06b6d4',
        x: Math.round(xB),
        y: Math.round(yB),
        width: portalW,
        height: portalH
      }
    ];

    this.applyPortalsSpawned(portals);

    if (this.gameMode === 'ONLINE' && networkManager.isHost) {
      networkManager.sendPortalsSpawned(portals);
    }
  }

  applyPortalsSpawned(portals) {
    if (!this.currentMap) return;
    this.currentMap.portals = portals;
    this.portalActive = true;
    this.portalDurationTimer = 20 * 60; // 20 seconds lifetime if unused
    this.showToast('🌀 NEW PORTALS OPENED!');

    for (const p of (portals || [])) {
      if (this.particles) {
        this.particles.createTeleportSwirl(p.x + p.width / 2, p.y + p.height / 2);
      }
    }
    soundManager.playTeleport();
  }

  // Once used, portals disappear immediately and restart the 20-second timer
  consumePortals(broadcast = true) {
    if (!this.portalActive && (!this.currentMap.portals || this.currentMap.portals.length === 0)) return;

    if (this.currentMap && this.currentMap.portals) {
      for (const p of this.currentMap.portals) {
        if (this.particles) {
          this.particles.createTeleportSwirl(p.x + p.width / 2, p.y + p.height / 2);
          this.particles.createTagBurst(p.x + p.width / 2, p.y + p.height / 2);
        }
      }
      this.currentMap.portals = [];
    }

    this.portalActive = false;
    this.portalSpawnTimer = 20 * 60; // 20s countdown before next portals spawn
    this.portalDurationTimer = 0;
    this.showToast('🌀 PORTAL USED! NEXT IN 20s');

    if (broadcast && this.gameMode === 'ONLINE') {
      networkManager.sendPortalUsed();
    }
  }

  endMatch() {
    this.isPaused = false;
    this.state = GAME_STATES.GAME_OVER;
    soundManager.playWin();

    const itPlayer = this.players.find(p => p.isIt);
    this.loserId = itPlayer ? itPlayer.id : null;
    this.winners = this.players.filter(p => !p.isIt);

    this.particles.createConfetti(this.width / 2, 220, 110);
    this.particles.createConfetti(this.width / 4, 300, 70);
    this.particles.createConfetti((3 * this.width) / 4, 300, 70);
  }

  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);

    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
    }

    try {
      if (this.state === GAME_STATES.MENU) {
        this.renderMenu();
      } else if (this.state === GAME_STATES.ONLINE_MENU) {
        this.renderOnlineMenu();
      } else if (this.state === GAME_STATES.ONLINE_CREATE) {
        this.renderOnlineCreate();
      } else if (this.state === GAME_STATES.ONLINE_LOBBY) {
        this.renderOnlineLobby();
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
    } catch (e) {
      console.error('[TAG render error]:', e);
      if (typeof window.showErrorOverlay === 'function') {
        window.showErrorOverlay('Render Error: ' + (e.stack || e.message));
      }
    }

    ctx.restore();
  }

  renderMenu() {
    const ctx = this.ctx;

    // 1. Draw Official Front Page Artwork (Cached offscreen canvas for 60fps)
    let bgDrawn = false;
    const cached = getCachedFrontPage(frontPageImg, this.width, this.height);
    if (cached) {
      try {
        ctx.drawImage(cached, 0, 0, this.width, this.height);
        bgDrawn = true;
      } catch (e) {
        cachedFrontPageCanvas = null;
      }
    }
    
    if (!bgDrawn && frontPageImg.complete && frontPageImg.naturalWidth > 0) {
      try {
        ctx.drawImage(frontPageImg, 0, 0, this.width, this.height);
        bgDrawn = true;
      } catch (e) {}
    }

    if (!bgDrawn) {
      ctx.fillStyle = '#3ea5e6';
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // 2. Interactive Button Hover Glows (Highlights exactly over front_page.png buttons)
    const buttonCoords = {
      '1_player': { x: 432, y: 304, w: 416, h: 64 },
      '2_players': { x: 432, y: 378, w: 416, h: 68 },
      '3_players': { x: 432, y: 458, w: 416, h: 68 },
      '4_players': { x: 432, y: 538, w: 416, h: 66 },
      'play_online': { x: 432, y: 614, w: 416, h: 66 }
    };

    const b = buttonCoords[this.hoveredButton];
    if (b) {
      ctx.save();
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.5;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 28);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Top action buttons hover glow
    const topButtons = {
      'settings_btn': { x: 18, y: 16, w: 86, h: 72 },
      'fullscreen_btn': { x: 1040, y: 16, w: 78, h: 72 },
      'sound_btn': { x: 1120, y: 16, w: 78, h: 72 },
      'music_btn': { x: 1200, y: 16, w: 72, h: 72 }
    };
    const tb = topButtons[this.hoveredButton];
    if (tb) {
      ctx.save();
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.roundRect(tb.x, tb.y, tb.w, tb.h, 16);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 3. Status Badges for Sound & Music if muted
    if (!soundManager.soundEnabled) {
      ctx.save();
      ctx.strokeStyle = '#ff1744';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(1136, 30);
      ctx.lineTo(1182, 74);
      ctx.stroke();
      ctx.restore();
    }

    if (!soundManager.musicEnabled) {
      ctx.save();
      ctx.strokeStyle = '#ff1744';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(1216, 30);
      ctx.lineTo(1258, 74);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Ambient Floating Petals / Sparkles
    this.particles.draw(ctx);

    // 5. Toast Notification
    if (this.toastTimer > 0 && this.toastMessage) {
      ctx.save();
      ctx.font = '900 20px "Lilita One", cursive';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const alpha = Math.min(1, this.toastTimer / 20);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.roundRect(this.width / 2 - 160, 246, 320, 42, 12);
      ctx.fill();
      ctx.strokeStyle = '#ffd000';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(this.toastMessage, this.width / 2, 267);
      ctx.restore();
    }
  }

  // 🌐 Online Play Hub Screen
  renderOnlineMenu() {
    const ctx = this.ctx;

    ctx.fillStyle = '#2b6cb0';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 76px "Lilita One", cursive';
    ctx.fillStyle = '#1a365d';
    ctx.fillText('ONLINE MULTIPLAYER', this.width / 2, 105);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('ONLINE MULTIPLAYER', this.width / 2, 100);

    ctx.font = '800 20px "Lilita One", cursive';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`Share with friends: ${window.location.origin}`, this.width / 2, 146);

    // Live Server Connection & Ping Status
    const isConn = networkManager.isConnected;
    const isConnecting = networkManager.isConnecting;
    const ping = networkManager.ping;
    let statusText = isConn ? `🟢 SERVER ONLINE (${ping ? ping + ' ms' : 'READY'})` : (isConnecting ? '🟡 CONNECTING TO SERVER...' : '🔴 SERVER DISCONNECTED');
    let statusColor = isConn ? '#10b981' : (isConnecting ? '#f59e0b' : '#ef4444');

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.roundRect(this.width / 2 - 180, 162, 360, 28, 14);
    ctx.fill();
    ctx.strokeStyle = statusColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 13px "Lilita One", cursive';
    ctx.fillText(statusText, this.width / 2, 177);

    // Error Message Banner (if any)
    if (this.onlineErrorMessage) {
      ctx.fillStyle = '#ff1744';
      ctx.beginPath();
      ctx.roundRect(this.width / 2 - 270, 196, 540, 32, 16);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 14px "Lilita One", cursive';
      ctx.fillText(this.onlineErrorMessage, this.width / 2, 212);
    }
    ctx.restore();

    // 2 Big Choice Cards:
    // 1. CREATE A ROOM
    const isHoverCreate = this.hoveredButton === 'online_create';
    this.drawMenuButton(380, 235, 520, 80, '#00c853', '➕ CREATE A ROOM', '#ffffff', isHoverCreate, 'Host a match for 2 to 4 players');

    // 2. JOIN WITH CODE
    const isHoverJoin = this.hoveredButton === 'online_join';
    this.drawMenuButton(380, 335, 520, 80, '#38bdf8', '🔑 JOIN WITH ROOM CODE', '#ffffff', isHoverJoin, 'Enter a 4-letter room code or link');

    // Custom Server Config button
    const isHoverConfig = this.hoveredButton === 'online_server_config';
    ctx.fillStyle = isHoverConfig ? '#38bdf8' : 'rgba(255, 255, 255, 0.18)';
    ctx.beginPath();
    ctx.roundRect(this.width / 2 - 150, 435, 300, 32, 16);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 12px "Lilita One", cursive';
    const customUrl = networkManager.getServerUrl();
    ctx.fillText(customUrl ? `⚙️ SERVER: ${customUrl.slice(0, 24)}...` : '⚙️ CUSTOM SERVER URL (OPTIONAL)', this.width / 2, 452);

    // Back button
    this.drawBackButton('back_to_menu');
  }

  // ➕ Online Room Creation Screen
  renderOnlineCreate() {
    const ctx = this.ctx;
    ctx.fillStyle = '#2b6cb0';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '900 68px "Lilita One", cursive';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('CREATE ROOM', this.width / 2, 90);

    // Row 1: Player Count
    ctx.font = '900 28px "Lilita One", cursive';
    ctx.fillText('SELECT MAX PLAYERS:', this.width / 2, 180);

    const pCount = this.tempOnlinePlayers || 2;
    this.drawSettingPill(ctx, 420, 215, 100, 60, '2', pCount === 2, this.hoveredButton === 'create_2p');
    this.drawSettingPill(ctx, 540, 215, 100, 60, '3', pCount === 3, this.hoveredButton === 'create_3p');
    this.drawSettingPill(ctx, 660, 215, 100, 60, '4', pCount === 4, this.hoveredButton === 'create_4p');

    // Row 2: Map Selection
    ctx.fillText('ARENA MAP:', this.width / 2, 315);
    this.drawSettingPill(ctx, 470, 340, 340, 56, 'OFFICIAL MAP 1', true, false);

    // Submit Button
    const isHoverSubmit = this.hoveredButton === 'submit_create_room';
    this.drawMenuButton(460, 440, 360, 72, '#00c853', 'CREATE ROOM', '#ffffff', isHoverSubmit);

    ctx.restore();
    this.drawBackButton('back_to_online_menu');
  }

  // 👥 Online Lobby Screen
  renderOnlineLobby() {
    const ctx = this.ctx;
    ctx.fillStyle = '#2b6cb0';
    ctx.fillRect(0, 0, this.width, this.height);

    if (!this.onlineRoom) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 36px "Lilita One", cursive';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('CONNECTING TO ONLINE LOBBY...', this.width / 2, this.height / 2 - 20);
      ctx.font = '800 18px "Lilita One", cursive';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText('Please wait a moment...', this.width / 2, this.height / 2 + 25);
      ctx.restore();
      this.drawBackButton('back_to_online_menu');
      return;
    }

    ctx.save();
    ctx.textAlign = 'center';

    // Room Code Badge
    ctx.font = '900 32px "Lilita One", cursive';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('ROOM CODE:', this.width / 2, 75);

    // Big Code Box
    ctx.fillStyle = '#ffd000';
    ctx.beginPath();
    ctx.roundRect(this.width / 2 - 130, 95, 260, 70, 16);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.font = '900 48px "Lilita One", cursive';
    ctx.fillText(this.onlineRoom.code, this.width / 2, 146);

    // Live Ping Widget in Lobby
    this.drawPingWidget(this.width - 180, 24, 155, 52);

    // Share link button
    const isHoverLink = this.hoveredButton === 'copy_room_link';
    ctx.fillStyle = isHoverLink ? '#ffffff' : 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.roundRect(this.width / 2 - 180, 180, 360, 34, 17);
    ctx.fill();
    ctx.fillStyle = isHoverLink ? '#1e293b' : '#ffffff';
    ctx.font = '800 14px "Lilita One", cursive';
    ctx.fillText('📋 Click to copy join link to share with friends', this.width / 2, 202);

    // Error / status notice
    if (this.onlineErrorMessage) {
      ctx.fillStyle = '#00e676';
      ctx.font = '900 18px "Lilita One", cursive';
      ctx.fillText(this.onlineErrorMessage, this.width / 2, 235);
    }

    // Players list
    const maxP = this.onlineRoom.maxPlayers;
    const cardW = 160;
    const spacing = 180;
    const startX = this.width / 2 - ((maxP - 1) * spacing) / 2;
    const colors = ['#eb3b47', '#38bdf8', '#ffd000', '#00c853'];

    for (let i = 0; i < maxP; i++) {
      const cx = startX + i * spacing;
      const cy = 255;
      const player = this.onlineRoom.players[i];

      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.roundRect(cx - cardW / 2, cy, cardW, 160, 16);
      ctx.fill();

      if (player) {
        ctx.strokeStyle = colors[i];
        ctx.lineWidth = 4;
        ctx.stroke();

        this.drawMiniNinja(ctx, cx, cy + 55, colors[i], 1, 0);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 18px "Lilita One", cursive';
        ctx.fillText(player.name, cx, cy + 115);

        ctx.font = '800 13px "Lilita One", cursive';
        ctx.fillStyle = colors[i];
        ctx.fillText(player.isHost ? '👑 HOST' : 'READY', cx, cy + 140);
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '900 32px "Lilita One", cursive';
        ctx.fillText('?', cx, cy + 70);

        ctx.font = '800 15px "Lilita One", cursive';
        ctx.fillText('Waiting...', cx, cy + 120);
      }
    }

    // Action button: Host starts game, guest waits
    if (networkManager.isHost) {
      const canStart = this.onlineRoom.players.length >= 2;
      const isHoverStart = this.hoveredButton === 'lobby_start_game';
      const btnBg = canStart ? '#00c853' : '#64748b';
      this.drawMenuButton(
        460,
        465,
        360,
        70,
        btnBg,
        canStart ? 'START MATCH!' : 'WAITING FOR PLAYERS...',
        '#ffffff',
        canStart && isHoverStart
      );
    } else {
      ctx.font = '900 24px "Lilita One", cursive';
      ctx.fillStyle = '#ffd000';
      const dots = '.'.repeat((Math.floor(Date.now() / 400) % 4));
      ctx.fillText(`WAITING FOR HOST TO START${dots}`, this.width / 2, 500);
    }

    ctx.restore();
    this.drawBackButton('lobby_leave');
  }

  drawBackButton(buttonId) {
    const ctx = this.ctx;
    const isHover = this.hoveredButton === buttonId;
    ctx.save();
    ctx.translate(36, 620);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.fillStyle = isHover ? 'rgba(255, 255, 255, 0.25)' : 'transparent';
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
  }

  drawTopButtons() {
    this.drawIconButton(1200, 24, 56, '#38bdf8', '🎵', soundManager.musicEnabled, this.hoveredButton === 'audio_btn');
    this.drawIconButton(1130, 24, 56, '#9381ff', '⌨', true, this.hoveredButton === 'controls_btn');
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

    ctx.fillStyle = '#151928';
    for (let off = 14; off >= 1; off--) {
      ctx.fillText('TAG', x, y + off);
    }

    ctx.lineWidth = 16;
    ctx.strokeStyle = '#151928';
    ctx.lineJoin = 'round';
    ctx.strokeText('TAG', x, y);

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

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 14);
    ctx.fill();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.beginPath();
    ctx.roundRect(0, h - 8, w, 8, [0, 0, 14, 14]);
    ctx.fill();

    ctx.font = '900 32px "Lilita One", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillText(text, w / 2, h / 2 - (subtext ? 6 : 0) + 3);

    ctx.fillStyle = textColor;
    ctx.fillText(text, w / 2, h / 2 - (subtext ? 6 : 0));

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

    this.drawMiniNinja(ctx, 350, groundY - 95, '#eb3b47', 1, 0);

    const blueJump = Math.abs(Math.sin(t * 2)) * 60;
    this.drawMiniNinja(ctx, 890, groundY - 35 - blueJump, '#38bdf8', -1, 0.1);
    if (blueJump < 10) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(890, groundY - 6, 12, Math.PI, 0);
      ctx.stroke();
    }

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

    ctx.fillStyle = headbandColor;
    ctx.fillRect(-w / 2 + 3, -10, w - 6, 9);
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 4, -8);
    ctx.quadraticCurveTo(-w / 2 - 16, -10, -w / 2 - 22, -4);
    ctx.lineTo(-w / 2 - 18, 2);
    ctx.quadraticCurveTo(-w / 2 - 10, -2, -w / 2 + 4, -3);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(2, 0, 6.5, 8.5, 0, 0, Math.PI * 2);
    ctx.ellipse(15, 0, 6.5, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#161922';
    ctx.beginPath();
    ctx.ellipse(3, 0, 3.2, 4.2, 0, 0, Math.PI * 2);
    ctx.ellipse(16, 0, 3.2, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(8.5, 9, 3.5, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    ctx.restore();
  }

  renderChooseMap() {
    const ctx = this.ctx;
    ctx.fillStyle = '#3a8bc8';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 78px "Lilita One", cursive';

    ctx.fillStyle = '#1f5380';
    ctx.fillText('ARENA SELECT', this.width / 2, 85);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('ARENA SELECT', this.width / 2, 80);
    ctx.restore();

    const isHoverForest = this.hoveredButton === 'map_forest';
    // Single Prominent Centered Official Arena Card
    drawDiorama(ctx, 'forest', 390, 135, 500, 300, isHoverForest);

    // Big Green Bouncing START MATCH Button
    const btnBob = isHoverForest ? -4 : 0;
    this.drawMenuButton(460, 460 + btnBob, 360, 72, '#00c853', '▶ START MATCH', '#ffffff', isHoverForest);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 15px "Lilita One", cursive';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText('Press SPACE, ENTER or Click to start match', this.width / 2, 546);
    ctx.restore();

    const isHoverSettings = this.hoveredButton === 'open_settings';
    this.drawOutlinedButton(400, 570, 230, 56, 'GAME SETTINGS', isHoverSettings);

    const isHoverControls = this.hoveredButton === 'controls_btn';
    this.drawOutlinedButton(650, 570, 230, 56, '⌨ CONTROLS', isHoverControls);

    this.drawBackButton('back_to_menu');
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

  renderSettingsModal() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(11, 26, 45, 0.82)';
    ctx.fillRect(0, 0, this.width, this.height);

    const modalW = 540;
    const modalH = 410;
    const modalX = (this.width - modalW) / 2;
    const modalY = (this.height - modalH) / 2 + 15;

    ctx.save();
    ctx.translate(modalX, modalY);

    ctx.fillStyle = '#f78da7';
    ctx.beginPath();
    ctx.roundRect(0, 0, modalW, modalH, 32);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.stroke();

    ctx.font = '900 44px "Lilita One", cursive';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SETTINGS', modalW / 2, 42);

    ctx.font = '900 38px "Lilita One", cursive';
    ctx.textAlign = 'left';
    ctx.fillText('PORTALS', 50, 115);
    this.drawSettingPill(ctx, 240, 88, 180, 56, '20s RANDOM', true, false);

    ctx.fillText('TIME', 50, 205);
    const timeVal = this.settings.time;
    this.drawSettingPill(ctx, 240, 178, 80, 56, '60', timeVal === 60, this.hoveredButton === 'time_60');
    this.drawSettingPill(ctx, 330, 178, 90, 56, '120', timeVal === 120, this.hoveredButton === 'time_120');
    this.drawSettingPill(ctx, 430, 178, 90, 56, '180', timeVal === 180, this.hoveredButton === 'time_180');

    ctx.font = '800 16px "Lilita One", cursive';
    ctx.textAlign = 'center';
    ctx.fillText('THE SETTINGS ARE SAVED AUTOMATICALLY', modalW / 2, 275);

    const isHoverClose = this.hoveredButton === 'close_settings';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.fillStyle = isHoverClose ? 'rgba(255, 255, 255, 0.25)' : 'transparent';
    ctx.beginPath();
    ctx.roundRect(150, 315, 240, 60, 8);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 32px "Lilita One", cursive';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('CLOSE', modalW / 2, 345);

    ctx.restore();
  }

  renderControlsModal() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(11, 26, 45, 0.88)';
    ctx.fillRect(0, 0, this.width, this.height);

    const modalW = 820;
    const modalH = 490;
    const modalX = (this.width - modalW) / 2;
    const modalY = (this.height - modalH) / 2;

    ctx.save();
    ctx.translate(modalX, modalY);

    ctx.fillStyle = '#6c5ce7';
    ctx.beginPath();
    ctx.roundRect(0, 0, modalW, modalH, 28);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.stroke();

    ctx.font = '900 42px "Lilita One", cursive';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⌨ MULTIPLAYER CONTROLS', modalW / 2, 44);

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

      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.roundRect(cx, cy, cardW, cardH, 16);
      ctx.fill();

      ctx.strokeStyle = c.color;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.roundRect(cx + 15, cy - 14, cardW - 30, 28, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 15px "Lilita One", cursive';
      ctx.fillText(c.name, cx + cardW / 2, cy);

      this.drawKeyCap(ctx, cx + cardW / 2 - 22, cy + 45, 44, 40, c.jump);
      this.drawKeyCap(ctx, cx + 18, cy + 95, 44, 40, c.left);
      this.drawKeyCap(ctx, cx + cardW / 2 - 22, cy + 95, 44, 40, c.down);
      this.drawKeyCap(ctx, cx + cardW - 62, cy + 95, 44, 40, c.right);

      ctx.font = '800 13px "Lilita One", cursive';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`▲ Jump: [${c.jump}]`, cx + cardW / 2, cy + 165);
      ctx.fillText(`◀ ▶ Move: [${c.left}][${c.right}]`, cx + cardW / 2, cy + 195);
      ctx.fillText(`▼ Drop: [${c.down}]`, cx + cardW / 2, cy + 225);
    }

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

  renderPlaying() {
    const ctx = this.ctx;

    try {
      drawMap(ctx, this.currentMap);
    } catch (e) {
      console.warn('drawMap error:', e);
    }


    try {
      for (const player of (this.players || [])) {
        player.draw(ctx, this.players);
      }
    } catch (e) {
      console.warn('player draw error:', e);
    }

    try {
      this.particles.draw(ctx);
    } catch (e) {}

    if (!this.isMatchStarted) {
      try {
        this.renderCountdownOverlay(ctx);
      } catch (e) {
        console.warn('renderCountdownOverlay error:', e);
      }
    }

    try {
      this.renderHUD(ctx);
    } catch (e) {
      console.warn('renderHUD error:', e);
    }

    if (this.toastTimer > 0 && this.toastMessage) {
      try {
        ctx.save();
        ctx.font = '900 22px "Lilita One", cursive';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const alpha = Math.min(1, this.toastTimer / 20);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
        ctx.beginPath();
        ctx.roundRect(this.width / 2 - 180, 80, 360, 44, 12);
        ctx.fill();
        ctx.strokeStyle = '#ffd000';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(this.toastMessage, this.width / 2, 102);
        ctx.restore();
      } catch (e) {}
    }

    if (this.isPaused) {
      try {
        this.renderPauseModal(ctx);
      } catch (e) {
        console.warn('renderPauseModal error:', e);
      }
    }
  }

  renderCountdownOverlay(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, this.width, this.height);

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
    ctx.fillText(this.gameMode === 'ONLINE' ? 'ONLINE MATCH STARTING!' : (this.isVsBot ? 'SOLO VS BOT MATCH!' : 'GET READY TO RUN!'), this.width / 2, this.height / 2 + 50);

    for (const p of this.players) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(p.x - 24, p.y + p.height + 14, p.width + 48, 28, 8);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 13px "Lilita One", cursive';
      ctx.fillText(`${p.name}`, p.x + p.width / 2, p.y + p.height + 28);
    }

    ctx.restore();
  }

  renderHUD(ctx) {
    ctx.save();

    // 1. Center Round Countdown Timer
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

    // 2. Dedicated Pause Button (II) in Top-Left (x: 20, y: 14, w: 52, h: 52)
    const isHoverPause = this.hoveredButton === 'pause_btn';
    this.drawPauseButton(20, 14, 52, 52, isHoverPause);

    // 3. Online Live Ping Indicator in Top-Right (Online matches only)
    if (this.gameMode === 'ONLINE') {
      this.drawPingWidget(this.width - 165, 14, 150, 52);
    }

    ctx.restore();
  }

  drawPingWidget(x, y, w = 150, h = 52) {
    const ctx = this.ctx;
    const pingVal = networkManager.ping;

    let pingColor = '#10b981'; // Green (< 60ms)
    let pingStatus = 'GOOD';
    let activeBars = 3;

    if (!pingVal) {
      pingColor = '#38bdf8'; // Sky cyan while measuring
      pingStatus = 'MEASURING...';
      activeBars = 1;
    } else if (pingVal > 120) {
      pingColor = '#ef4444'; // Red (> 120ms)
      pingStatus = 'SLOW';
      activeBars = 1;
    } else if (pingVal > 60) {
      pingColor = '#f59e0b'; // Amber (60-120ms)
      pingStatus = 'FAIR';
      activeBars = 2;
    }

    ctx.save();

    // Frosted dark glass container
    ctx.fillStyle = 'rgba(10, 24, 48, 0.75)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();

    // Glowing border matching connection status
    ctx.strokeStyle = pingColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = pingColor;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Graduated 3-bar signal icon with pulsing effect
    const barBaseX = x + 16;
    const barBottomY = y + h - 14;
    const barW = 4;
    const barSpacing = 7;
    const barHeights = [9, 15, 21];

    for (let i = 0; i < 3; i++) {
      const bh = barHeights[i];
      const bx = barBaseX + i * barSpacing;
      const by = barBottomY - bh;
      const isLit = i < activeBars;

      ctx.fillStyle = isLit ? pingColor : 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.roundRect(bx, by, barW, bh, 2);
      ctx.fill();
    }

    // Ping in milliseconds (e.g. "32 ms")
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 16px "Lilita One", cursive';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(pingVal ? `${pingVal} ms` : 'PING...', x + 44, y + 18);

    // Status label (e.g. "PING: GOOD")
    ctx.fillStyle = pingColor;
    ctx.font = '800 11px "Lilita One", cursive';
    ctx.fillText(pingVal ? `PING: ${pingStatus}` : 'ONLINE', x + 44, y + 34);

    ctx.restore();
  }

  drawPauseButton(x, y, w, h, isHovered) {
    const ctx = this.ctx;
    ctx.save();

    // Frosted glass background
    ctx.fillStyle = isHovered ? 'rgba(56, 189, 248, 0.45)' : 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();

    // Border with neon blue glow on hover
    ctx.strokeStyle = isHovered ? '#38bdf8' : 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = isHovered ? 3 : 2.5;
    if (isHovered) {
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw two crisp, rounded vertical pause bars (❚ ❚)
    ctx.fillStyle = '#ffffff';
    const barWidth = 6;
    const barHeight = 22;
    const gap = 8;
    const centerX = x + w / 2;
    const centerY = y + h / 2;

    // Left bar
    ctx.beginPath();
    ctx.roundRect(centerX - gap / 2 - barWidth, centerY - barHeight / 2, barWidth, barHeight, 3);
    ctx.fill();

    // Right bar
    ctx.beginPath();
    ctx.roundRect(centerX + gap / 2, centerY - barHeight / 2, barWidth, barHeight, 3);
    ctx.fill();

    ctx.restore();
  }

  renderPauseModal(ctx) {
    ctx.save();

    // 1. Deep blue atmospheric backdrop tint
    ctx.fillStyle = 'rgba(10, 32, 70, 0.65)';
    ctx.fillRect(0, 0, this.width, this.height);

    const cardW = 440;
    const cardH = 370;
    const cardX = (this.width - cardW) / 2; // 420
    const cardY = 220;

    // 2. Cute Cartoon Green Leaves sprouting from behind the card edges
    this.drawCuteLeaf(ctx, cardX + 6, cardY + 80, 44, 22, -Math.PI / 3, '#00e676');
    this.drawCuteLeaf(ctx, cardX + 2, cardY + 150, 48, 24, -Math.PI / 2.2, '#00c853');
    this.drawCuteLeaf(ctx, cardX + 6, cardY + 220, 40, 20, -Math.PI / 1.5, '#00e676');

    this.drawCuteLeaf(ctx, cardX + cardW - 6, cardY + 150, 46, 23, Math.PI / 2.4, '#00e676');
    this.drawCuteLeaf(ctx, cardX + cardW - 2, cardY + 220, 42, 21, Math.PI / 1.6, '#00c853');

    // 3. Frosted Glass Card
    ctx.save();
    ctx.shadowColor = 'rgba(56, 189, 248, 0.45)';
    ctx.shadowBlur = 26;
    ctx.fillStyle = 'rgba(18, 55, 115, 0.62)';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 36);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Glass gradient reflection
    const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    cardGrad.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
    cardGrad.addColorStop(0.35, 'rgba(56, 189, 248, 0.10)');
    cardGrad.addColorStop(1, 'rgba(10, 30, 75, 0.45)');
    ctx.fillStyle = cardGrad;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 36);
    ctx.fill();

    // Soft glowing border
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.75)';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();

    // 4. Three 3D Candy Buttons
    const btnW = 340;
    const btnH = 64;
    const btnX = (this.width - btnW) / 2; // 470

    // RESUME Button
    this.drawCandyButton(
      ctx,
      btnX,
      275,
      btnW,
      btnH,
      'play',
      'RESUME',
      {
        faceTop: '#00f589',
        faceBottom: '#00c853',
        shadow: '#00873a'
      },
      this.hoveredButton === 'pause_resume'
    );

    // SETTINGS Button
    this.drawCandyButton(
      ctx,
      btnX,
      360,
      btnW,
      btnH,
      'settings',
      'SETTINGS',
      {
        faceTop: '#29b6f6',
        faceBottom: '#0288d1',
        shadow: '#01579b'
      },
      this.hoveredButton === 'pause_settings'
    );

    // EXIT Button
    this.drawCandyButton(
      ctx,
      btnX,
      445,
      btnW,
      btnH,
      'exit',
      'EXIT',
      {
        faceTop: '#ff3b77',
        faceBottom: '#e6005c',
        shadow: '#99003d'
      },
      this.hoveredButton === 'pause_exit'
    );

    // 5. Colorful Sprinkles around PAUSE
    // Left Sprinkles
    this.drawPauseSprinkle(ctx, 434, 154, 11, 28, -0.65, '#ff2a6d'); // Pink
    this.drawPauseSprinkle(ctx, 424, 194, 10, 22, -0.15, '#38bdf8'); // Cyan
    this.drawPauseSprinkle(ctx, 442, 228, 10, 22, 0.55, '#ffd000'); // Yellow

    // Right Sprinkles
    this.drawPauseSprinkle(ctx, 846, 158, 11, 28, 0.65, '#ff2a6d'); // Pink
    this.drawPauseSprinkle(ctx, 856, 194, 10, 22, 0.15, '#ffd000'); // Yellow

    // 6. Bubbly 3D Cartoon "PAUSE" Title
    this.drawPauseTitle(ctx, this.width / 2, 195);

    ctx.restore();
  }

  drawCuteLeaf(ctx, x, y, length, width, angle, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Leaf body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-width * 0.6, -length * 0.4, -width * 0.65, -length * 0.8, 0, -length);
    ctx.bezierCurveTo(width * 0.65, -length * 0.8, width * 0.6, -length * 0.4, 0, 0);
    ctx.fill();

    // Leaf center vein shine
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -length * 0.25);
    ctx.lineTo(0, -length * 0.75);
    ctx.stroke();

    ctx.restore();
  }

  drawPauseSprinkle(ctx, cx, cy, w, h, angle, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, w / 2);
    ctx.fill();

    // Subtle highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h * 0.45, w / 2);
    ctx.fill();
    ctx.restore();
  }

  drawPauseTitle(ctx, cx, cy) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 90px "Lilita One", cursive';

    const text = 'PAUSE';

    // Layer 1: Dark Navy drop shadow
    ctx.fillStyle = '#081736';
    ctx.strokeStyle = '#081736';
    ctx.lineWidth = 24;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, cx, cy + 12);
    ctx.fillText(text, cx, cy + 12);

    // Layer 2: Vibrant magenta/purple 3D extrusion
    ctx.fillStyle = '#c026d3';
    ctx.strokeStyle = '#c026d3';
    ctx.lineWidth = 18;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, cx, cy + 6);
    ctx.fillText(text, cx, cy + 6);

    // Layer 3: Dark blue/navy outline
    ctx.strokeStyle = '#0c2247';
    ctx.lineWidth = 14;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, cx, cy);

    // Layer 4: Gradient face (white at top to light ice-cyan at bottom)
    const grad = ctx.createLinearGradient(cx, cy - 45, cx, cy + 30);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, '#f0f9ff');
    grad.addColorStop(0.7, '#bae6fd');
    grad.addColorStop(1, '#7dd3fc');
    ctx.fillStyle = grad;
    ctx.fillText(text, cx, cy);

    // Layer 5: Inner white shine stroke
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2.5;
    ctx.strokeText(text, cx, cy);

    ctx.restore();
  }

  drawCandyButton(ctx, x, y, w, h, iconType, text, colors, isHovered) {
    ctx.save();

    const yOffset = isHovered ? -2 : 0;
    const currentY = y + yOffset;

    // 1. Bottom 3D Bevel / Shadow
    ctx.fillStyle = colors.shadow;
    ctx.beginPath();
    ctx.roundRect(x, y + 8, w, h - 2, 32);
    ctx.fill();

    // 2. Button Face Gradient
    const faceGrad = ctx.createLinearGradient(x, currentY, x, currentY + h);
    faceGrad.addColorStop(0, colors.faceTop);
    faceGrad.addColorStop(1, colors.faceBottom);
    ctx.fillStyle = faceGrad;
    ctx.beginPath();
    ctx.roundRect(x, currentY, w, h, 32);
    ctx.fill();

    // 3. Subtle white rim border
    ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = isHovered ? 2.5 : 1.8;
    ctx.stroke();

    // 4. Glossy Top Bubble Highlight
    const hlGrad = ctx.createLinearGradient(x, currentY + 3, x, currentY + 22);
    hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
    ctx.fillStyle = hlGrad;
    ctx.beginPath();
    ctx.roundRect(x + 16, currentY + 4, w - 32, 20, 10);
    ctx.fill();

    // 5. Measure text and icon to center them as a group
    ctx.font = '900 28px "Lilita One", cursive';
    const textWidth = ctx.measureText(text).width;
    const iconWidth = 26;
    const gap = 16;
    const totalGroupW = iconWidth + gap + textWidth;
    const startX = x + (w - totalGroupW) / 2;
    const centerY = currentY + h / 2;

    // Draw Icon
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    const iconCenterX = startX + iconWidth / 2;

    if (iconType === 'play') {
      // Rounded Play triangle
      ctx.beginPath();
      ctx.moveTo(iconCenterX - 9, centerY - 13);
      ctx.lineTo(iconCenterX + 12, centerY);
      ctx.lineTo(iconCenterX - 9, centerY + 13);
      ctx.closePath();
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fill();
    } else if (iconType === 'settings') {
      // Clean Cog / Gear
      const teeth = 8;
      const outerR = 13;
      const innerR = 9.5;
      ctx.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = (i * Math.PI) / teeth;
        const px = iconCenterX + Math.cos(a) * r;
        const py = centerY + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      // Cog center hole
      ctx.fillStyle = colors.faceBottom;
      ctx.beginPath();
      ctx.arc(iconCenterX, centerY, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (iconType === 'exit') {
      // Exit door with arrow
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Door frame
      ctx.beginPath();
      ctx.moveTo(iconCenterX + 3, centerY - 12);
      ctx.lineTo(iconCenterX - 11, centerY - 12);
      ctx.lineTo(iconCenterX - 11, centerY + 12);
      ctx.lineTo(iconCenterX + 3, centerY + 12);
      ctx.stroke();

      // Arrow pointing right
      ctx.beginPath();
      ctx.moveTo(iconCenterX - 5, centerY);
      ctx.lineTo(iconCenterX + 11, centerY);
      ctx.moveTo(iconCenterX + 6, centerY - 5);
      ctx.lineTo(iconCenterX + 11, centerY);
      ctx.lineTo(iconCenterX + 6, centerY + 5);
      ctx.stroke();
    }
    ctx.restore();

    // Draw Text
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';

    // Text shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.fillText(text, startX + iconWidth + gap, centerY + 1);

    ctx.restore();
  }

  renderGameOverModal() {
    const ctx = this.ctx;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.textAlign = 'center';

    ctx.font = '900 86px "Lilita One", cursive';
    ctx.fillStyle = '#ffd000';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 12;
    ctx.strokeText("TIME'S UP!", this.width / 2, 160);
    ctx.fillText("TIME'S UP!", this.width / 2, 160);

    const loser = this.players.find(p => p.id === this.loserId);
    if (loser) {
      ctx.font = '900 34px "Lilita One", cursive';
      ctx.fillStyle = '#ff4d6d';
      ctx.fillText(`${loser.name} WAS CAUGHT!`, this.width / 2, 225);
    }

    ctx.font = '900 36px "Lilita One", cursive';
    ctx.fillStyle = '#00e676';
    const winnerNames = this.winners.map(w => w.name).join(', ');
    ctx.fillText(`🎉 WINNERS: ${winnerNames}! 🎉`, this.width / 2, 305);

    for (let i = 0; i < this.winners.length; i++) {
      const w = this.winners[i];
      const spacing = 110;
      const startX = this.width / 2 - ((this.winners.length - 1) * spacing) / 2;
      const wx = startX + i * spacing;
      const bounce = Math.abs(Math.sin(Date.now() / 200 + i)) * 25;
      this.drawMiniNinja(ctx, wx, 420 - bounce, w.color, 1, 0);
    }

    const isHoverPlay = this.hoveredButton === 'play_again';
    this.drawMenuButton(420, 530, 200, 58, '#00c853', 'PLAY AGAIN', '#ffffff', isHoverPlay);

    const isHoverMap = this.hoveredButton === 'change_map';
    this.drawMenuButton(660, 530, 200, 58, '#38bdf8', 'MENU', '#ffffff', isHoverMap);

    ctx.restore();
  }
}
