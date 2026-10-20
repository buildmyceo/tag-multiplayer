// Map configurations, arenas, interactive elements, and dioramas

export const MAPS = {
  forest: {
    id: 'forest',
    name: 'FOREST',
    width: 1280,
    height: 720,
    skyColor: '#3ea5e6',
    pillarColor: '#68b7ed',
    groundColor: '#f72585',
    grassColor: '#00e676',
    ambientType: 'petals',

    // Player initial spawn positions
    spawns: [
      { x: 180, y: 580 },
      { x: 1060, y: 580 },
      { x: 380, y: 260 },
      { x: 860, y: 260 }
    ],

    solidBlocks: [
      { x: 0, y: 0, width: 30, height: 720 },
      { x: 1250, y: 0, width: 30, height: 720 }
    ],

    platforms: [
      { x: 90, y: 510, width: 270, height: 18, color: '#f72585', topColor: '#00e676' },
      { x: 920, y: 510, width: 270, height: 18, color: '#f72585', topColor: '#00e676' },
      { x: 440, y: 440, width: 400, height: 20, color: '#f72585', topColor: '#00e676' },
      { x: 180, y: 290, width: 240, height: 18, color: '#f72585', topColor: '#00e676' },
      { x: 860, y: 290, width: 240, height: 18, color: '#f72585', topColor: '#00e676' },
      { x: 500, y: 180, width: 280, height: 18, color: '#f72585', topColor: '#00e676' }
    ],

    bouncePads: [
      { x: 615, y: 640, width: 52, height: 20, color: '#ff8500', squash: 1 },
      { x: 100, y: 490, width: 46, height: 18, color: '#ff8500', squash: 1 },
      { x: 1134, y: 490, width: 46, height: 18, color: '#ff8500', squash: 1 }
    ],

    portals: [
      { id: 'p1', targetId: 'p2', x: 200, y: 226, width: 46, height: 64, color: '#e040fb' },
      { id: 'p2', targetId: 'p1', x: 1034, y: 226, width: 46, height: 64, color: '#e040fb' }
    ],

    decorations: [
      { type: 'tree', x: 130, y: 370, scale: 1.1 },
      { type: 'tree', x: 1100, y: 370, scale: 1.1 },
      { type: 'tree', x: 560, y: 290, scale: 0.9 },
      { type: 'flower', x: 240, y: 670, color: '#ffd000' },
      { type: 'flower', x: 380, y: 670, color: '#eb3b5a' },
      { type: 'flower', x: 880, y: 670, color: '#ffd000' },
      { type: 'flower', x: 1020, y: 670, color: '#eb3b5a' }
    ]
  },

  winter: {
    id: 'winter',
    name: 'WINTER',
    width: 1280,
    height: 720,
    skyColor: '#4895ef',
    pillarColor: '#72a1e5',
    groundColor: '#9381ff',
    grassColor: '#ffffff', // snow
    ambientType: 'snow',

    spawns: [
      { x: 180, y: 580 },
      { x: 1060, y: 580 },
      { x: 380, y: 260 },
      { x: 860, y: 260 }
    ],

    solidBlocks: [
      { x: 0, y: 0, width: 30, height: 720 },
      { x: 1250, y: 0, width: 30, height: 720 }
    ],

    platforms: [
      { x: 120, y: 520, width: 280, height: 18, color: '#9381ff', topColor: '#ffffff' },
      { x: 880, y: 520, width: 280, height: 18, color: '#9381ff', topColor: '#ffffff' },
      { x: 440, y: 430, width: 400, height: 20, color: '#9381ff', topColor: '#ffffff' },
      { x: 160, y: 280, width: 250, height: 18, color: '#9381ff', topColor: '#ffffff' },
      { x: 870, y: 280, width: 250, height: 18, color: '#9381ff', topColor: '#ffffff' },
      { x: 490, y: 190, width: 300, height: 18, color: '#9381ff', topColor: '#ffffff' }
    ],

    bouncePads: [
      { x: 615, y: 640, width: 52, height: 20, color: '#ff4d6d', squash: 1 },
      { x: 140, y: 500, width: 46, height: 18, color: '#ff4d6d', squash: 1 },
      { x: 1094, y: 500, width: 46, height: 18, color: '#ff4d6d', squash: 1 }
    ],

    portals: [
      { id: 'p1', targetId: 'p2', x: 200, y: 216, width: 46, height: 64, color: '#00f5d4' },
      { id: 'p2', targetId: 'p1', x: 1034, y: 216, width: 46, height: 64, color: '#00f5d4' }
    ],

    decorations: [
      { type: 'snowman', x: 490, y: 360 },
      { type: 'candycane', x: 260, y: 460 },
      { type: 'candycane', x: 990, y: 460 },
      { type: 'icetree', x: 740, y: 340, scale: 1 },
      { type: 'lights', x1: 440, y1: 430, x2: 840, y2: 430 }
    ]
  },

  desert: {
    id: 'desert',
    name: 'DESERT',
    width: 1280,
    height: 720,
    skyColor: '#3a86c8',
    pillarColor: '#6da0d0',
    groundColor: '#f4a261',
    grassColor: '#e9c46a', // golden sand
    ambientType: 'sand',

    spawns: [
      { x: 180, y: 580 },
      { x: 1060, y: 580 },
      { x: 380, y: 260 },
      { x: 860, y: 260 }
    ],

    solidBlocks: [
      { x: 0, y: 0, width: 30, height: 720 },
      { x: 1250, y: 0, width: 30, height: 720 }
    ],

    platforms: [
      { x: 100, y: 500, width: 280, height: 18, color: '#f4a261', topColor: '#e9c46a' },
      { x: 900, y: 500, width: 280, height: 18, color: '#f4a261', topColor: '#e9c46a' },
      { x: 430, y: 440, width: 420, height: 20, color: '#f4a261', topColor: '#e9c46a' },
      { x: 190, y: 290, width: 240, height: 18, color: '#f4a261', topColor: '#e9c46a' },
      { x: 850, y: 290, width: 240, height: 18, color: '#f4a261', topColor: '#e9c46a' },
      { x: 490, y: 180, width: 300, height: 18, color: '#f4a261', topColor: '#e9c46a' }
    ],

    bouncePads: [
      { x: 615, y: 640, width: 52, height: 20, color: '#2a9d8f', squash: 1 },
      { x: 120, y: 480, width: 46, height: 18, color: '#2a9d8f', squash: 1 },
      { x: 1114, y: 480, width: 46, height: 18, color: '#2a9d8f', squash: 1 }
    ],

    portals: [
      { id: 'p1', targetId: 'p2', x: 220, y: 226, width: 46, height: 64, color: '#ffb703' },
      { id: 'p2', targetId: 'p1', x: 1014, y: 226, width: 46, height: 64, color: '#ffb703' }
    ],

    decorations: [
      { type: 'sphinx', x: 580, y: 350 },
      { type: 'cactus', x: 230, y: 430 },
      { type: 'cactus', x: 1030, y: 430 },
      { type: 'pyramid', x: 740, y: 380 },
      { type: 'palmtree', x: 340, y: 290 },
      { type: 'palmtree', x: 920, y: 290 }
    ]
  }
};

