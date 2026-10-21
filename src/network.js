// WebSocket Realtime Network Client for Tag Online Multiplayer
// Includes auto-detection for deployed cloud hosts, multi-candidate fallback, and live ping measurement

export class NetworkManager {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.roomCode = null;
    this.isHost = false;
    this.myPlayerId = null;
    this.myPlayerIndex = 0;
    this.myColor = '#eb3b47';
    this.roomData = null;

    // Realtime Ping measurement
    this.ping = 0;
    this.lastPingSent = 0;
    this.pingInterval = null;

    // Event listeners
    this.callbacks = {};
  }

  on(event, cb) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(cb);
  }

  emit(event, data) {
    if (this.callbacks[event]) {
      for (const cb of this.callbacks[event]) {
        try {
          cb(data);
        } catch (e) {
          console.warn('[Network callback error]:', e);
        }
      }
    }
  }

  getServerUrl() {
    return localStorage.getItem('tag_server_url') || '';
  }

  setServerUrl(url) {
    if (url) {
      localStorage.setItem('tag_server_url', url.trim());
    } else {
      localStorage.removeItem('tag_server_url');
    }
  }

  // Get ordered list of candidate URLs to attempt
  getCandidateUrls() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

    const candidates = [];

    // 1. Explicit query parameter ?server=...
    const urlParams = new URLSearchParams(window.location.search);
    const paramUrl = urlParams.get('server');
    if (paramUrl) {
      candidates.push(paramUrl.startsWith('ws') ? paramUrl : `${protocol}//${paramUrl}`);
    }

    // 2. User-configured saved custom server URL
    const saved = localStorage.getItem('tag_server_url');
    if (saved) {
      candidates.push(saved.startsWith('ws') ? saved : `${protocol}//${saved}`);
    }

    // 3. Bundled env variable
    const envUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WS_URL) || window.__TAG_WS_URL__;
    if (envUrl) {
      candidates.push(envUrl.startsWith('ws') ? envUrl : `${protocol}//${envUrl}`);
    }

    if (isLocal) {
      // Local development:
      // Vite proxy path first
      candidates.push(`${protocol}//${host}/ws`);
      // Direct backend port 3001 fallback
      candidates.push(`${protocol}//${hostname}:3001`);
    } else {
      // Production deployment:
      // Direct same-origin WebSocket (for all-in-one deploy on Render/Railway/VPS)
      candidates.push(`${protocol}//${host}`);
      candidates.push(`${protocol}//${host}/ws`);
    }

    // Return unique non-empty candidates
    return [...new Set(candidates.filter(Boolean))];
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN)) {
      return Promise.resolve();
    }
    if (this.isConnecting && this.connectPromise) {
      return this.connectPromise;
    }

    this.isConnecting = true;
    const candidates = this.getCandidateUrls();

    this.connectPromise = new Promise(async (resolve, reject) => {
      let lastError = null;

      for (const url of candidates) {
        try {
          await this.attemptConnection(url);
          this.isConnecting = false;
          this.isConnected = true;
          this.startPing();
          this.emit('connected');
          resolve();
          return;
        } catch (err) {
          lastError = err;
        }
      }

      this.isConnecting = false;
      this.isConnected = false;
      const errMsg = 'Could not connect to multiplayer server. Please verify your connection or check Server URL.';
      this.emit('error', errMsg);
      reject(new Error(errMsg));
    });

    return this.connectPromise;
  }

  attemptConnection(url) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let socket = null;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          try { socket?.close(); } catch (e) {}
          reject(new Error(`Connection timeout to ${url}`));
        }
      }, 4000);

      try {
        socket = new WebSocket(url);
      } catch (e) {
        clearTimeout(timer);
        settled = true;
        reject(e);
        return;
      }

      socket.onopen = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          this.ws = socket;
          this.attachSocketHandlers(socket);
          resolve();
        }
      };

      socket.onerror = (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      };
    });
  }

  attachSocketHandlers(socket) {
    socket.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    socket.onclose = () => {
      this.isConnected = false;
      this.stopPing();
      this.emit('disconnected');
    };

    socket.onerror = (err) => {
      console.warn('[TAG WebSocket Error]:', err);
    };
  }

  // --- Realtime Ping Measurement ---
  startPing() {
    this.stopPing();
    this.sendPing();
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, 1500);
  }

  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  sendPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.lastPingSent = Date.now();
      this.send({ type: 'PING', timestamp: this.lastPingSent });
    }
  }

  handleMessage(dataStr) {
    try {
      const msg = JSON.parse(dataStr);

      switch (msg.type) {
        // Latency Pong response
        case 'PONG': {
          const now = Date.now();
          const rtt = Math.max(1, now - (msg.timestamp || now));
          this.ping = this.ping ? Math.round(this.ping * 0.35 + rtt * 0.65) : rtt;
          this.emit('ping', this.ping);
          break;
        }

        case 'ROOM_CREATED':
          this.roomCode = msg.roomCode;
          this.isHost = true;
          this.myPlayerId = msg.playerId;
          this.myPlayerIndex = msg.playerIndex;
          this.myColor = msg.color;
          this.roomData = msg.room;
          this.emit('roomCreated', msg);
          break;

        case 'JOIN_SUCCESS':
          this.roomCode = msg.roomCode;
          this.isHost = false;
          this.myPlayerId = msg.playerId;
          this.myPlayerIndex = msg.playerIndex;
          this.myColor = msg.color;
          this.roomData = msg.room;
          this.emit('joinSuccess', msg);
          break;

        case 'JOIN_ERROR':
          this.emit('joinError', msg.message);
          break;

        case 'PLAYER_JOINED':
          this.roomData = msg.room;
          this.emit('playerJoined', msg.room);
          break;

        case 'PLAYER_LEFT':
          this.roomData = msg.room;
          this.emit('playerLeft', msg.room);
          break;

        case 'GAME_STARTED':
          this.emit('gameStarted', msg);
          break;

        case 'REMOTE_PLAYER_SYNC':
          this.emit('remotePlayerSync', msg);
          break;

        case 'TAG_SYNC':
          this.emit('tagSync', msg);
          break;

        case 'BUFF_SYNC':
          this.emit('buffSync', msg);
          break;

        case 'PORTAL_USED_SYNC':
          this.emit('portalUsedSync', msg);
          break;

        case 'PORTALS_SPAWNED_SYNC':
          this.emit('portalsSpawnedSync', msg);
          break;

        case 'GAME_RESTARTED':
          this.emit('gameRestarted', msg);
          break;
      }
    } catch (e) {
      console.error('Failed parsing server message:', e);
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  createRoom(map = 'forest', maxPlayers = 2, playerName = 'Player 1', time = 60, buffs = true) {
    this.connect().then(() => {
      this.send({
        type: 'CREATE_ROOM',
        map,
        maxPlayers,
        playerName,
        time,
        buffs
      });
    }).catch(err => {
      this.emit('error', 'Cannot connect to online server. Ensure backend is running.');
    });
  }

  joinRoom(roomCode, playerName = 'Player') {
    this.connect().then(() => {
      this.send({
        type: 'JOIN_ROOM',
        roomCode,
        playerName
      });
    }).catch(err => {
      this.emit('error', 'Cannot connect to online server. Ensure backend is running.');
    });
  }

  startGame() {
    this.send({ type: 'START_GAME' });
  }

  sendPlayerSync(player) {
    this.send({
      type: 'PLAYER_SYNC',
      playerId: this.myPlayerId,
      x: player.x,
      y: player.y,
      vx: player.vx,
      vy: player.vy,
      facing: player.facing,
      scaleX: player.scaleX,
      scaleY: player.scaleY,
      isGrounded: player.isGrounded,
      runCycle: player.runCycle,
      isIt: player.isIt,
      isImmune: player.isImmune,
      inWater: player.inWater,
      buff: player.buff,
      ping: this.ping || 0
    });
  }

  sendTagEvent(fromId, toId, x, y) {
    this.send({
      type: 'TAG_EVENT',
      fromId,
      toId,
      x,
      y
    });
  }

  sendBuffCollect(orbId, playerId, buffType) {
    this.send({
      type: 'BUFF_COLLECT',
      orbId,
      playerId,
      buffType
    });
  }

  sendPortalUsed(portalId, targetId) {
    this.send({
      type: 'PORTAL_USED',
      portalId,
      targetId
    });
  }

  sendPortalsSpawned(portals) {
    this.send({
      type: 'PORTALS_SPAWNED',
      portals
    });
  }

  restartMatch() {
    this.send({ type: 'RESTART_MATCH' });
  }

  disconnect() {
    this.stopPing();
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
      this.isConnected = false;
      this.roomCode = null;
      this.ping = 0;
    }
  }
}

export const networkManager = new NetworkManager();
if (typeof window !== 'undefined') {
  window.networkManager = networkManager;
}
