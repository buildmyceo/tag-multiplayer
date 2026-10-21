// Map configurations, arenas, interactive elements, and dioramas

// Preload uploaded official map image with asynchronous decode
const map1Img = new Image();
map1Img.src = '/map1.png';
if (map1Img.decode) {
  map1Img.decode().catch(() => {});
}

// Cached offscreen canvas to avoid IPC texture rebinding on Safari WebKit
let cachedMapCanvas = null;
export function clearCachedMap() {
  cachedMapCanvas = null;
}
function getCachedMap(img, width, height) {
  if (cachedMapCanvas) return cachedMapCanvas;
  if (!img || !img.complete || img.naturalWidth <= 0) return null;
  try {
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext('2d');
    offCtx.drawImage(img, 0, 0, width, height);
    cachedMapCanvas = offscreen;
    return cachedMapCanvas;
  } catch (e) {
    cachedMapCanvas = null;
    return null;
  }
}

export const MAPS = {

  forest: {
    id: 'forest',
    name: 'WATERFALL REALM',
    width: 1280,
    height: 720,
    bgImage: map1Img,
    skyColor: '#3ea5e6',
    pillarColor: '#68b7ed',
    groundColor: '#f72585',
    grassColor: '#00e676',
    ambientType: 'petals',

    // Player initial spawn positions
    spawns: [
      { x: 80, y: 410 },
      { x: 1040, y: 630 },
      { x: 420, y: 530 },
      { x: 880, y: 410 }
    ],

    solidBlocks: [],

    // Water zone: slows player movement when wading in the bottom river
    waterZone: {
      x: 0,
      y: 668,
      width: 1280,
      height: 52,
      waterStart: 180,
      waterEnd: 912
    },

    // Exact platform collision geometry matching uploaded new_map.png
    platforms: [
      // --- TOP TIER ---
      // Top-left cliff
      { x: 0, y: 148, width: 88, height: 22 },
      // Top-left rope bridge
      { x: 88, y: 154, width: 55, height: 16 },
      // Top-left floating island
      { x: 140, y: 182, width: 168, height: 22 },
      // Top-center floating island
      { x: 724, y: 182, width: 130, height: 22 },
      // Top-right floating island
      { x: 978, y: 182, width: 142, height: 22 },
      // Top-right rope bridge
      { x: 1116, y: 172, width: 78, height: 16 },
      // Top-right cliff
      { x: 1192, y: 162, width: 88, height: 22 },

      // --- SECOND TIER ---
      // Small orange pad / block
      { x: 322, y: 242, width: 52, height: 16 },
      // Mid-upper left island (cactus)
      { x: 414, y: 246, width: 134, height: 22 },
      // Mid-upper center island (tree)
      { x: 576, y: 272, width: 112, height: 22 },
      // Upper-right small island
      { x: 978, y: 272, width: 80, height: 20 },

      // --- THIRD TIER ---
      // Mid-left cliff & ledge
      { x: 0, y: 288, width: 44, height: 20 },
      { x: 44, y: 296, width: 160, height: 20 },
      // Mid-left slope down
      { x: 204, y: 312, width: 35, height: 16 },
      { x: 239, y: 328, width: 65, height: 16 },
      // Mid-left floating slab
      { x: 395, y: 320, width: 145, height: 20 },
      // Mid-right slope platform: flat + ramp
      { x: 766, y: 290, width: 104, height: 20 },
      { x: 870, y: 304, width: 28, height: 16 },
      { x: 898, y: 324, width: 28, height: 16 },
      { x: 926, y: 344, width: 32, height: 16 },
      // Mid-right large cliff
      { x: 1048, y: 334, width: 232, height: 22 },

      // --- FOURTH TIER ---
      // Small step left
      { x: 312, y: 362, width: 42, height: 16 },
      // Center island
      { x: 560, y: 374, width: 148, height: 22 },
      // Small step right
      { x: 974, y: 394, width: 78, height: 18 },
      // Mid floating island
      { x: 355, y: 418, width: 134, height: 22 },
      // Island with tree right
      { x: 818, y: 450, width: 160, height: 22 },
      // Lower-mid right island
      { x: 1078, y: 480, width: 122, height: 20 },

      // --- FIFTH TIER ---
      // Left massive cliff
      { x: 0, y: 448, width: 212, height: 24 },
      // Island below waterfall
      { x: 228, y: 488, width: 130, height: 22 },
      // Center island
      { x: 528, y: 466, width: 152, height: 22 },
      // Lower center small platform
      { x: 746, y: 520, width: 88, height: 20 },
      // Right pillar floating step
      { x: 914, y: 580, width: 68, height: 18 },
      // Right rock pillar
      { x: 1026, y: 560, width: 78, height: 22 },

      // --- SIXTH TIER (LOWER TERRAIN & BRIDGES) ---
      // Lower-left grass bank
      { x: 0, y: 608, width: 186, height: 22 },
      // Rope bridge lower left
      { x: 186, y: 624, width: 58, height: 16 },
      // Ramp up to central plateau
      { x: 244, y: 624, width: 64, height: 20 },
      { x: 308, y: 596, width: 56, height: 20 },
      { x: 364, y: 568, width: 164, height: 22 },
      // Center rope bridge
      { x: 528, y: 574, width: 94, height: 16 },
      // Floating platform after center bridge
      { x: 622, y: 570, width: 124, height: 22 },
      // Lower center island pillar
      { x: 792, y: 636, width: 82, height: 22 },
      // Lower right large plateau
      { x: 912, y: 668, width: 272, height: 22 },
      // Far lower-right cliff
      { x: 1184, y: 574, width: 96, height: 24 },

      // --- WATER STEPPING STONES (BOTTOM) ---
      { x: 282, y: 676, width: 78, height: 20 },
      { x: 504, y: 670, width: 84, height: 20 },
      { x: 665, y: 680, width: 84, height: 20 }
    ],

    // Orange Spring Bounce Pads
    bouncePads: [
      { x: 120, y: 428, width: 44, height: 20, color: '#ff8500', squash: 1 },
      { x: 460, y: 548, width: 44, height: 20, color: '#ff8500', squash: 1 },
      { x: 950, y: 648, width: 44, height: 20, color: '#ff8500', squash: 1 }
    ],

    // Swirling Teleporters (Dynamically generated at runtime)
    portals: [],

    decorations: []
  }
};

