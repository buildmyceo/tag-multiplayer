// WebSocket Realtime Network Client for Tag Online Multiplayer

export class NetworkManager {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.roomCode = null;
    this.isHost = false;
    this.myPlayerId = null;
    this.myPlayerIndex = 0;
    this.myColor = '#eb3b47';
    this.roomData = null;

    // Event listeners
    this.callbacks = {};
  }

  on(event, cb) {
    this.callbacks[event] = cb;
  }

  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event](data);
    }
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // Primary: via Vite /ws proxy; Fallback: direct port 3001
      const url = `${protocol}//${window.location.host}/ws`;

      try {
        this.ws = new WebSocket(url);
      } catch (err) {
        console.warn('Failed connecting via proxy, falling back to port 3001...', err);
        this.ws = new WebSocket(`${protocol}//${window.location.hostname}:3001`);
      }

      this.ws.onopen = () => {
        this.isConnected = true;
        this.emit('connected');
        resolve();
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket Error:', err);
        // If proxy failed, try direct connection to port 3001
        if (!this.isConnected) {
          const directUrl = `${protocol}//${window.location.hostname}:3001`;
          try {
            this.ws = new WebSocket(directUrl);
            this.ws.onopen = () => {
              this.isConnected = true;
              this.emit('connected');
              resolve();
            };
            this.ws.onmessage = (e) => this.handleMessage(e.data);
            this.ws.onclose = () => {
              this.isConnected = false;
              this.emit('disconnected');
            };
          } catch (e2) {
            reject(err);
          }
        } else {
          reject(err);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.emit('disconnected');
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    });
  }

  handleMessage(dataStr) {
    try {
      const msg = JSON.parse(dataStr);

      switch (msg.type) {
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
      this.emit('error', 'Cannot connect to online server');
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
      this.emit('error', 'Cannot connect to online server');
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
      buff: player.buff
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

  restartMatch() {
    this.send({ type: 'RESTART_MATCH' });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      this.roomCode = null;
    }
  }
}

export const networkManager = new NetworkManager();
