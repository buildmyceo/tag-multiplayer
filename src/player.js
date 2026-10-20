// Player class for Tag characters - 100% Pure Local Multiplayer (No bots)

import { soundManager } from './audio.js';

export class Player {
  constructor(id, color, name, label, x, y, controls) {
    this.id = id;
    this.color = color; // '#eb3b47', '#38bdf8', '#ffd000', '#00c853'
    this.name = name;
    this.label = label; // e.g. "WASD", "ARROWS", "IJKL", "TFGH"
    this.x = x;
    this.y = y;
    this.width = 46;
    this.height = 46;
    this.vx = 0;
    this.vy = 0;
    this.isGrounded = false;
    this.facing = 1; // 1 = right, -1 = left

    // Squash & Stretch
    this.scaleX = 1;
    this.scaleY = 1;

    // State
    this.isIt = false;
    this.isImmune = false;
    this.immuneTimer = 0;
    this.isFrozen = false;
    this.freezeTimer = 0;
    this.buff = null; // 'speed', 'jump', null
    this.buffTimer = 0;

    // Robust multi-key controls
    this.controls = controls;

    // Run animation cycle & aesthetics
    this.runCycle = 0;
    this.dustTimer = 0;
    this.ribbonWave = 0;
    this.blinkTimer = Math.random() * 120 + 60;
    this.isBlinking = false;

    // Ghost trails for speed
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
    this.isFrozen = false;
    this.freezeTimer = 0;
    this.buff = null;
    this.buffTimer = 0;
    this.ghosts = [];
    this.portalCooldown = 0;
  }

  tag() {
    this.isIt = true;
    this.isImmune = true;
    this.immuneTimer = 80; // ~1.3 seconds immunity at 60fps
    this.scaleX = 1.35;
    this.scaleY = 0.75;
  }

  passTag() {
    this.isIt = false;
    this.isImmune = true;
    this.immuneTimer = 85; // Cannot be tagged back immediately
  }

  // Check if a specific control action is pressed from keys Map/Set
  isActionPressed(keys, actionList) {
    for (const key of actionList) {
      if (keys.has(key) || keys.has(key.toLowerCase()) || keys.has(key.toUpperCase())) {
        return true;
      }
    }
    return false;
  }

