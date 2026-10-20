// Particle effects system for Tag

export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  // Add dust puff when jumping or landing
  createDust(x, y, count = 5, color = 'rgba(255, 255, 255, 0.7)') {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 2.5,
        vy: -Math.random() * 2 - 0.5,
        radius: Math.random() * 5 + 4,
        alpha: 0.8,
        decay: Math.random() * 0.04 + 0.03,
        color: color,
        type: 'dust'
      });
    }
  }

  // Tag impact comic starburst
  createTagBurst(x, y) {
    const colors = ['#ff3366', '#ffd000', '#00e676', '#38bdf8', '#ffffff'];
    for (let i = 0; i < 30; i++) {
      const angle = (Math.PI * 2 * i) / 30 + (Math.random() - 0.5) * 0.3;
      const speed = Math.random() * 6 + 3;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 6 + 3,
        alpha: 1,
        decay: Math.random() * 0.025 + 0.02,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: 'star',
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.2
      });
    }
  }

  // Bounce pad burst
  createBounceBurst(x, y, color = '#ff9100') {
    for (let i = 0; i < 12; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 4 - 2,
        radius: Math.random() * 4 + 3,
        alpha: 0.9,
        decay: 0.03,
        color: color,
        type: 'circle'
      });
    }
  }

  // Teleport swirl
  createTeleportSwirl(x, y, color = '#e040fb') {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 25 + 10;
      this.particles.push({
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        vx: -Math.cos(angle) * 2,
        vy: -Math.sin(angle) * 2 - 1,
        radius: Math.random() * 4 + 2,
        alpha: 1,
        decay: 0.035,
        color: color,
        type: 'glow'
      });
    }
  }

  // Confetti cannon for winners
  createConfetti(x, y, count = 80) {
    const colors = ['#e63946', '#ffd166', '#06d6a0', '#118ab2', '#a855f7', '#ff70a6'];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 12 - 5,
        width: Math.random() * 8 + 6,
        height: Math.random() * 6 + 4,
        alpha: 1,
        decay: 0.008,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: 'confetti',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.3,
        gravity: 0.28
      });
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;

      if (p.type === 'confetti') {
        p.vy += p.gravity || 0.25;
        p.vx *= 0.98;
        p.rotation += p.vRot;
      } else if (p.type === 'star') {
        p.rotation += p.vRot;
        p.vy += 0.15;
      } else if (p.type === 'dust') {
        p.radius *= 0.96;
      }

      if (p.alpha <= 0 || p.radius <= 0.5) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.alpha);

      if (p.type === 'confetti') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        ctx.restore();
      } else if (p.type === 'star') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        // Draw 4-point comic star
        ctx.beginPath();
        const r = p.radius;
        ctx.moveTo(0, -r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.quadraticCurveTo(0, 0, 0, r);
        ctx.quadraticCurveTo(0, 0, -r, 0);
        ctx.quadraticCurveTo(0, 0, 0, -r);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'glow') {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
