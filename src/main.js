import { Game } from './game.js';

// Polyfill CanvasRenderingContext2D.prototype.roundRect ONLY when missing
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii = 0) {
    let r = 0;
    if (typeof radii === 'number') {
      r = radii;
    } else if (Array.isArray(radii)) {
      r = radii[0] || 0;
    }
    const maxRadius = Math.min(Math.abs(w) / 2, Math.abs(h) / 2);
    const radius = Math.max(0, Math.min(r, maxRadius));

    if (radius <= 0) {
      this.rect(x, y, w, h);
      return this;
    }

    this.moveTo(x + radius, y);
    this.arcTo(x + w, y, x + w, y + h, radius);
    this.arcTo(x + w, y + h, x, y + h, radius);
    this.arcTo(x, y + h, x, y, radius);
    this.arcTo(x, y, x + w, y, radius);
    return this;
  };
}

function showErrorOverlay(msg) {
  console.error('[TAG GAME ERROR]', msg);
  let box = document.getElementById('debug-error-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'debug-error-box';
    box.style.position = 'fixed';
    box.style.top = '12px';
    box.style.left = '12px';
    box.style.right = '12px';
    box.style.background = 'rgba(235, 59, 71, 0.95)';
    box.style.color = '#ffffff';
    box.style.padding = '12px 18px';
    box.style.fontSize = '14px';
    box.style.zIndex = '999999';
    box.style.borderRadius = '10px';
    box.style.fontFamily = 'monospace';
    box.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
    box.style.whiteSpace = 'pre-wrap';
    box.style.pointerEvents = 'auto';
    box.innerHTML = `<strong>Game Notice:</strong> <span id="debug-error-msg"></span> <button style="margin-left:12px;padding:4px 8px;border-radius:4px;cursor:pointer;background:#fff;color:#111;font-weight:bold;border:none;" onclick="this.parentElement.remove()">Dismiss</button>`;
    document.body.appendChild(box);
  }
  const msgEl = document.getElementById('debug-error-msg');
  if (msgEl) msgEl.textContent = msg;
}
window.showErrorOverlay = showErrorOverlay;

window.addEventListener('error', (event) => {
  console.warn('[Window error caught]:', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.warn('[Promise rejection caught]:', event.reason);
});

let activeGame = null;

function setupCanvasRecovery(canvas, game) {
  let isRecovering = false;

  const recover = () => {
    if (isRecovering) return;
    isRecovering = true;
    console.warn('[TAG] Rebuilding canvas for Safari/WebKit GPU restoration...');

    try {
      const parent = canvas.parentElement;
      if (!parent) return;

      const newCanvas = document.createElement('canvas');
      newCanvas.id = 'game-canvas';
      newCanvas.width = 1280;
      newCanvas.height = 720;
      newCanvas.style.cssText = canvas.style.cssText;

      parent.replaceChild(newCanvas, canvas);

      if (game) {
        game.rebindCanvas(newCanvas);
      }

      setupCanvasRecovery(newCanvas, game);
      console.log('[TAG] Canvas successfully rebuilt and reconnected!');
    } catch (err) {
      console.error('[TAG] Canvas recovery failed:', err);
    } finally {
      setTimeout(() => { isRecovering = false; }, 500);
    }
  };

  canvas.addEventListener('contextlost', (e) => {
    e.preventDefault();
    console.warn('[TAG] Canvas contextlost event received! Auto-recovering in 100ms...');
    setTimeout(recover, 100);
  });

  canvas.addEventListener('contextrestored', () => {
    console.log('[TAG] Canvas contextrestored event fired.');
    if (game) {
      game.ctx = canvas.getContext('2d');
      game.render();
    }
  });
}

function initGame() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    setTimeout(initGame, 50);
    return;
  }

  const game = new Game(canvas);
  activeGame = game;
  window.game = game;

  setupCanvasRecovery(canvas, game);

  // Auto-join online room if URL contains ?room=CODE
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      setTimeout(() => {
        game.joinOnlineRoom(roomParam.trim().toUpperCase());
      }, 500);
    }
  } catch (e) {
    console.warn('[AutoJoin error]:', e);
  }

  // Resize canvas display while maintaining 16:9 internal resolution (1280x720)
  function resize() {
    const c = document.getElementById('game-canvas') || canvas;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const targetAspect = 1280 / 720;
    const windowAspect = windowWidth / windowHeight;

    let displayWidth, displayHeight;
    if (windowAspect > targetAspect) {
      displayHeight = windowHeight;
      displayWidth = windowHeight * targetAspect;
    } else {
      displayWidth = windowWidth;
      displayHeight = windowWidth / targetAspect;
    }

    c.style.width = `${Math.floor(displayWidth)}px`;
    c.style.height = `${Math.floor(displayHeight)}px`;
  }

  window.addEventListener('resize', resize);
  resize();

  // Detect touch device and show on-screen controls
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const touchControls = document.getElementById('touch-controls');
  if (isTouch && touchControls) {
    touchControls.classList.remove('hidden');
  }

  // Bind virtual touch D-pad to game.keys
  const touchButtons = document.querySelectorAll('.touch-btn');
  touchButtons.forEach(btn => {
    const key = btn.dataset.key;
    if (!key) return;

    const press = (e) => {
      if (e.cancelable) e.preventDefault();
      game.keys.add(key);
      game.keys.add(key.toUpperCase());
    };

    const release = (e) => {
      if (e.cancelable) e.preventDefault();
      game.keys.delete(key);
      game.keys.delete(key.toUpperCase());
    };

    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
  });

  // Fixed 60Hz Timestep Physics Accumulator
  // Guarantees 100% identical player movement speed across all platforms (Windows vs Mac)
  // and all monitor refresh rates (60Hz, 75Hz, 120Hz, 144Hz, 165Hz, 240Hz).
  const FIXED_STEP_MS = 1000 / 60; // 16.66667ms per physics tick
  const MAX_ACCUMULATOR_MS = 100; // Cap to prevent spiral-of-death when tab is backgrounded
  let lastFrameTime = performance.now();
  let accumulator = 0;

  function gameLoop(now) {
    requestAnimationFrame(gameLoop);

    if (!now) now = performance.now();
    let delta = now - lastFrameTime;
    lastFrameTime = now;

    // Safety clamp delta if tab was hidden or suspended
    if (delta > MAX_ACCUMULATOR_MS) {
      delta = MAX_ACCUMULATOR_MS;
    } else if (delta < 0) {
      delta = 0;
    }

    accumulator += delta;

    // Run physics simulation at strictly 60 ticks per second
    let safetyCounter = 0;
    while (accumulator >= FIXED_STEP_MS && safetyCounter < 10) {
      try {
        game.update();
      } catch (err) {
        console.warn('[Game update error]:', err);
      }
      accumulator -= FIXED_STEP_MS;
      safetyCounter++;
    }

    if (safetyCounter >= 10) {
      accumulator = 0;
    }

    // Render every animation frame for maximum visual smoothness on high-refresh displays
    try {
      game.render();
    } catch (err) {
      console.warn('[Game render error]:', err);
    }
  }

  requestAnimationFrame(gameLoop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
