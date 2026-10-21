// WebSocket Multiplayer Server for Tag Game

import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

const PORT = 3001;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('TAG WebSocket Server Active\n');
});

const wss = new WebSocketServer({ server });

// Rooms map: roomCode -> roomData
const rooms = new Map();

// Helper to generate readable 4-character room codes (e.g. "TAG1", "JUMP", "STAR")
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

const PLAYER_COLORS = ['#eb3b47', '#38bdf8', '#ffd000', '#00c853'];
const PLAYER_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];

function broadcastToRoom(room, data, excludeWs = null) {
  const msg = JSON.stringify(data);
  for (const player of room.players) {
    if (player.ws && player.ws.readyState === WebSocket.OPEN && player.ws !== excludeWs) {
      player.ws.send(msg);
    }
  }
}

wss.on('connection', (ws) => {
  let currentRoomCode = null;
  let playerSlotIndex = -1;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'CREATE_ROOM') {
        const roomCode = generateRoomCode();
        const maxPlayers = Math.min(4, Math.max(2, data.maxPlayers || 2));
        const map = data.map || 'forest';

        const room = {
          code: roomCode,
          hostWs: ws,
          map: map,
          maxPlayers: maxPlayers,
          state: 'LOBBY',
          roundTimer: data.time || 60,
          buffs: data.buffs !== false,
          players: [
            {
              id: 1,
              name: data.playerName || 'Player 1',
              color: PLAYER_COLORS[0],
              ws: ws,
              isHost: true,
              isReady: true
            }
          ]
        };

        rooms.set(roomCode, room);
        currentRoomCode = roomCode;
        playerSlotIndex = 0;

        ws.send(JSON.stringify({
          type: 'ROOM_CREATED',
          roomCode: roomCode,
          playerIndex: 0,
          playerId: 1,
          color: PLAYER_COLORS[0],
          isHost: true,
          room: {
            code: room.code,
            map: room.map,
            maxPlayers: room.maxPlayers,
            state: room.state,
            players: room.players.map(p => ({ id: p.id, name: p.name, color: p.color, isHost: p.isHost }))
          }
        }));
      }

      else if (data.type === 'JOIN_ROOM') {
        const roomCode = (data.roomCode || '').toUpperCase().trim();
        const room = rooms.get(roomCode);

        if (!room) {
          ws.send(JSON.stringify({ type: 'JOIN_ERROR', message: 'Room not found! Check the code.' }));
          return;
        }

        if (room.state !== 'LOBBY') {
          ws.send(JSON.stringify({ type: 'JOIN_ERROR', message: 'Match already in progress!' }));
          return;
        }

        if (room.players.length >= room.maxPlayers) {
          ws.send(JSON.stringify({ type: 'JOIN_ERROR', message: 'Room is already full!' }));
          return;
        }

        const slotIndex = room.players.length;
        const newPlayerId = slotIndex + 1;
        const newPlayer = {
          id: newPlayerId,
          name: data.playerName || `Player ${newPlayerId}`,
          color: PLAYER_COLORS[slotIndex],
          ws: ws,
          isHost: false,
          isReady: true
        };

        room.players.push(newPlayer);
        currentRoomCode = roomCode;
        playerSlotIndex = slotIndex;

        // Tell joining player
        ws.send(JSON.stringify({
          type: 'JOIN_SUCCESS',
          roomCode: roomCode,
          playerIndex: slotIndex,
          playerId: newPlayerId,
          color: newPlayer.color,
          isHost: false,
          room: {
            code: room.code,
            map: room.map,
            maxPlayers: room.maxPlayers,
            state: room.state,
            players: room.players.map(p => ({ id: p.id, name: p.name, color: p.color, isHost: p.isHost }))
          }
        }));

        // Broadcast to existing players in room
        broadcastToRoom(room, {
          type: 'PLAYER_JOINED',
          room: {
            code: room.code,
            map: room.map,
            maxPlayers: room.maxPlayers,
            state: room.state,
            players: room.players.map(p => ({ id: p.id, name: p.name, color: p.color, isHost: p.isHost }))
          }
        }, ws);
      }

      else if (data.type === 'START_GAME') {
        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (!room || room.players[0].ws !== ws) return; // Host only

        room.state = 'PLAYING';
        // Randomly pick who is IT
        const itIndex = Math.floor(Math.random() * room.players.length);
        const itPlayerId = room.players[itIndex].id;

        broadcastToRoom(room, {
          type: 'GAME_STARTED',
          map: room.map,
          itPlayerId: itPlayerId,
          time: room.roundTimer,
          buffs: room.buffs
        });
      }

      // Realtime player position & state synchronization
      else if (data.type === 'PLAYER_SYNC') {
        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        // Relay to other players in the room
        broadcastToRoom(room, {
          type: 'REMOTE_PLAYER_SYNC',
          playerId: data.playerId,
          x: data.x,
          y: data.y,
          vx: data.vx,
          vy: data.vy,
          facing: data.facing,
          scaleX: data.scaleX,
          scaleY: data.scaleY,
          isGrounded: data.isGrounded,
          isIt: data.isIt,
          isImmune: data.isImmune,
          inWater: data.inWater,
          runCycle: data.runCycle,
          buff: data.buff
        }, ws);
      }

      // Tag Event Sync (When someone tags another player)
      else if (data.type === 'TAG_EVENT') {
        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        broadcastToRoom(room, {
          type: 'TAG_SYNC',
          fromId: data.fromId,
          toId: data.toId,
          x: data.x,
          y: data.y
        });
      }

      // Buff pickup sync (legacy support)
      else if (data.type === 'BUFF_COLLECT') {
        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        broadcastToRoom(room, {
          type: 'BUFF_SYNC',
          orbId: data.orbId,
          playerId: data.playerId,
          buffType: data.buffType
        });
      }

      // Portal used sync (portal pair disappears and restarts 20s cooldown)
      else if (data.type === 'PORTAL_USED') {
        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        broadcastToRoom(room, {
          type: 'PORTAL_USED_SYNC',
          portalId: data.portalId,
          targetId: data.targetId
        });
      }

      // Dynamic Portals Spawn sync
      else if (data.type === 'PORTALS_SPAWNED') {
        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        broadcastToRoom(room, {
          type: 'PORTALS_SPAWNED_SYNC',
          portals: data.portals
        });
      }

      // Replay / Play Again
      else if (data.type === 'RESTART_MATCH') {
        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        room.state = 'PLAYING';
        const itIndex = Math.floor(Math.random() * room.players.length);
        const itPlayerId = room.players[itIndex].id;

        broadcastToRoom(room, {
          type: 'GAME_RESTARTED',
          itPlayerId: itPlayerId,
          time: room.roundTimer
        });
      }

    } catch (err) {
      console.error('Error handling message:', err);
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;

    // Remove player
    room.players = room.players.filter(p => p.ws !== ws);

    if (room.players.length === 0) {
      rooms.delete(currentRoomCode);
    } else {
      // If host left, assign next player as host
      if (!room.players.some(p => p.isHost)) {
        room.players[0].isHost = true;
      }
      broadcastToRoom(room, {
        type: 'PLAYER_LEFT',
        room: {
          code: room.code,
          map: room.map,
          maxPlayers: room.maxPlayers,
          state: room.state,
          players: room.players.map(p => ({ id: p.id, name: p.name, color: p.color, isHost: p.isHost }))
        }
      });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[TAG Online Server] WebSocket server listening on port ${PORT}`);
});