// Aliases so any legacy references safely resolve to the uploaded map
MAPS.winter = MAPS.forest;
MAPS.desert = MAPS.forest;
MAPS.map1 = MAPS.forest;

// Draw full in-game arena
export function drawMap(ctx, map) {
  if (!map) return;

  let bgDrawn = false;
  if (map.bgImage && map.bgImage.complete && map.bgImage.naturalWidth > 0) {
    try {
      const cached = getCachedMap(map.bgImage, map.width, map.height);
      if (cached) {
        ctx.drawImage(cached, 0, 0, map.width, map.height);
        bgDrawn = true;
      } else {
        ctx.drawImage(map.bgImage, 0, 0, map.width, map.height);
        bgDrawn = true;
      }
    } catch (e) {
      cachedMapCanvas = null;
      try {
        ctx.drawImage(map.bgImage, 0, 0, map.width, map.height);
        bgDrawn = true;
      } catch (e2) {
        bgDrawn = false;
      }
    }
  }

  if (!bgDrawn) {
    // Procedural fallback
    ctx.fillStyle = map.skyColor || '#3ea5e6';
    ctx.fillRect(0, 0, map.width, map.height);

    ctx.fillStyle = map.pillarColor || '#68b7ed';
    ctx.globalAlpha = 0.45;
    for (let x = 60; x < map.width; x += 180) {
      ctx.fillRect(x, 120, 64, 540);
      ctx.fillRect(x - 12, 100, 88, 20);
      ctx.fillRect(x - 20, 85, 104, 15);
    }
    ctx.globalAlpha = 1.0;

    for (const dec of (map.decorations || [])) {
      try { drawDecoration(ctx, dec); } catch (e) {}
    }

    const groundY = map.height - 60;
    ctx.fillStyle = map.groundColor || '#f72585';
    ctx.fillRect(0, groundY, map.width, 60);

    ctx.fillStyle = map.grassColor || '#00e676';
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    for (let x = 0; x <= map.width; x += 36) {
      ctx.quadraticCurveTo(x + 18, groundY + 9, x + 36, groundY);
    }
    ctx.lineTo(map.width, groundY);
    ctx.lineTo(0, groundY);
    ctx.fill();

    for (const p of (map.platforms || [])) {
      ctx.fillStyle = p.color || '#f72585';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        try { ctx.roundRect(p.x, p.y, p.width, p.height, 8); } catch (e) { ctx.rect(p.x, p.y, p.width, p.height); }
      } else {
        ctx.rect(p.x, p.y, p.width, p.height);
      }
      ctx.fill();

      ctx.fillStyle = p.topColor || '#00e676';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        try { ctx.roundRect(p.x, p.y, p.width, 6, 2); } catch (e) { ctx.rect(p.x, p.y, p.width, 6); }
      } else {
        ctx.rect(p.x, p.y, p.width, 6);
      }
      ctx.fill();
    }
  }

  // 1.5. Dynamic Animated Water Shimmer & Wave Foam
  if (map.waterZone) {
    const wz = map.waterZone;
    ctx.save();
    const time = Date.now() / 400;
    // Translucent soft water wash
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.fillRect(wz.waterStart, wz.y, wz.waterEnd - wz.waterStart, wz.height);

    // Flowing water surface foam line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = wz.waterStart; x <= wz.waterEnd; x += 14) {
      const wave = Math.sin(x * 0.045 + time) * 3;
      if (x === wz.waterStart) ctx.moveTo(x, wz.y + wave + 2);
      else ctx.lineTo(x, wz.y + wave + 2);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 2. Draw Interactive Bounce Pads
  for (const pad of (map.bouncePads || [])) {
    ctx.save();
    pad.squash = (pad.squash || 1) + (1 - (pad.squash || 1)) * 0.15;

    const currentHeight = pad.height * pad.squash;
    const currentY = pad.y + (pad.height - currentHeight);

    ctx.fillStyle = pad.color;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      try { ctx.roundRect(pad.x, currentY, pad.width, currentHeight, 6); } catch (e) { ctx.rect(pad.x, currentY, pad.width, currentHeight); }
    } else {
      ctx.rect(pad.x, currentY, pad.width, currentHeight);
    }
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.moveTo(pad.x + 8, currentY + currentHeight - 3);
    ctx.lineTo(pad.x + pad.width / 2, currentY + 4);
    ctx.lineTo(pad.x + pad.width - 8, currentY + currentHeight - 3);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.restore();
  }

  // 3. Draw Dynamic Teleporters
  for (const portal of (map.portals || [])) {
    ctx.save();
    const cx = portal.x + portal.width / 2;
    const cy = portal.y + portal.height / 2;
    const color = portal.color || '#e040fb';

    // Pulsating outer glow
    const pulse = Math.sin(Date.now() / 200) * 4;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20 + pulse;

    // Glowing base pedestal
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, portal.y + portal.height, portal.width / 2 + 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Portal Arch Frame
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, portal.y + portal.width / 2, portal.width / 2, Math.PI, 0);
    ctx.lineTo(portal.x + portal.width, portal.y + portal.height);
    ctx.lineTo(portal.x, portal.y + portal.height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Swirling Cosmic Vortex Core
    const time = Date.now() / 220;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.8 + Math.sin(time * 3) * 0.15;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, portal.width / 3.2, portal.height / 2.7, time, 0, Math.PI * 2);
    ctx.fill();

    // Floating Portal Label Tag Badge
    ctx.globalAlpha = 1.0;
    const isA = (portal.id === 'portal_a' || portal.id === 'p1');
    const labelText = isA ? '🌀 A' : '🌀 B';
    ctx.font = '900 11px "Lilita One", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textW = ctx.measureText(labelText).width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.beginPath();
    ctx.roundRect(cx - textW / 2 - 6, portal.y - 20, textW + 12, 17, 8);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelText, cx, portal.y - 11);

    ctx.restore();
  }
}

