// Player class for Tag characters with exact visuals and physics

import { soundManager } from './audio.js';

export class Player {
  constructor(id, color, name, x, y, controls, isBot = false) {
    this.id = id;
    this.color = color; // '#eb3b47', '#38bdf8', '#ffd000', '#00c853'
    this.name = name;
    this.x = x;
    this.y = y;
    this.width = 44;
    this.height = 44;
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

    // Controls: { left: 'a', right: 'd', jump: 'w', down: 's' }
    this.controls = controls;
    this.isBot = isBot;

    // Bot decision timers
    this.botTimer = Math.random() * 20;
    this.botDecision = { left: false, right: false, jump: false, down: false };

    // Run animation cycle
    this.runCycle = 0;
    this.dustTimer = 0;
    this.ribbonWave = 0;

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
    this.immuneTimer = 85; // Cannot be tagged back immediately!
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

    // Ghost trail logic (when IT or speed buff)
    if (this.isIt || this.buff === 'speed' || Math.abs(this.vx) > 5) {
      if (Math.random() < 0.45) {
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

    // Determine inputs (from Keyboard or Bot AI)
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
      moveLeft = !!keys[this.controls.left];
      moveRight = !!keys[this.controls.right];
      doJump = !!keys[this.controls.jump];
      doDown = !!keys[this.controls.down];
    }

    // Physics parameters
    let maxSpeed = 7.0;
    let accel = 0.85;
    let friction = 0.82;
    let jumpForce = -13.6;

    if (this.buff === 'speed') {
      maxSpeed *= 1.45;
      accel *= 1.35;
    } else if (this.isIt) {
      maxSpeed *= 1.08; // IT runs slightly faster to keep chases thrilling!
    }

    if (this.buff === 'jump') {
      jumpForce = -17.5;
    }

    // Horizontal Movement
    if (moveLeft) {
      this.vx -= accel;
      this.facing = -1;
    } else if (moveRight) {
      this.vx += accel;
      this.facing = 1;
    } else {
      this.vx *= friction;
    }

    // Clamp speed
    this.vx = Math.max(-maxSpeed, Math.min(maxSpeed, this.vx));
    if (Math.abs(this.vx) < 0.1) this.vx = 0;

    // Running animation cycle
    if (Math.abs(this.vx) > 0.5 && this.isGrounded) {
      this.runCycle += 0.28;
      this.dustTimer++;
      if (this.dustTimer > 10) {
        particles.createDust(this.x + this.width / 2, this.y + this.height, 2);
        this.dustTimer = 0;
      }
    } else {
      this.runCycle = 0;
    }
    this.ribbonWave += 0.2;

    // Jumping
    if (doJump && this.isGrounded) {
      this.vy = jumpForce;
      this.isGrounded = false;
      this.scaleX = 0.8;
      this.scaleY = 1.25;
      soundManager.playJump();
      particles.createDust(this.x + this.width / 2, this.y + this.height, 6);
    }

    // Variable jump height (releasing jump cuts upward velocity)
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
    if (this.y + this.height >= map.height - 40) {
      this.y = map.height - 40 - this.height;
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
        const wasAbove = prevY + this.height <= p.y + 6;
        const isTouching =
          this.x + this.width > p.x &&
          this.x < p.x + p.width &&
          this.y + this.height >= p.y &&
          this.y + this.height <= p.y + 14;

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
        this.vy = -18.5; // High launch!
        this.isGrounded = false;
        this.scaleX = 0.7;
        this.scaleY = 1.45;
        pad.squash = 0.4; // Compress pad
        soundManager.playBounce();
        particles.createBounceBurst(pad.x + pad.width / 2, pad.y);
      }
    }

    // Portals Collision (pairs A and B)
    if (!this.portalCooldown) this.portalCooldown = 0;
    if (this.portalCooldown > 0) {
      this.portalCooldown--;
    } else {
      for (const portal of map.portals) {
        const dx = (this.x + this.width / 2) - (portal.x + portal.width / 2);
        const dy = (this.y + this.height / 2) - (portal.y + portal.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 32) {
          // Find matching portal
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

  // Smart & Natural Bot AI
  updateBotAI(players, map) {
    this.botTimer--;
    if (this.botTimer > 0) return;
    this.botTimer = Math.floor(Math.random() * 8) + 4; // recalculate frequently

    const itPlayer = players.find(p => p.isIt);
    if (!itPlayer) return;

    if (this.isIt) {
      // BOT IS IT: Chase the closest non-immune runner
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
        // All runners might be immune; chase any other player
        nearest = players.find(p => p.id !== this.id);
      }

      if (nearest) {
        const dx = nearest.x - this.x;
        const dy = nearest.y - this.y;

        this.botDecision.left = dx < -20;
        this.botDecision.right = dx > 20;

        // Jump if target is higher or obstacle in front
        const targetHigher = dy < -40;
        const needsWallJump = Math.abs(this.vx) < 0.8 && (this.botDecision.left || this.botDecision.right);
        this.botDecision.jump = this.isGrounded && (targetHigher || needsWallJump || Math.random() < 0.25);
        this.botDecision.down = dy > 60 && Math.random() < 0.4;
      }
    } else {
      // BOT IS RUNNER: Run away from the IT player!
      const dx = itPlayer.x - this.x;
      const dy = itPlayer.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 320) {
        // Flee in opposite direction
        this.botDecision.left = dx > 0;
        this.botDecision.right = dx < 0;

        // Jump or use platforms when pursued closely
        if (this.isGrounded) {
          const cornerTrap = (this.x < 100 && this.botDecision.left) || (this.x > map.width - 150 && this.botDecision.right);
          this.botDecision.jump = cornerTrap || (itPlayer.y >= this.y && Math.random() < 0.5);
        }
        this.botDecision.down = itPlayer.y < this.y - 40 && Math.random() < 0.45;
      } else {
        // Wander around leisurely
        if (Math.random() < 0.05) {
          this.botDecision.left = Math.random() < 0.5;
          this.botDecision.right = !this.botDecision.left;
        }
        this.botDecision.jump = this.isGrounded && Math.random() < 0.08;
        this.botDecision.down = false;
      }
    }
  }

  // Draw player matching the WeLoPlay black ninja style
  draw(ctx) {
    // Draw ghost trails
    for (const g of this.ghosts) {
      ctx.save();
      ctx.globalAlpha = g.alpha * 0.35;
      ctx.translate(g.x + this.width / 2, g.y + this.height / 2);
      ctx.scale(g.facing * g.scaleX, g.scaleY);
      this.drawBodyShape(ctx, this.color);
      ctx.restore();
    }

    ctx.save();

    // Blinking effect during immunity
    if (this.isImmune && Math.floor(this.immuneTimer / 4) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    // Translate to center of player for squash & stretch
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.scale(this.facing * this.scaleX, this.scaleY);

    // Speed lines behind when moving fast
    if (Math.abs(this.vx) > 4) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-this.width / 2 - 8, -6);
      ctx.lineTo(-this.width / 2 - 20, -6);
      ctx.moveTo(-this.width / 2 - 6, 8);
      ctx.lineTo(-this.width / 2 - 16, 8);
      ctx.stroke();
    }

    // IT Flaming Aura
    if (this.isIt) {
      ctx.shadowColor = '#ff1744';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = '#ff1744';
      ctx.lineWidth = 3;
      this.drawBodyShape(ctx, null, true);
    }

    // 1. Draw Feet (little running pedals)
    const legOffset = Math.sin(this.runCycle) * 6;
    ctx.fillStyle = '#161922';
    // Back foot
    ctx.beginPath();
    ctx.ellipse(-8, this.height / 2 - 2 + legOffset, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Front foot
    ctx.beginPath();
    ctx.ellipse(8, this.height / 2 - 2 - legOffset, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Draw Body (Jet black rounded square with 2 ninja cat-ear horns)
    this.drawBodyShape(ctx, '#161922');

    // 3. Draw Headband & Ribbons
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.width / 2 + 3, -11, this.width - 6, 9); // Forehead band

    // Headband fluttering ribbons on the back side
    const wave = Math.sin(this.ribbonWave) * 4;
    ctx.beginPath();
    ctx.moveTo(-this.width / 2 + 4, -9);
    ctx.quadraticCurveTo(-this.width / 2 - 14, -7 + wave, -this.width / 2 - 22, -12 + wave * 1.5);
    ctx.lineTo(-this.width / 2 - 18, -4 + wave);
    ctx.quadraticCurveTo(-this.width / 2 - 12, -3 + wave, -this.width / 2 + 4, -4);
    ctx.fill();

    // Second ribbon tail
    ctx.beginPath();
    ctx.moveTo(-this.width / 2 + 4, -6);
    ctx.quadraticCurveTo(-this.width / 2 - 10, -2 - wave, -this.width / 2 - 18, 2 - wave);
    ctx.lineTo(-this.width / 2 - 14, 6 - wave);
    ctx.quadraticCurveTo(-this.width / 2 - 8, 3 - wave, -this.width / 2 + 4, -1);
    ctx.fill();

    // 4. Draw Face: Large White Oval Eyes & Black Pupils
    // Eye whites
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(3, -1, 6.5, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(15, -1, 6.5, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupils looking in movement direction
    let pupilShiftX = 2;
    let pupilShiftY = 0;
    if (this.vy < -2) pupilShiftY = -3;
    if (this.vy > 2) pupilShiftY = 3;

    ctx.fillStyle = '#111319';
    ctx.beginPath();
    ctx.ellipse(3 + pupilShiftX, -1 + pupilShiftY, 3.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(15 + pupilShiftX, -1 + pupilShiftY, 3.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye glints (cute reflections)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(4 + pupilShiftX, -3 + pupilShiftY, 1.5, 0, Math.PI * 2);
    ctx.arc(16 + pupilShiftX, -3 + pupilShiftY, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Cute smile mouth
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(9, 9, 3.5, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    ctx.restore();

    // Draw "IT" Bouncing Arrow & Label over player
    if (this.isIt) {
      ctx.save();
      const arrowBob = Math.sin(Date.now() / 150) * 6;
      const arrowY = this.y - 28 + arrowBob;
      const arrowX = this.x + this.width / 2;

      // Drop shadow
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 6;

      // Red Arrow pointing down
      ctx.fillStyle = '#ff1744';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY + 12);
      ctx.lineTo(arrowX - 14, arrowY - 6);
      ctx.lineTo(arrowX - 6, arrowY - 6);
      ctx.lineTo(arrowX - 6, arrowY - 20);
      ctx.lineTo(arrowX + 6, arrowY - 20);
      ctx.lineTo(arrowX + 6, arrowY - 6);
      ctx.lineTo(arrowX + 14, arrowY - 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // "IT!" Text bubble
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 13px "Lilita One", cursive';
      ctx.textAlign = 'center';
      ctx.fillText('IT!', arrowX, arrowY - 26);

      ctx.restore();
    } else {
      // Draw small player color marker above head
      ctx.save();
      ctx.fillStyle = this.color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y - 12, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
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
    ctx.lineTo(-w / 2 - 2, -h / 2 - 4); // left ear tip
    ctx.lineTo(-w / 2 + 10, -h / 2);
    // Top edge
    ctx.lineTo(w / 2 - 10, -h / 2);
    // Top-right horn/ear
    ctx.lineTo(w / 2 + 2, -h / 2 - 4); // right ear tip
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
