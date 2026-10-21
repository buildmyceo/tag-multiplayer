// Player class for Tag characters - Supports Official Sprites, Local 1-Keyboard & Online Remote Players

import { soundManager } from './audio.js';

// Preload uploaded official character sprites
const playerSprites = {
  1: new Image(), // Red Ninja
  2: new Image(), // Blue Ninja
  3: new Image(), // Black Ninja with Yellow Headband
  4: new Image()  // Green Ninja
};

playerSprites[1].src = '/player3.png'; // Red
playerSprites[2].src = '/player1.png'; // Blue
playerSprites[3].src = '/player2.png'; // Yellow
playerSprites[4].src = '/player4.png'; // Green

for (const id in playerSprites) {
  if (playerSprites[id].decode) {
    playerSprites[id].decode().catch(() => {});
  }
}

export class Player {
  constructor(id, color, name, label, x, y, controls, isRemote = false, isBot = false) {
    this.id = id;
    this.color = color;
    this.name = name;
    this.label = label;
    this.x = x;
    this.y = y;
    this.width = 34;
    this.height = 34;
    this.vx = 0;
    this.vy = 0;
    this.isGrounded = false;
    this.facing = 1;

    // Remote player flag for Online Multiplayer
    this.isRemote = isRemote;

    // Bot AI flag for Solo or filled slots
    this.isBot = isBot;
    this.botTimer = Math.floor(Math.random() * 12);
    this.botDecision = { left: false, right: false, jump: false, down: false };

    // Squash & Stretch
    this.scaleX = 1;
    this.scaleY = 1;

    // State
    this.isIt = false;
    this.isImmune = false;
    this.immuneTimer = 0;

    // Controls
    this.controls = controls || {};

    // Animation cycles
    this.runCycle = 0;
    this.dustTimer = 0;
    this.ribbonWave = 0;

    // Water wading state
    this.inWater = false;
    this.wasInWater = false;
    this.waterSplashCooldown = 0;

    // Jump buffering and coyote time for ultra responsive controls
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.wasJumpPressed = false;

    // Ghost trails
    this.ghosts = [];
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.isGrounded = false;
    this.scaleX = 1;
    this.scaleY = 1;
    this.isIt = false;
    this.isImmune = false;
    this.immuneTimer = 0;
    this.ghosts = [];
    this.portalCooldown = 0;
  }

  tag() {
    this.isIt = true;
    this.isImmune = true;
    this.immuneTimer = 80;
    this.scaleX = 1.35;
    this.scaleY = 0.75;
  }

  passTag() {
    this.isIt = false;
    this.isImmune = true;
    this.immuneTimer = 85;
  }

  isActionPressed(keys, actionList) {
    if (!actionList) return false;
    for (const key of actionList) {
      if (keys.has(key) || keys.has(key.toLowerCase()) || keys.has(key.toUpperCase())) {
        return true;
      }
    }
    return false;
  }

  updateRemote(data) {
    this.x += (data.x - this.x) * 0.45;
    this.y += (data.y - this.y) * 0.45;
    this.vx = data.vx;
    this.vy = data.vy;
    this.facing = data.facing;
    this.scaleX = data.scaleX;
    this.scaleY = data.scaleY;
    this.isGrounded = data.isGrounded;
    this.runCycle = data.runCycle;
    this.isIt = data.isIt;
    this.isImmune = data.isImmune;
    this.inWater = !!data.inWater;
    this.ribbonWave += 0.22;
  }

  update(keys, map, players, particles) {
    if (this.isRemote) {
      this.ribbonWave += 0.22;
      return;
    }

    if (this.immuneTimer > 0) {
      this.immuneTimer--;
      if (this.immuneTimer <= 0) {
        this.isImmune = false;
      }
    }

    if (this.isIt || Math.abs(this.vx) > 5) {
      if (Math.random() < 0.5) {
        this.ghosts.push({
          x: this.x,
          y: this.y,
          facing: this.facing,
          alpha: 0.6,
          scaleX: this.scaleX,
          scaleY: this.scaleY
        });
      }
    }

    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      this.ghosts[i].alpha -= 0.08;
      if (this.ghosts[i].alpha <= 0) {
        this.ghosts.splice(i, 1);
      }
    }

    let moveLeft = false;
    let moveRight = false;
    let doJump = false;
    let doDown = false;