// Draw full interactive in-game map
export function drawMap(ctx, map) {
  // 1. Sky Background
  ctx.fillStyle = map.skyColor;
  ctx.fillRect(0, 0, map.width, map.height);

  // Background temple pillars
  ctx.fillStyle = map.pillarColor;
  ctx.globalAlpha = 0.45;
  const colWidth = 64;
  const spacing = 180;
  for (let x = 60; x < map.width; x += spacing) {
    ctx.fillRect(x, 120, colWidth, 540);
    ctx.fillRect(x - 12, 100, colWidth + 24, 20);
    ctx.fillRect(x - 20, 85, colWidth + 40, 15);
  }
  ctx.globalAlpha = 1.0;

  // 2. Map-Specific Scenery Decorations
  for (const dec of map.decorations) {
    drawDecoration(ctx, dec);
  }

  // 3. Ground Bedrock & Scalloped Grass Edge
  const groundY = map.height - 60;
  ctx.fillStyle = map.groundColor;
  ctx.fillRect(0, groundY, map.width, 60);

  // Scalloped Grass/Snow/Sand Crest
  ctx.fillStyle = map.grassColor;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  const scallopSize = 18;
  for (let x = 0; x <= map.width; x += scallopSize * 2) {
    ctx.quadraticCurveTo(x + scallopSize, groundY + 9, x + scallopSize * 2, groundY);
  }
  ctx.lineTo(map.width, groundY);
  ctx.lineTo(0, groundY);
  ctx.fill();

  // 4. Draw Platforms
  for (const p of map.platforms) {
    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.beginPath();
    ctx.roundRect(p.x, p.y + 4, p.width, p.height, 8);
    ctx.fill();

    // Platform block
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.width, p.height, 8);
    ctx.fill();

    // Grass/Snow/Sand top strip
    ctx.fillStyle = p.topColor;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.width, 6, [8, 8, 2, 2]);
    ctx.fill();
  }

  // 5. Draw Bounce Pads (Spring launchers)
  for (const pad of map.bouncePads) {
    ctx.save();
    pad.squash += (1 - pad.squash) * 0.15; // spring recovery

    const currentHeight = pad.height * pad.squash;
    const currentY = pad.y + (pad.height - currentHeight);

    // Orange rounded box
    ctx.fillStyle = pad.color;
    ctx.beginPath();
    ctx.roundRect(pad.x, currentY, pad.width, currentHeight, 6);
    ctx.fill();

    // Yellow diagonal warning chevron stripes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.moveTo(pad.x + 10, currentY + currentHeight - 3);
    ctx.lineTo(pad.x + pad.width / 2, currentY + 4);
    ctx.lineTo(pad.x + pad.width - 10, currentY + currentHeight - 3);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.restore();
  }

  // 6. Draw Portals (Teleporters)
  for (const portal of map.portals) {
    ctx.save();
    const cx = portal.x + portal.width / 2;
    const cy = portal.y + portal.height / 2;

    // Glowing aura
    ctx.shadowColor = portal.color;
    ctx.shadowBlur = 18;

    // Arch base
    ctx.fillStyle = portal.color;
    ctx.beginPath();
    ctx.arc(cx, portal.y + 24, portal.width / 2, Math.PI, 0);
    ctx.lineTo(portal.x + portal.width, portal.y + portal.height);
    ctx.lineTo(portal.x, portal.y + portal.height);
    ctx.closePath();
    ctx.fill();

    // Inner glowing swirl
    const time = Date.now() / 250;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.75 + Math.sin(time * 3) * 0.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, portal.width / 3.2, portal.height / 2.6, time, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// Scenery decoration renderer
function drawDecoration(ctx, dec) {
  ctx.save();
  if (dec.type === 'tree') {
    const s = dec.scale || 1;
    ctx.fillStyle = '#9b1d60';
    ctx.fillRect(dec.x - 8 * s, dec.y, 16 * s, 60 * s);
    ctx.fillStyle = '#00e676';
    ctx.beginPath();
    ctx.roundRect(dec.x - 36 * s, dec.y - 50 * s, 72 * s, 60 * s, 16 * s);
    ctx.fill();
  } else if (dec.type === 'flower') {
    ctx.fillStyle = dec.color;
    ctx.beginPath();
    ctx.arc(dec.x, dec.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(dec.x, dec.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (dec.type === 'snowman') {
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
    ctx.fillStyle = '#9c6644';
    ctx.fillRect(dec.x - 12, dec.y - 8, 7, 4);
    ctx.fillRect(dec.x + 5, dec.y - 8, 7, 4);
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

// Draw the 3 Diorama Cards for "CHOOSE MAP" matching Screenshot 2
export function drawDiorama(ctx, mapId, x, y, width, height, isHovered) {
  ctx.save();
  const offsetY = isHovered ? -10 : 0;
  ctx.translate(x, y + offsetY);

  // Soft base shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(width / 2, height + 8, width * 0.45, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isHovered) {
    ctx.shadowColor = 'rgba(255, 255, 255, 0.75)';
    ctx.shadowBlur = 22;
  }

  const pedHeight = 96;
  const pedY = height - pedHeight;

  if (mapId === 'forest') {
    // 1. Forest Diorama
    ctx.fillStyle = '#f72585';
    ctx.beginPath();
    ctx.roundRect(0, pedY, width, pedHeight, 20);
    ctx.fill();

    // Grass top
    ctx.fillStyle = '#00e676';
    ctx.beginPath();
    ctx.roundRect(0, pedY, width, 20, [20, 20, 4, 4]);
    ctx.fill();

    // Grass scallops
    ctx.beginPath();
    for (let sx = 0; sx <= width; sx += 22) {
      ctx.arc(sx + 11, pedY + 18, 9, 0, Math.PI);
    }
    ctx.fill();

    // Trees
    drawDioramaTree(ctx, 60, pedY - 30, '#9b1d60', '#00e676', 1);
    drawDioramaTree(ctx, 200, pedY - 20, '#9b1d60', '#00e676', 1.15);

    // Flowers
    drawDioramaFlower(ctx, 40, pedY, '#ffd000');
    drawDioramaFlower(ctx, 130, pedY, '#eb3b5a');

    // Title Badge
    drawDioramaBadge(ctx, width / 2, pedY + 54, 'FOREST', '#f72585');
  } else if (mapId === 'winter') {
    // 2. Winter Diorama
    ctx.fillStyle = '#9381ff';
    ctx.beginPath();
    ctx.roundRect(0, pedY, width, pedHeight, 20);
    ctx.fill();

    // White snow top
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(0, pedY, width, 20, [20, 20, 6, 6]);
    ctx.fill();

    // Snow mounds
    ctx.beginPath();
    ctx.arc(width / 2, pedY + 10, 48, Math.PI, 0);
    ctx.fill();

    // Snowman
    drawDioramaSnowman(ctx, 60, pedY - 14);

    // Candy cane
    drawDioramaCandyCane(ctx, 130, pedY - 10);

    // Fairy lights
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(60, pedY - 6);
    ctx.quadraticCurveTo(125, pedY + 8, 195, pedY - 6);
    ctx.stroke();

    const lightColors = ['#ff4d6d', '#ffd166', '#06d6a0', '#118ab2'];
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const lx = 60 + (195 - 60) * t;
      const ly = (1 - t) * (1 - t) * (pedY - 6) + 2 * (1 - t) * t * (pedY + 8) + t * t * (pedY - 6);
      ctx.fillStyle = lightColors[i % lightColors.length];
      ctx.beginPath();
      ctx.arc(lx, ly + 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ice Tree
    drawDioramaIceTree(ctx, 210, pedY - 24);

    // Title Badge
    drawDioramaBadge(ctx, width / 2, pedY + 54, 'WINTER', '#9381ff');
  } else if (mapId === 'desert') {
    // 3. Desert Diorama
    ctx.fillStyle = '#f4a261';
    ctx.beginPath();
    ctx.roundRect(0, pedY, width, pedHeight, 20);
    ctx.fill();

    // Sand top
    ctx.fillStyle = '#e9c46a';
    ctx.beginPath();
    ctx.roundRect(0, pedY, width, 20, [20, 20, 4, 4]);
    ctx.fill();

    // Sphinx
    drawDioramaSphinx(ctx, 80, pedY - 10);

    // Cactus
    drawDioramaCactus(ctx, 145, pedY - 6);

    // Mini pyramid
    ctx.fillStyle = '#e76f51';
    ctx.beginPath();
    ctx.moveTo(180, pedY - 18);
    ctx.lineTo(165, pedY);
    ctx.lineTo(195, pedY);
    ctx.closePath();
    ctx.fill();

    // Palm tree
    drawDioramaPalm(ctx, 225, pedY);

    // Title Badge
    drawDioramaBadge(ctx, width / 2, pedY + 54, 'DESERT', '#f4a261');
  }

  ctx.restore();
}

function drawDioramaBadge(ctx, x, y, text, color) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.roundRect(x - 65, y - 16, 130, 32, 16);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 18px "Lilita One", cursive';
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