  update(keys, map, players, particles) {
    // Immunity timer
    if (this.immuneTimer > 0) {
      this.immuneTimer--;
      if (this.immuneTimer <= 0) {
        this.isImmune = false;
      }
    }

    // Freeze timer (from ice buff)
    if (this.freezeTimer > 0) {
      this.freezeTimer--;
      if (this.freezeTimer <= 0) {
        this.isFrozen = false;
      }
      return;
    }

    // Buff timer
    if (this.buffTimer > 0) {
      this.buffTimer--;
      if (this.buffTimer <= 0) {
        this.buff = null;
      }
    }

    // Blinking animation
    this.blinkTimer--;
    if (this.blinkTimer <= 0) {
      this.isBlinking = !this.isBlinking;
      this.blinkTimer = this.isBlinking ? 8 : (Math.random() * 140 + 80);
    }

    // Ghost trail logic (when IT, speed buff, or sprinting)
    if (this.isIt || this.buff === 'speed' || Math.abs(this.vx) > 5) {
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

    // 100% Human Player Input from Keyboard
    const moveLeft = this.isActionPressed(keys, this.controls.leftKeys);
    const moveRight = this.isActionPressed(keys, this.controls.rightKeys);
    const doJump = this.isActionPressed(keys, this.controls.jumpKeys);
    const doDown = this.isActionPressed(keys, this.controls.downKeys);

    // Physics parameters
    let maxSpeed = 7.2;
    let accel = 0.88;
    let friction = 0.82;
    let jumpForce = -13.8;

    if (this.buff === 'speed') {
      maxSpeed *= 1.45;
      accel *= 1.35;
    } else if (this.isIt) {
      maxSpeed *= 1.08; // IT runs slightly faster to make the chase exciting
    }

    if (this.buff === 'jump') {
      jumpForce = -17.5;
    }

    // Horizontal Movement
    if (moveLeft && !moveRight) {
      this.vx -= accel;
      this.facing = -1;
    } else if (moveRight && !moveLeft) {
      this.vx += accel;
      this.facing = 1;
    } else {
      this.vx *= friction;
    }

    // Clamp horizontal speed
    this.vx = Math.max(-maxSpeed, Math.min(maxSpeed, this.vx));
    if (Math.abs(this.vx) < 0.1) this.vx = 0;

    // Running animation cycle
    if (Math.abs(this.vx) > 0.5 && this.isGrounded) {
      this.runCycle += 0.3;
      this.dustTimer++;
      if (this.dustTimer > 8) {
        particles.createDust(this.x + this.width / 2, this.y + this.height, 2);
        this.dustTimer = 0;
      }
    } else {
      this.runCycle = 0;
    }
    this.ribbonWave += 0.22;

    // Jumping
    if (doJump && this.isGrounded) {
      this.vy = jumpForce;
      this.isGrounded = false;
      this.scaleX = 0.8;
      this.scaleY = 1.25;
      soundManager.playJump();
      particles.createDust(this.x + this.width / 2, this.y + this.height, 6);
    }

    // Variable jump height: releasing jump key cuts upward velocity
    if (!doJump && this.vy < -4) {
      this.vy *= 0.65;
    }

    // Gravity
    this.vy += 0.56;
    if (this.vy > 15) this.vy = 15;

    // Move & Collide with Map
    this.applyMapCollision(map, doDown, particles);

    // Squash & Stretch spring recovery towards (1, 1)
    this.scaleX += (1 - this.scaleX) * 0.18;
    this.scaleY += (1 - this.scaleY) * 0.18;
  }

  applyMapCollision(map, dropThrough, particles) {
    const prevY = this.y;

    // Move X
    this.x += this.vx;

    // Boundary walls X
    if (this.x < 30) {
      this.x = 30;
      this.vx = 0;
    } else if (this.x + this.width > map.width - 30) {
      this.x = map.width - 30 - this.width;
      this.vx = 0;
    }

    // Solid blocks collision X
    for (const b of map.solidBlocks) {
      if (this.intersects(b)) {
        if (this.vx > 0) {
          this.x = b.x - this.width;
        } else if (this.vx < 0) {
          this.x = b.x + b.width;
        }
        this.vx = 0;
      }
    }

    // Move Y
    this.y += this.vy;
    this.isGrounded = false;

    // Boundary floor Y
    const groundLimit = map.height - 40;
    if (this.y + this.height >= groundLimit) {
      this.y = groundLimit - this.height;
      if (this.vy > 4) {
        this.scaleX = 1.3;
        this.scaleY = 0.75;
        particles.createDust(this.x + this.width / 2, this.y + this.height, 4);
      }
      this.vy = 0;
      this.isGrounded = true;
    }

    // Boundary ceiling Y
    if (this.y < 20) {
      this.y = 20;
      this.vy = 0;
    }

    // Solid blocks collision Y
    for (const b of map.solidBlocks) {
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

    // One-Way Jump-Through Platforms
    if (!dropThrough && this.vy >= 0) {
      for (const p of map.platforms) {
        const wasAbove = prevY + this.height <= p.y + 7;
        const isTouching =
          this.x + this.width > p.x &&
          this.x < p.x + p.width &&
          this.y + this.height >= p.y &&
          this.y + this.height <= p.y + 16;

        if (wasAbove && isTouching) {
          this.y = p.y - this.height;
          if (this.vy > 4) {
            this.scaleX = 1.25;
            this.scaleY = 0.8;
            particles.createDust(this.x + this.width / 2, this.y + this.height, 3);
          }
          this.vy = 0;
          this.isGrounded = true;
        }
      }
    }

    // Bounce Pads Collision
    for (const pad of map.bouncePads) {
      const isTouching =
        this.x + this.width > pad.x &&
        this.x < pad.x + pad.width &&
        this.y + this.height >= pad.y &&
        this.y + this.height <= pad.y + pad.height + 10 &&
        this.vy >= 0;

      if (isTouching) {
        this.vy = -18.8; // Strong, satisfying spring launch!
        this.isGrounded = false;
        this.scaleX = 0.65;
        this.scaleY = 1.5;
        pad.squash = 0.35; // Compress pad
        soundManager.playBounce();
        particles.createBounceBurst(pad.x + pad.width / 2, pad.y);
      }
    }

    // Portals Collision (Pair warp)
    if (!this.portalCooldown) this.portalCooldown = 0;
    if (this.portalCooldown > 0) {
      this.portalCooldown--;
    } else {
      for (const portal of map.portals) {
        const dx = (this.x + this.width / 2) - (portal.x + portal.width / 2);
        const dy = (this.y + this.height / 2) - (portal.y + portal.height / 2);
        const dist = Math.hypot(dx, dy);

        if (dist < 34) {
          const target = map.portals.find(p => p.id === portal.targetId);
          if (target) {
            this.x = target.x + (target.width - this.width) / 2;
            this.y = target.y + target.height - this.height - 8;
            this.portalCooldown = 60; // 1 second cooldown
            soundManager.playTeleport();
            particles.createTeleportSwirl(portal.x + portal.width / 2, portal.y + portal.height / 2);
            particles.createTeleportSwirl(target.x + target.width / 2, target.y + target.height / 2);
            break;
          }
        }
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

  // Draw player matching the WeLoPlay black ninja style
  draw(ctx, allPlayers = []) {
    // 1. Draw ghost trails
    for (const g of this.ghosts) {
      ctx.save();
      ctx.globalAlpha = g.alpha * 0.35;
      ctx.translate(g.x + this.width / 2, g.y + this.height / 2);
      ctx.scale(g.facing * g.scaleX, g.scaleY);
      this.drawBodyShape(ctx, this.color);
      ctx.restore();
    }

    ctx.save();

    // 2. Immunity Shield Barrier
    if (this.isImmune) {
      // Rotating glowing barrier ring
      const shieldTime = Date.now() / 150;
      ctx.save();
      ctx.strokeStyle = '#00f5d4';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = shieldTime * 10;
      ctx.shadowColor = '#00f5d4';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Blinking opacity
      if (Math.floor(this.immuneTimer / 4) % 2 === 0) {
        ctx.globalAlpha = 0.55;
      }
    }

    // Freeze Ice Cube visual
    if (this.isFrozen) {
      ctx.save();
      ctx.fillStyle = 'rgba(128, 222, 234, 0.65)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(this.x - 4, this.y - 4, this.width + 8, this.height + 8, 10);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Translate to center of player for squash & stretch
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.scale(this.facing * this.scaleX, this.scaleY);

    // Speed lines behind when moving fast
    if (Math.abs(this.vx) > 4.5) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-this.width / 2 - 8, -6);
      ctx.lineTo(-this.width / 2 - 22, -6);
      ctx.moveTo(-this.width / 2 - 6, 8);
      ctx.lineTo(-this.width / 2 - 18, 8);
      ctx.stroke();
    }

    // IT Flaming Aura
    if (this.isIt) {
      ctx.shadowColor = '#ff1744';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = '#ff1744';
      ctx.lineWidth = 3.5;
      this.drawBodyShape(ctx, null, true);
    }

    // 1. Draw Feet (little running pedals)
    const legOffset = Math.sin(this.runCycle) * 6;
    ctx.fillStyle = '#161922';
    // Back foot
    ctx.beginPath();
    ctx.ellipse(-9, this.height / 2 - 2 + legOffset, 5.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Front foot
    ctx.beginPath();
    ctx.ellipse(9, this.height / 2 - 2 - legOffset, 5.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Draw Body (Jet black rounded square with 2 ninja cat-ear horns)
    this.drawBodyShape(ctx, '#161922');

    // 3. Draw Headband & Ribbons
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.width / 2 + 3, -11, this.width - 6, 10); // Forehead band

    // Fluttering ribbons on back side
    const wave = Math.sin(this.ribbonWave) * 4;
    ctx.beginPath();
    ctx.moveTo(-this.width / 2 + 4, -9);
    ctx.quadraticCurveTo(-this.width / 2 - 14, -7 + wave, -this.width / 2 - 24, -12 + wave * 1.5);
    ctx.lineTo(-this.width / 2 - 18, -4 + wave);
    ctx.quadraticCurveTo(-this.width / 2 - 12, -3 + wave, -this.width / 2 + 4, -4);
    ctx.fill();

    // Second ribbon tail
    ctx.beginPath();
    ctx.moveTo(-this.width / 2 + 4, -6);
    ctx.quadraticCurveTo(-this.width / 2 - 12, -2 - wave, -this.width / 2 - 20, 2 - wave);
    ctx.lineTo(-this.width / 2 - 15, 6 - wave);
    ctx.quadraticCurveTo(-this.width / 2 - 8, 3 - wave, -this.width / 2 + 4, -1);
    ctx.fill();

    // 4. Draw Face: Large White Oval Eyes & Black Pupils
    if (!this.isBlinking) {
      // Eye whites
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(3, -1, 7, 9.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(16, -1, 7, 9.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pupils dynamic gaze
      let pupilShiftX = 2;
      let pupilShiftY = 0;
      if (this.vy < -2) pupilShiftY = -3;
      if (this.vy > 2) pupilShiftY = 3;

      // Look at IT if running away
      const itPlayer = allPlayers.find(p => p.isIt && p.id !== this.id);
      if (itPlayer) {
        const dx = (itPlayer.x - this.x) * this.facing;
        if (dx < 0) {
          pupilShiftX = -2.5; // Look back in panic!
        }
      }

      ctx.fillStyle = '#111319';
      ctx.beginPath();
      ctx.ellipse(3 + pupilShiftX, -1 + pupilShiftY, 3.8, 4.8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(16 + pupilShiftX, -1 + pupilShiftY, 3.8, 4.8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eye reflections
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(4 + pupilShiftX, -3 + pupilShiftY, 1.8, 0, Math.PI * 2);
      ctx.arc(17 + pupilShiftX, -3 + pupilShiftY, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Happy closed curved eyes when blinking
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(3, -1, 5, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(16, -1, 5, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    }

    // Cute smiling mouth
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(9.5, 9, 3.5, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    ctx.restore();

    // 5. Draw "IT" Bouncing Arrow & Label over player
    if (this.isIt) {
      ctx.save();
      const arrowBob = Math.sin(Date.now() / 140) * 7;
      const arrowY = this.y - 28 + arrowBob;
      const arrowX = this.x + this.width / 2;

      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 8;

      // Red Arrow pointing down
      ctx.fillStyle = '#ff1744';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY + 14);
      ctx.lineTo(arrowX - 15, arrowY - 6);
      ctx.lineTo(arrowX - 6, arrowY - 6);
      ctx.lineTo(arrowX - 6, arrowY - 20);
      ctx.lineTo(arrowX + 6, arrowY - 20);
      ctx.lineTo(arrowX + 6, arrowY - 6);
      ctx.lineTo(arrowX + 15, arrowY - 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // "IT!" Text bubble
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 14px "Lilita One", cursive';
      ctx.textAlign = 'center';
      ctx.fillText('IT!', arrowX, arrowY - 26);

      ctx.restore();
    } else {
      // Small Player Label above head
      ctx.save();
      const lblY = this.y - 14;
      const lblX = this.x + this.width / 2;

      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.roundRect(lblX - 16, lblY - 8, 32, 16, 6);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 11px "Lilita One", cursive';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`P${this.id}`, lblX, lblY);
      ctx.restore();
    }
  }

  // Draw the iconic body geometry: rounded box with 2 ninja ear points
  drawBodyShape(ctx, fillStyle, strokeOnly = false) {
    const w = this.width;
    const h = this.height;
    const r = 9; // corner radius

    ctx.beginPath();
    // Top-left horn/ear
    ctx.moveTo(-w / 2, -h / 2 + r);
    ctx.lineTo(-w / 2 - 2, -h / 2 - 5); // left ear tip
    ctx.lineTo(-w / 2 + 10, -h / 2);
    // Top edge
    ctx.lineTo(w / 2 - 10, -h / 2);
    // Top-right horn/ear
    ctx.lineTo(w / 2 + 2, -h / 2 - 5); // right ear tip
    ctx.lineTo(w / 2, -h / 2 + r);
    // Right edge
    ctx.lineTo(w / 2, h / 2 - r);
    ctx.arcTo(w / 2, h / 2, w / 2 - r, h / 2, r);
    // Bottom edge
    ctx.lineTo(-w / 2 + r, h / 2);
    ctx.arcTo(-w / 2, h / 2, -w / 2, h / 2 - r, r);
    // Left edge
    ctx.lineTo(-w / 2, -h / 2 + r);
    ctx.closePath();

    if (strokeOnly) {
      ctx.stroke();
    } else {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