function drawDecoration(ctx, dec) {
  ctx.save();
  if (dec.type === 'snowman') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(dec.x, dec.y + 26, 20, 0, Math.PI * 2);
    ctx.arc(dec.x, dec.y, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#222222';
    ctx.beginPath();
    ctx.arc(dec.x - 4, dec.y - 2, 2, 0, Math.PI * 2);
    ctx.arc(dec.x + 4, dec.y - 2, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff7b00';
    ctx.beginPath();
    ctx.moveTo(dec.x, dec.y + 1);
    ctx.lineTo(dec.x + 9, dec.y + 3);
    ctx.lineTo(dec.x, dec.y + 5);
    ctx.fill();

    ctx.fillStyle = '#e63946';
    ctx.fillRect(dec.x - 12, dec.y + 8, 24, 6);
    ctx.fillRect(dec.x + 6, dec.y + 8, 6, 16);

    ctx.fillStyle = '#1d2a44';
    ctx.fillRect(dec.x - 14, dec.y - 12, 28, 4);
    ctx.fillRect(dec.x - 9, dec.y - 26, 18, 14);
  } else if (dec.type === 'candycane') {
    ctx.strokeStyle = '#e63946';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(dec.x, dec.y + 40);
    ctx.lineTo(dec.x, dec.y + 16);
    ctx.arc(dec.x + 12, dec.y + 16, 12, Math.PI, 0);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();
  } else if (dec.type === 'icetree') {
    ctx.fillStyle = '#7b2cbf';
    ctx.fillRect(dec.x - 6, dec.y, 12, 50);
    ctx.fillStyle = '#a2d2ff';
    ctx.beginPath();
    ctx.roundRect(dec.x - 30, dec.y - 45, 60, 50, 12);
    ctx.fill();
  } else if (dec.type === 'lights') {
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(dec.x1, dec.y1);
    const midX = (dec.x1 + dec.x2) / 2;
    ctx.quadraticCurveTo(midX, dec.y1 + 18, dec.x2, dec.y2);
    ctx.stroke();

    const colors = ['#e63946', '#ffd166', '#06d6a0', '#118ab2'];
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const lx = dec.x1 + (dec.x2 - dec.x1) * t;
      const ly = (1 - t) * (1 - t) * dec.y1 + 2 * (1 - t) * t * (dec.y1 + 18) + t * t * dec.y2;
      ctx.fillStyle = colors[i % colors.length];
      ctx.shadowColor = colors[i % colors.length];
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(lx, ly + 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (dec.type === 'sphinx') {
    ctx.fillStyle = '#e9c46a';
    ctx.beginPath();
    ctx.roundRect(dec.x - 40, dec.y + 15, 80, 45, 8);
    ctx.roundRect(dec.x - 22, dec.y - 20, 44, 40, 10);
    ctx.fill();
  } else if (dec.type === 'cactus') {
    ctx.fillStyle = '#2a9d8f';
    ctx.beginPath();
    ctx.roundRect(dec.x - 8, dec.y - 30, 16, 60, 8);
    ctx.roundRect(dec.x - 22, dec.y - 12, 16, 8, 4);
    ctx.roundRect(dec.x - 22, dec.y - 26, 8, 16, 4);
    ctx.roundRect(dec.x + 6, dec.y - 4, 16, 8, 4);
    ctx.roundRect(dec.x + 14, dec.y - 18, 8, 16, 4);
    ctx.fill();
  } else if (dec.type === 'pyramid') {
    ctx.fillStyle = '#e76f51';
    ctx.beginPath();
    ctx.moveTo(dec.x, dec.y - 28);
    ctx.lineTo(dec.x - 30, dec.y + 20);
    ctx.lineTo(dec.x + 30, dec.y + 20);
    ctx.closePath();
    ctx.fill();
  } else if (dec.type === 'palmtree') {
    ctx.strokeStyle = '#a68a64';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(dec.x, dec.y + 50);
    ctx.quadraticCurveTo(dec.x + 8, dec.y + 20, dec.x, dec.y);
    ctx.stroke();

    ctx.fillStyle = '#2a9d8f';
    for (let a = -0.8; a <= 0.8; a += 0.4) {
      ctx.beginPath();
      ctx.ellipse(dec.x + a * 25, dec.y - 8, 22, 7, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Draw the Official Arena Card for "CHOOSE MAP"
export function drawDiorama(ctx, mapId, x, y, width, height, isHovered) {
  ctx.save();
  const offsetY = isHovered ? -10 : 0;
  ctx.translate(x, y + offsetY);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(width / 2, height + 10, width * 0.46, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isHovered) {
    ctx.shadowColor = '#00f5d4';
    ctx.shadowBlur = 24;
  }

  const pedHeight = 85;
  const pedY = height - pedHeight;

  // 1. Live Arena Thumbnail / Scenery Preview Window
  ctx.save();
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    try { ctx.roundRect(0, 0, width, pedY + 12, 18); } catch (e) { ctx.rect(0, 0, width, pedY + 12); }
  } else {
    ctx.rect(0, 0, width, pedY + 12);
  }
  ctx.clip();

  if (map1Img && map1Img.complete && map1Img.naturalWidth > 0) {
    try {
      ctx.drawImage(map1Img, 0, 0, width, pedY + 12);
    } catch (e) {
      ctx.fillStyle = '#3ea5e6';
      ctx.fillRect(0, 0, width, pedY + 12);
    }
  } else {
    ctx.fillStyle = '#3ea5e6';
    ctx.fillRect(0, 0, width, pedY + 12);
  }
  ctx.restore();

  // White border around thumbnail
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    try { ctx.roundRect(0, 0, width, pedY + 12, 18); } catch (e) { ctx.rect(0, 0, width, pedY + 12); }
  } else {
    ctx.rect(0, 0, width, pedY + 12);
  }
  ctx.stroke();

  // 2. Pedestal base
  ctx.fillStyle = '#f72585';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    try { ctx.roundRect(0, pedY, width, pedHeight, [0, 0, 18, 18]); } catch (e) { ctx.rect(0, pedY, width, pedHeight); }
  } else {
    ctx.rect(0, pedY, width, pedHeight);
  }
  ctx.fill();

  // Grass rim
  ctx.fillStyle = '#00e676';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    try { ctx.roundRect(0, pedY, width, 16, 4); } catch (e) { ctx.rect(0, pedY, width, 16); }
  } else {
    ctx.rect(0, pedY, width, 16);
  }
  ctx.fill();

  // Scallops
  ctx.beginPath();
  for (let sx = 0; sx <= width; sx += 24) {
    ctx.arc(sx + 12, pedY + 14, 10, 0, Math.PI);
  }
  ctx.fill();

  drawDioramaBadge(ctx, width / 2, pedY + 50, 'OFFICIAL MAP 1', '#f72585');

  ctx.restore();
}

function drawDioramaBadge(ctx, x, y, text, color) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.roundRect(x - 75, y - 16, 150, 32, 16);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 16px "Lilita One", cursive';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawDioramaTree(ctx, x, y, trunkColor, leafColor, scale) {
  ctx.fillStyle = trunkColor;
  ctx.fillRect(x - 5 * scale, y, 10 * scale, 35 * scale);
  ctx.fillStyle = leafColor;
  ctx.beginPath();
  ctx.roundRect(x - 22 * scale, y - 30 * scale, 44 * scale, 36 * scale, 10 * scale);
  ctx.fill();
}

function drawDioramaFlower(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y + 4, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawDioramaSnowman(ctx, x, y) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y + 16, 14, 0, Math.PI * 2);
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#222';
  ctx.fillRect(x - 7, y - 8, 14, 3);
  ctx.fillRect(x - 4, y - 16, 8, 8);

  ctx.fillStyle = '#ff7b00';
  ctx.fillRect(x, y, 5, 2);

  ctx.fillStyle = '#e63946';
  ctx.fillRect(x - 8, y + 6, 16, 4);
}

function drawDioramaCandyCane(ctx, x, y) {
  ctx.strokeStyle = '#e63946';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + 26);
  ctx.lineTo(x, y + 10);
  ctx.arc(x + 8, y + 10, 8, Math.PI, 0);
  ctx.stroke();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawDioramaIceTree(ctx, x, y) {
  ctx.fillStyle = '#7b2cbf';
  ctx.fillRect(x - 4, y, 8, 30);
  ctx.fillStyle = '#a2d2ff';
  ctx.beginPath();
  ctx.roundRect(x - 20, y - 26, 40, 32, 8);
  ctx.fill();
}

function drawDioramaSphinx(ctx, x, y) {
  ctx.fillStyle = '#e9c46a';
  ctx.beginPath();
  ctx.roundRect(x - 28, y + 6, 56, 32, 6);
  ctx.roundRect(x - 16, y - 22, 32, 30, 8);
  ctx.fill();
}

function drawDioramaCactus(ctx, x, y) {
  ctx.fillStyle = '#2a9d8f';
  ctx.beginPath();
  ctx.roundRect(x - 5, y - 24, 10, 38, 5);
  ctx.roundRect(x - 14, y - 10, 10, 6, 3);
  ctx.roundRect(x - 14, y - 18, 6, 12, 3);
  ctx.roundRect(x + 4, y - 6, 10, 6, 3);
  ctx.roundRect(x + 8, y - 14, 6, 12, 3);
  ctx.fill();
}

function drawDioramaPalm(ctx, x, y) {
  ctx.strokeStyle = '#a68a64';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, y + 10);
  ctx.quadraticCurveTo(x + 6, y - 15, x - 2, y - 35);
  ctx.stroke();

  ctx.fillStyle = '#2a9d8f';
  for (let a = -0.7; a <= 0.7; a += 0.45) {
    ctx.beginPath();
    ctx.ellipse(x - 2 + a * 18, y - 38, 16, 5, a, 0, Math.PI * 2);
    ctx.fill();
  }
}
