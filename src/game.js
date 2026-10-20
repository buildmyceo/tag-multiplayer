// Central Game Engine for Tag Multiplayer - Supports Local 1-Keyboard & Online Multiplayer

import { soundManager } from './audio.js';
import { ParticleSystem } from './particles.js';
import { Player } from './player.js';
import { MAPS, drawMap, drawDiorama } from './maps.js';
import { networkManager } from './network.js';

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
      buffs: localStorage.getItem('tag_buffs') !== 'false',
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

    // Buff orbs in arena
    this.buffOrbs = [];
    this.buffSpawnTimer = 0;

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

    // Winner info
    this.loserId = null;
    this.winners = [];

    this.initEventListeners();
    this.initNetworkListeners();
    this.checkUrlDeepLink();
  }

  initEventListeners() {
    window.addEventListener('keydown', e => {
      this.keys.add(e.key);
      this.keys.add(e.code);
      this.keys.add(e.key.toLowerCase());
      soundManager.init();

      if (e.key === 'Escape') {
        if (this.state === GAME_STATES.SETTINGS || this.state === GAME_STATES.CONTROLS_MODAL) {
          this.state = this.previousState;
        } else if (this.state === GAME_STATES.PLAYING && this.gameMode === 'LOCAL') {
          this.state = GAME_STATES.CHOOSE_MAP;
        } else if (this.state === GAME_STATES.ONLINE_MENU || this.state === GAME_STATES.ONLINE_CREATE) {
          this.state = GAME_STATES.MENU;
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
      setTimeout(() => { this.onlineErrorMessage = ''; }, 4000);
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

    networkManager.on('buffSync', (data) => {
      if (this.state !== GAME_STATES.PLAYING) return;
      const targetP = this.players.find(p => p.id === data.playerId);
      if (targetP) {
        targetP.buff = data.buffType;
        targetP.buffTimer = 360;
      }
      this.buffOrbs = this.buffOrbs.filter(o => o.id !== data.orbId);
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
    localStorage.setItem('tag_buffs', this.settings.buffs);
    localStorage.setItem('tag_time', this.settings.time);
    localStorage.setItem('tag_player_name', this.settings.playerName);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  // Start 1-Keyboard Local Match
  startLocalMatch(mapKey, playerCount) {
    this.gameMode = 'LOCAL';
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
      const player = new Player(cfg.id, cfg.color, cfg.name, cfg.label, spawn.x, spawn.y, cfg.controls, false);
      this.players.push(player);
    }

    const itIndex = Math.floor(Math.random() * playerCount);
    this.players[itIndex].tag();

    this.state = GAME_STATES.PLAYING;
    soundManager.playCountdown();
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
    this.buffOrbs = [];
    this.buffSpawnTimer = 0;
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
      this.settings.buffs
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
      // Top buttons
      if (mx >= 1200 && mx <= 1256 && my >= 24 && my <= 80) this.hoveredButton = 'audio_btn';
      if (mx >= 1130 && mx <= 1186 && my >= 24 && my <= 80) this.hoveredButton = 'controls_btn';
      if (mx >= 1060 && mx <= 1116 && my >= 24 && my <= 80) this.hoveredButton = 'fullscreen_btn';

      // Local Player Buttons
      if (mx >= 460 && mx <= 820 && my >= 220 && my <= 286) this.hoveredButton = '2_players';
      if (mx >= 460 && mx <= 820 && my >= 300 && my <= 366) this.hoveredButton = '3_players';
      if (mx >= 460 && mx <= 820 && my >= 380 && my <= 446) this.hoveredButton = '4_players';

      // 🌐 PLAY ONLINE Button
      if (mx >= 460 && mx <= 820 && my >= 460 && my <= 526) this.hoveredButton = 'play_online';
    } else if (this.state === GAME_STATES.ONLINE_MENU) {
      if (mx >= 380 && mx <= 900 && my >= 220 && my <= 300) this.hoveredButton = 'online_create';
      if (mx >= 380 && mx <= 900 && my >= 330 && my <= 410) this.hoveredButton = 'online_join';
      if (mx >= 36 && mx <= 100 && my >= 620 && my <= 684) this.hoveredButton = 'back_to_menu';
    } else if (this.state === GAME_STATES.ONLINE_CREATE) {
      // Choose Players: 2, 3, 4
      if (mx >= 420 && mx <= 520 && my >= 220 && my <= 280) this.hoveredButton = 'create_2p';
      if (mx >= 540 && mx <= 640 && my >= 220 && my <= 280) this.hoveredButton = 'create_3p';
      if (mx >= 660 && mx <= 760 && my >= 220 && my <= 280) this.hoveredButton = 'create_4p';

      // Choose Map: Forest, Winter, Desert
      if (mx >= 350 && mx <= 490 && my >= 330 && my <= 390) this.hoveredButton = 'create_map_forest';
      if (mx >= 510 && mx <= 650 && my >= 330 && my <= 390) this.hoveredButton = 'create_map_winter';
      if (mx >= 670 && mx <= 810 && my >= 330 && my <= 390) this.hoveredButton = 'create_map_desert';

      // CREATE ROOM Button
      if (mx >= 460 && mx <= 760 && my >= 440 && my <= 510) this.hoveredButton = 'submit_create_room';
      if (mx >= 36 && mx <= 100 && my >= 620 && my <= 684) this.hoveredButton = 'back_to_online_menu';
    } else if (this.state === GAME_STATES.ONLINE_LOBBY) {
      // Start Game (Host only)
      if (mx >= 460 && mx <= 820 && my >= 460 && my <= 530) this.hoveredButton = 'lobby_start_game';
      if (mx >= 36 && mx <= 100 && my >= 620 && my <= 684) this.hoveredButton = 'lobby_leave';
      if (mx >= 460 && mx <= 820 && my >= 550 && my <= 600) this.hoveredButton = 'copy_room_link';
    } else if (this.state === GAME_STATES.CHOOSE_MAP) {
      if (mx >= 125 && mx <= 435 && my >= 185 && my <= 475) this.hoveredButton = 'map_forest';
      if (mx >= 485 && mx <= 795 && my >= 185 && my <= 475) this.hoveredButton = 'map_winter';
      if (mx >= 845 && mx <= 1155 && my >= 185 && my <= 475) this.hoveredButton = 'map_desert';
      if (mx >= 400 && mx <= 630 && my >= 570 && my <= 626) this.hoveredButton = 'open_settings';
      if (mx >= 650 && mx <= 880 && my >= 570 && my <= 626) this.hoveredButton = 'controls_btn';
      if (mx >= 36 && mx <= 100 && my >= 620 && my <= 684) this.hoveredButton = 'back_to_menu';
    } else if (this.state === GAME_STATES.SETTINGS) {
      if (mx >= 600 && mx <= 690 && my >= 220 && my <= 276) this.hoveredButton = 'buffs_on';
      if (mx >= 710 && mx <= 800 && my >= 220 && my <= 276) this.hoveredButton = 'buffs_off';
      if (mx >= 600 && mx <= 675 && my >= 310 && my <= 366) this.hoveredButton = 'time_60';
      if (mx >= 690 && mx <= 775 && my >= 310 && my <= 366) this.hoveredButton = 'time_120';
      if (mx >= 790 && mx <= 875 && my >= 310 && my <= 366) this.hoveredButton = 'time_180';
      if (mx >= 520 && mx <= 760 && my >= 450 && my <= 510) this.hoveredButton = 'close_settings';
    } else if (this.state === GAME_STATES.CONTROLS_MODAL) {
      if (mx >= 520 && mx <= 760 && my >= 520 && my <= 580) this.hoveredButton = 'close_controls';
    } else if (this.state === GAME_STATES.PLAYING) {
      if (mx >= 20 && mx <= 130 && my >= 18 && my <= 64) this.hoveredButton = 'ingame_menu';
      if (mx >= 145 && mx <= 255 && my >= 18 && my <= 64) this.hoveredButton = 'ingame_controls';
      if (mx >= 1205 && mx <= 1260 && my >= 18 && my <= 68) this.hoveredButton = 'audio_btn';
    } else if (this.state === GAME_STATES.GAME_OVER) {
      if (mx >= 420 && mx <= 620 && my >= 530 && my <= 588) this.hoveredButton = 'play_again';
      if (mx >= 660 && mx <= 860 && my >= 530 && my <= 588) this.hoveredButton = 'change_map';
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
      } else if (this.hoveredButton === 'back_to_menu') {
        this.state = GAME_STATES.MENU;
      }
    } else if (this.state === GAME_STATES.ONLINE_CREATE) {
      if (this.hoveredButton === 'create_2p') this.tempOnlinePlayers = 2;
      if (this.hoveredButton === 'create_3p') this.tempOnlinePlayers = 3;
      if (this.hoveredButton === 'create_4p') this.tempOnlinePlayers = 4;
      if (this.hoveredButton === 'create_map_forest') this.tempOnlineMap = 'forest';
      if (this.hoveredButton === 'create_map_winter') this.tempOnlineMap = 'winter';
      if (this.hoveredButton === 'create_map_desert') this.tempOnlineMap = 'desert';

      if (this.hoveredButton === 'submit_create_room') {
        this.createOnlineRoom(this.tempOnlinePlayers || 2, this.tempOnlineMap || 'forest');
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
      if (this.hoveredButton === 'map_forest') {
        this.startLocalMatch('forest', this.playerCount);
      } else if (this.hoveredButton === 'map_winter') {
        this.startLocalMatch('winter', this.playerCount);
      } else if (this.hoveredButton === 'map_desert') {
        this.startLocalMatch('desert', this.playerCount);
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
        this.state = this.previousState;
      }
    } else if (this.state === GAME_STATES.CONTROLS_MODAL) {
      if (this.hoveredButton === 'close_controls') {
        this.state = this.previousState;
      }
    } else if (this.state === GAME_STATES.PLAYING) {
      if (this.hoveredButton === 'ingame_menu') {
        if (this.gameMode === 'ONLINE') {
          networkManager.disconnect();
          this.state = GAME_STATES.ONLINE_MENU;
        } else {
          this.state = GAME_STATES.CHOOSE_MAP;
        }
      }
    } else if (this.state === GAME_STATES.GAME_OVER) {
      if (this.hoveredButton === 'play_again') {
        if (this.gameMode === 'ONLINE') {
          networkManager.restartMatch();
        } else {
          this.startLocalMatch(this.currentMapKey, this.playerCount);
        }
      } else if (this.hoveredButton === 'change_map') {
        if (this.gameMode === 'ONLINE') {
          networkManager.disconnect();
          this.state = GAME_STATES.ONLINE_MENU;
        } else {
          this.state = GAME_STATES.CHOOSE_MAP;
        }
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

    // Tag Collision Check
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

          if (dist < 40) {
            itPlayer.passTag();
            target.tag();

            soundManager.playTag();
            this.screenShake = 14;

            const tagX = (itPlayer.x + target.x) / 2 + 23;
            const tagY = (itPlayer.y + target.y) / 2 + 23;
            this.particles.createTagBurst(tagX, tagY);

            if (this.gameMode === 'ONLINE') {
              networkManager.sendTagEvent(itPlayer.id, target.id, tagX, tagY);
            }
            break;
          }
        }
      }
    }

    // Buff Spawning Logic (Host in online mode or Local)
    const canSpawnBuffs = (this.gameMode === 'LOCAL') || (this.gameMode === 'ONLINE' && networkManager.isHost);
    if (this.settings.buffs && canSpawnBuffs) {
      this.buffSpawnTimer++;
      if (this.buffSpawnTimer > 380 && this.buffOrbs.length < 3) {
        this.spawnBuffOrb();
        this.buffSpawnTimer = 0;
      }
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
          p.buffTimer = 360;
          this.buffOrbs.splice(i, 1);
          if (this.gameMode === 'ONLINE') {
            networkManager.sendBuffCollect(orb.id, p.id, orb.type);
          }
          break;
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
      id: Math.random().toString(36).substr(2, 9),
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

    this.particles.createConfetti(this.width / 2, 220, 110);
    this.particles.createConfetti(this.width / 4, 300, 70);
    this.particles.createConfetti((3 * this.width) / 4, 300, 70);
  }

  render() {
    const ctx = this.ctx;
    ctx.save();

    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
    }

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

    ctx.restore();
  }

  renderMenu() {
    const ctx = this.ctx;

    // 1. Sky Background
    ctx.fillStyle = '#3ea5e6';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#62b6eb';
    ctx.globalAlpha = 0.55;
    for (let x = 60; x < this.width; x += 180) {
      ctx.fillRect(x, 140, 64, 520);
      ctx.fillRect(x - 12, 120, 88, 20);
      ctx.fillRect(x - 20, 105, 104, 15);
    }
    ctx.globalAlpha = 1.0;

    // 2. Pink Ground & Scalloped Grass
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
    ctx.fillStyle = '#9b1d60';
    ctx.fillRect(100, groundY - 140, 32, 140);
    ctx.fillStyle = '#00e676';
    ctx.beginPath();
    ctx.roundRect(46, groundY - 235, 138, 115, 28);
    ctx.fill();

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

    this.drawSimpleFlower(200, groundY - 6, '#ffd000');
    this.drawSimpleFlower(420, groundY - 6, '#eb3b5a');
    this.drawSimpleFlower(900, groundY - 6, '#ffd000');
    this.drawSimpleFlower(1200, groundY - 6, '#eb3b5a');

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

    // 5. Menu Buttons:
    // 2 PLAYERS (Red)
    const isHover2 = this.hoveredButton === '2_players';
    this.drawMenuButton(460, 220, 360, 66, '#e83a48', '2 PLAYERS', '#ffffff', isHover2, '1-Keyboard');

    // 3 PLAYERS (Yellow)
    const isHover3 = this.hoveredButton === '3_players';
    this.drawMenuButton(460, 300, 360, 66, '#ffd000', '3 PLAYERS', '#6a0dad', isHover3, '1-Keyboard');

    // 4 PLAYERS (Green)
    const isHover4 = this.hoveredButton === '4_players';
    this.drawMenuButton(460, 380, 360, 66, '#00c853', '4 PLAYERS', '#ffffff', isHover4, '1-Keyboard');

    // 🌐 PLAY ONLINE (Cyan / Blue Gradient)
    const isHoverOnline = this.hoveredButton === 'play_online';
    this.drawMenuButton(460, 460, 360, 66, '#06d6a0', '🌐 PLAY ONLINE', '#ffffff', isHoverOnline, 'Multi-Device Rooms');

    // Network Status Note
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 13px "Lilita One", cursive';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ Play together across phones, tablets & PCs', 640, 550);

    // 6. Huge 3D Cartoon Title: "TAG"
    const floatY = Math.sin(this.menuAnimTime * 1.5) * 6;
    this.drawTitleTAG(640, 118 + floatY);

    // 7. Top-Right Action Buttons
    this.drawTopButtons();

    // 8. Animated Little Ninjas
    this.renderMenuNinjas(groundY);

    this.particles.draw(ctx);
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
    ctx.fillText(`Share with friends on the same Wi-Fi: http://${window.location.hostname}:5173`, this.width / 2, 155);

    // Error Message Banner (if any)
    if (this.onlineErrorMessage) {
      ctx.fillStyle = '#ff1744';
      ctx.beginPath();
      ctx.roundRect(this.width / 2 - 250, 175, 500, 36, 18);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 16px "Lilita One", cursive';
      ctx.fillText(this.onlineErrorMessage, this.width / 2, 193);
    }
    ctx.restore();

    // 2 Big Choice Cards:
    // 1. CREATE A ROOM
    const isHoverCreate = this.hoveredButton === 'online_create';
    this.drawMenuButton(380, 230, 520, 85, '#00c853', '➕ CREATE A ROOM', '#ffffff', isHoverCreate, 'Host a match for 2 to 4 players');

    // 2. JOIN WITH CODE
    const isHoverJoin = this.hoveredButton === 'online_join';
    this.drawMenuButton(380, 345, 520, 85, '#38bdf8', '🔑 JOIN WITH ROOM CODE', '#ffffff', isHoverJoin, 'Enter a 4-letter room code or link');

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
    ctx.fillText('SELECT ARENA MAP:', this.width / 2, 315);
    const selMap = this.tempOnlineMap || 'forest';
    this.drawSettingPill(ctx, 350, 340, 140, 56, 'FOREST', selMap === 'forest', this.hoveredButton === 'create_map_forest');
    this.drawSettingPill(ctx, 510, 340, 140, 56, 'WINTER', selMap === 'winter', this.hoveredButton === 'create_map_winter');
    this.drawSettingPill(ctx, 670, 340, 140, 56, 'DESERT', selMap === 'desert', this.hoveredButton === 'create_map_desert');

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

    if (!this.onlineRoom) return;

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
    ctx.font = '900 86px "Lilita One", cursive';

    ctx.fillStyle = '#1f5380';
    ctx.fillText('CHOOSE MAP', this.width / 2, 105);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('CHOOSE MAP', this.width / 2, 100);
    ctx.restore();

    const isHoverForest = this.hoveredButton === 'map_forest';
    drawDiorama(ctx, 'forest', 125, 195, 310, 260, isHoverForest);

    const isHoverWinter = this.hoveredButton === 'map_winter';
    drawDiorama(ctx, 'winter', 485, 195, 310, 260, isHoverWinter);

    const isHoverDesert = this.hoveredButton === 'map_desert';
    drawDiorama(ctx, 'desert', 845, 195, 310, 260, isHoverDesert);

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
    ctx.fillText('BUFFS', 50, 115);

    const buffsOn = this.settings.buffs;
    this.drawSettingPill(ctx, 240, 88, 90, 56, 'ON', buffsOn, this.hoveredButton === 'buffs_on');
    this.drawSettingPill(ctx, 350, 88, 90, 56, 'OFF', !buffsOn, this.hoveredButton === 'buffs_off');

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

    drawMap(ctx, this.currentMap);

    for (const orb of this.buffOrbs) {
      this.drawBuffOrb(ctx, orb);
    }

    for (const player of this.players) {
      player.draw(ctx, this.players);
    }

    this.particles.draw(ctx);
    this.renderHUD(ctx);

    if (!this.isMatchStarted) {
      this.renderCountdownOverlay(ctx);
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
    ctx.fillText(this.gameMode === 'ONLINE' ? 'ONLINE MATCH STARTING!' : 'GET READY TO RUN!', this.width / 2, this.height / 2 + 50);

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

    const isHoverMenu = this.hoveredButton === 'ingame_menu';
    this.drawHudButton(20, 16, 110, 48, '◀ MENU', isHoverMenu);

    const isHoverControls = this.hoveredButton === 'ingame_controls';
    this.drawHudButton(140, 16, 110, 48, '⌨ KEYS', isHoverControls);

    // Player Status Cards
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

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 13px "Lilita One", cursive';
      ctx.textAlign = 'center';
      ctx.fillText(`P${p.id} ${p.isIt ? '🔥 IT!' : 'RUN!'}`, cardX + 57, cardY + 18);

      ctx.font = '800 11px "Lilita One", cursive';
      ctx.fillStyle = p.isIt ? '#ffebee' : p.color;
      ctx.fillText(`[${p.label}]`, cardX + 57, cardY + 36);
    }

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