    if (this.isBot) {
      this.updateBotAI(players, map);
      moveLeft = this.botDecision.left;
      moveRight = this.botDecision.right;
      doJump = this.botDecision.jump;
      doDown = this.botDecision.down;
    } else {
      moveLeft = this.isActionPressed(keys, this.controls?.leftKeys);
      moveRight = this.isActionPressed(keys, this.controls?.rightKeys);
      doJump = this.isActionPressed(keys, this.controls?.jumpKeys);
      doDown = this.isActionPressed(keys, this.controls?.downKeys);
    }

    // Check if player is currently wading in water
    const wz = map.waterZone;
    let currentlyInWater = false;
    if (wz && this.y + this.height >= wz.y + 6) {
      if (this.x + this.width > wz.waterStart && this.x < wz.waterEnd) {
        // Not submerged if standing on a stepping stone above water level
        let onSteppingStone = false;
        for (const plat of (map.platforms || [])) {
          if (plat.y >= wz.y && this.isGrounded && Math.abs((this.y + this.height) - plat.y) <= 4) {
            if (this.x + this.width > plat.x && this.x < plat.x + plat.width) {
              onSteppingStone = true;
              break;
            }
          }
        }
        currentlyInWater = !onSteppingStone;
      }
    }
    this.inWater = currentlyInWater;

    // Splash sound & burst when entering water
    if (this.inWater && !this.wasInWater) {
      soundManager.playSplash?.();
      particles?.createWaterSplash?.(this.x + this.width / 2, this.y + this.height, 14);
    }
    this.wasInWater = this.inWater;

    // Movement physics: water slows the player down significantly!
    let maxSpeed = this.inWater ? 2.4 : 5.0;
    let accel = this.inWater ? 0.30 : 0.62;
    let friction = this.inWater ? 0.78 : 0.82;
    let jumpForce = this.inWater ? -9.5 : -13.8;

    if (this.isIt) {
      maxSpeed *= 1.08;
    }

    if (moveLeft && !moveRight) {
      this.vx -= accel;
      this.facing = -1;
    } else if (moveRight && !moveLeft) {
      this.vx += accel;
      this.facing = 1;
    } else {
      this.vx *= friction;
    }

    this.vx = Math.max(-maxSpeed, Math.min(maxSpeed, this.vx));
    if (Math.abs(this.vx) < 0.1) this.vx = 0;

    if (Math.abs(this.vx) > 0.4 && this.isGrounded) {
      this.runCycle += this.inWater ? 0.14 : 0.22;
      this.dustTimer++;
      if (this.inWater) {
        if (this.dustTimer > 7) {
          particles?.createWaterSplash?.(this.x + this.width / 2, this.y + this.height - 2, 4);
          this.dustTimer = 0;
        }
      } else {
        if (this.dustTimer > 10) {
          particles.createDust(this.x + this.width / 2, this.y + this.height, 2);
          this.dustTimer = 0;
        }
      }
    } else {
      this.runCycle = 0;
    }
    this.ribbonWave += 0.22;

    // Coyote time: allow jumping for a few frames after leaving ground
    if (this.isGrounded) {
      this.coyoteTimer = 8;
    } else if (this.coyoteTimer > 0) {
      this.coyoteTimer--;
    }

    // Jump buffer: remember jump press for a few frames before touching ground
    if (doJump && !this.wasJumpPressed) {
      this.jumpBufferTimer = 8;
    } else if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer--;
    }
    this.wasJumpPressed = doJump;

    // Trigger jump if buffered and coyote time is valid
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.vy = jumpForce;
      this.isGrounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.scaleX = 0.8;
      this.scaleY = 1.25;
      soundManager.playJump();
      particles.createDust(this.x + this.width / 2, this.y + this.height, 6);
    }

    // Uniform gravity for all players (standardized jump arc and peak height)
    this.vy += 0.56;
    if (this.vy > 15) this.vy = 15;

    this.applyMapCollision(map, doDown, particles);

    this.scaleX += (1 - this.scaleX) * 0.18;
    this.scaleY += (1 - this.scaleY) * 0.18;
  }

  applyMapCollision(map, dropThrough, particles) {
    const prevY = this.y;

    this.x += this.vx;

    // Horizontal boundaries: keep players within arena
    if (this.x < 0) {
      this.x = 0;
      this.vx = 0;
    } else if (this.x + this.width > (map.width || 1280)) {
      this.x = (map.width || 1280) - this.width;
      this.vx = 0;
    }

    // Solid blocks
    for (const b of (map.solidBlocks || [])) {
      if (this.intersects(b)) {
        if (this.vx > 0) {
          this.x = b.x - this.width;
        } else if (this.vx < 0) {
          this.x = b.x + b.width;
        }
        this.vx = 0;
      }
    }

    this.y += this.vy;
    this.isGrounded = false;

    // Floor boundary: bottom riverbed floor (712px)
    const groundLimit = 712;
    if (this.y + this.height >= groundLimit) {
      this.y = groundLimit - this.height;
      if (this.vy > 4) {
        this.scaleX = 1.3;
        this.scaleY = 0.75;
        if (this.inWater) {
          particles?.createWaterSplash?.(this.x + this.width / 2, this.y + this.height, 8);
        } else {
          particles?.createDust?.(this.x + this.width / 2, this.y + this.height, 4);
        }
      }
      this.vy = 0;
      this.isGrounded = true;
    }

    if (this.y < 20) {
      this.y = 20;
      this.vy = 0;
    }

    for (const b of (map.solidBlocks || [])) {
      if (this.intersects(b)) {
        if (this.vy > 0) {
          this.y = b.y - this.height;
          if (this.vy > 4) {
            this.scaleX = 1.25;
            this.scaleY = 0.8;
            particles.createDust(this.x + this.width / 2, this.y + this.height, 4);
          }
          this.vy = 0;
          this.isGrounded = true;
        } else if (this.vy < 0) {
          this.y = b.y + b.height;
          this.vy = 0;
        }
      }
    }

    // Platforms (one-way pass-through from underneath, drop through with S/Down)
    if (!dropThrough && this.vy >= 0) {
      for (const p of (map.platforms || [])) {
        const horizOverlap = (this.x + this.width > p.x) && (this.x < p.x + p.width);
        if (!horizOverlap) continue;

        const feetPrev = prevY + this.height;
        const feetNow = this.y + this.height;
        const tolerance = Math.max(16, this.vy + 4);

        if (feetPrev <= p.y + 10 && feetNow >= p.y && feetNow <= p.y + tolerance) {
          this.y = p.y - this.height;
          if (this.vy > 4) {
            this.scaleX = 1.25;
            this.scaleY = 0.8;
            particles.createDust(this.x + this.width / 2, this.y + this.height, 3);
          }
          this.vy = 0;
          this.isGrounded = true;
          break;
        }
      }
    }

    // Bounce Pads
    for (const pad of (map.bouncePads || [])) {
      const isTouching =
        this.x + this.width > pad.x &&
        this.x < pad.x + pad.width &&
        this.y + this.height >= pad.y - 4 &&
        this.y + this.height <= pad.y + pad.height + 14 &&
        this.vy >= 0;

      if (isTouching) {
        this.vy = -19.2;
        this.isGrounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.scaleX = 0.6;
        this.scaleY = 1.6;
        pad.squash = 0.3;
        soundManager.playBounce();
        particles.createBounceBurst(pad.x + pad.width / 2, pad.y);
      }
    }

    // Teleport Portals
    if (!this.portalCooldown) this.portalCooldown = 0;
    if (this.portalCooldown > 0) {
      this.portalCooldown--;
    } else {
      for (const portal of (map.portals || [])) {
        const dx = (this.x + this.width / 2) - (portal.x + portal.width / 2);
        const dy = (this.y + this.height / 2) - (portal.y + portal.height / 2);
        const dist = Math.hypot(dx, dy);

        if (dist < 34) {
          const target = (map.portals || []).find(p => p.id === portal.targetId);
          if (target) {
            this.x = target.x + (target.width - this.width) / 2;
            this.y = target.y + target.height - this.height - 4;
            this.portalCooldown = 60;
            this.vx *= -1;
            soundManager.playTeleport();
            particles.createTeleportSwirl(portal.x + portal.width / 2, portal.y + portal.height / 2);
            particles.createTeleportSwirl(target.x + target.width / 2, target.y + target.height / 2);

            // Notify map that this portal pair was used, triggering disappearance and 20s regeneration
            if (map.onPortalUsed) {
              map.onPortalUsed(portal.id, target.id);
            }
            break;
          }
        }
      }
    }
  }

  updateBotAI(players, map) {
    this.botTimer--;
    if (this.botTimer > 0) return;
    this.botTimer = Math.floor(Math.random() * 6) + 3; // Fast reaction loop: 50-150ms

    const itPlayer = players.find(p => p.isIt);
    if (!itPlayer) return;

    if (this.isIt) {
      // 1. BOT IS IT: Chase the closest non-immune runner!
      let nearest = null;
      let minDist = 999999;

      for (const p of players) {
        if (p.id === this.id || p.isImmune) continue;
        const dist = Math.hypot(p.x - this.x, p.y - this.y);
        if (dist < minDist) {
          minDist = dist;
          nearest = p;
        }
      }

      if (!nearest) {
        // If all are temporarily immune, head toward any other player
        nearest = players.find(p => p.id !== this.id);
      }

      if (nearest) {
        const dx = (nearest.x + nearest.width / 2) - (this.x + this.width / 2);
        const dy = (nearest.y + nearest.height / 2) - (this.y + this.height / 2);

        this.botDecision.left = dx < -14;
        this.botDecision.right = dx > 14;

        // Jump if target is higher, or if bot is stuck on a wall/obstacle
        const targetHigher = dy < -25;
        const wallInFront = Math.abs(this.vx) < 1.2 && (this.botDecision.left || this.botDecision.right);
        const randomHop = Math.random() < 0.22;
        this.botDecision.jump = this.isGrounded && (targetHigher || wallInFront || randomHop);

        // Drop down through platform if target is below us
        this.botDecision.down = dy > 45 && Math.random() < 0.5;

        // Check if a bounce pad is nearby and target is way above
        for (const pad of (map.bouncePads || [])) {
          const padDist = Math.abs((pad.x + pad.width / 2) - (this.x + this.width / 2));
          if (padDist < 45 && targetHigher) {
            this.botDecision.left = (pad.x + pad.width / 2) < (this.x + this.width / 2);
            this.botDecision.right = !this.botDecision.left;
          }
        }
      }
    } else {
      // 2. BOT IS RUNNER: Escape from the IT player!
      const dx = (this.x + this.width / 2) - (itPlayer.x + itPlayer.width / 2);
      const dy = (this.y + this.height / 2) - (itPlayer.y + itPlayer.height / 2);
      const dist = Math.hypot(dx, dy);

      // Boundary safety: don't get trapped against walls
      const nearLeftWall = this.x < 130;
      const nearRightWall = this.x > 1140;

      if (dist < 600) {
        // RUN AWAY from IT!
        if (nearLeftWall) {
          this.botDecision.left = false;
          this.botDecision.right = true;
          this.botDecision.jump = this.isGrounded;
        } else if (nearRightWall) {
          this.botDecision.left = true;
          this.botDecision.right = false;
          this.botDecision.jump = this.isGrounded;
        } else {
          this.botDecision.left = dx < 0;
          this.botDecision.right = dx > 0;
        }

        // Jump over obstacles or onto higher platforms when fleeing
        const wallInFront = Math.abs(this.vx) < 1.2;
        const fleeJump = (dist < 280 && Math.random() < 0.45) || wallInFront;
        this.botDecision.jump = this.isGrounded && fleeJump;

        // Drop down to lower platforms if IT is close and above
        this.botDecision.down = dy < -25 && Math.random() < 0.45;
      } else {
        // Safe distance: Continuously patrol arena, jump between platforms, stay active!
        if (!this.patrolDir || Math.random() < 0.03 || nearLeftWall || nearRightWall) {
          this.patrolDir = nearLeftWall ? 1 : (nearRightWall ? -1 : (Math.random() < 0.5 ? -1 : 1));
        }
        this.botDecision.left = this.patrolDir < 0;
        this.botDecision.right = this.patrolDir > 0;
        const stuck = Math.abs(this.vx) < 0.8;
        this.botDecision.jump = this.isGrounded && (stuck || Math.random() < 0.15);
        this.botDecision.down = false;
      }
    }
  }

  intersects(box) {
    return (
      this.x < box.x + box.width &&
      this.x + this.width > box.x &&
      this.y < box.y + box.height &&
      this.y + this.height > box.y
    );
  }

  draw(ctx, allPlayers = []) {
    // 1. Ghost trails
    for (const g of this.ghosts) {
      ctx.save();
      ctx.globalAlpha = g.alpha * 0.35;
      ctx.translate(g.x + this.width / 2, g.y + this.height / 2);
      ctx.scale(g.facing * g.scaleX, g.scaleY);
      this.drawCharacterSprite(ctx);
      ctx.restore();
    }

    ctx.save();

    // 2. Immunity Shield
    if (this.isImmune) {
      const shieldTime = Date.now() / 150;
      ctx.save();
      ctx.strokeStyle = '#00f5d4';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = shieldTime * 10;
      ctx.shadowColor = '#00f5d4';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 23, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      if (Math.floor(this.immuneTimer / 4) % 2 === 0) {
        ctx.globalAlpha = 0.55;
      }
    }

    // 3. Translate to center of player
    const legOffset = Math.sin(this.runCycle) * 2.5;
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2 + legOffset);
    ctx.scale(this.facing * this.scaleX, this.scaleY);

    // Speed lines
    if (Math.abs(this.vx) > 3.8) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-this.width / 2 - 6, -5);
      ctx.lineTo(-this.width / 2 - 16, -5);
      ctx.moveTo(-this.width / 2 - 5, 6);
      ctx.lineTo(-this.width / 2 - 14, 6);
      ctx.stroke();
    }


    // 4. Draw Official Character Sprite
    this.drawCharacterSprite(ctx);

    // Water ripple ring around player submerged in water
    if (this.inWater) {
      ctx.save();
      const waterTime = Date.now() / 220;
      const wave = Math.sin(waterTime * 2.8) * 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, this.height / 2 - 2, this.width / 2 + 5 + wave, 5, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    // 5. Draw "IT" Bouncing Arrow
    if (this.isIt) {
      ctx.save();
      const arrowBob = Math.sin(Date.now() / 140) * 5;
      const arrowY = this.y - 18 + arrowBob;
      const arrowX = this.x + this.width / 2;

      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 8;

      ctx.fillStyle = '#ff1744';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY + 11);
      ctx.lineTo(arrowX - 11, arrowY - 4);
      ctx.lineTo(arrowX - 5, arrowY - 4);
      ctx.lineTo(arrowX - 5, arrowY - 15);
      ctx.lineTo(arrowX + 5, arrowY - 15);
      ctx.lineTo(arrowX + 5, arrowY - 4);
      ctx.lineTo(arrowX + 11, arrowY - 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 12px "Lilita One", cursive';
      ctx.textAlign = 'center';
      ctx.fillText('IT!', arrowX, arrowY - 20);
      ctx.restore();
    } else {
      ctx.save();
      const lblY = this.y - 10;
      const lblX = this.x + this.width / 2;
      const badgeW = this.isBot ? 46 : (this.id === 1 ? 36 : 32);

      ctx.fillStyle = this.color;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        try { ctx.roundRect(lblX - badgeW / 2, lblY - 7, badgeW, 14, 5); } catch(e) { ctx.rect(lblX - badgeW / 2, lblY - 7, badgeW, 14); }
      } else {
        ctx.rect(lblX - badgeW / 2, lblY - 7, badgeW, 14);
      }
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 10px "Lilita One", cursive';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labelText = this.isBot ? '🤖 BOT' : (this.id === 1 ? 'P1 YOU' : `P${this.id}`);
      ctx.fillText(labelText, lblX, lblY);
      ctx.restore();
    }
  }

  // Draw official uploaded sprite or procedural fallback
  drawCharacterSprite(ctx) {
    const sprite = playerSprites[this.id];
    const w = this.width;
    const h = this.height;

    let drawn = false;
    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      try {
        const tilt = (this.vx / 8) * 0.15;
        ctx.save();
        ctx.rotate(tilt);
        ctx.drawImage(sprite, -w / 2 - 2, -h / 2 - 4, w + 4, h + 6);
        ctx.restore();
        drawn = true;
      } catch (e) {
        drawn = false;
      }
    }

    if (!drawn) {
      this.drawFallbackNinja(ctx, w, h);
    }
  }

  drawFallbackNinja(ctx, w, h) {
    ctx.fillStyle = '#161922';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      try { ctx.roundRect(-w / 2, -h / 2, w, h, 8); } catch(e) { ctx.rect(-w / 2, -h / 2, w, h); }
    } else {
      ctx.rect(-w / 2, -h / 2, w, h);
    }
    ctx.fill();

    ctx.fillStyle = this.color;
    ctx.fillRect(-w / 2 + 3, -11, w - 6, 10);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(3, -1, 7, 9.5, 0, 0, Math.PI * 2);
    ctx.ellipse(16, -1, 7, 9.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111319';
    ctx.beginPath();
    ctx.ellipse(4, -1, 3.8, 4.8, 0, 0, Math.PI * 2);
    ctx.ellipse(17, -1, 3.8, 4.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
