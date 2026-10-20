// Entry point: canvas setup, responsive resolution scaling, game loop

import { Game } from './game.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  const game = new Game(canvas);

  // Resize canvas display while maintaining 16:9 internal resolution (1280x720)
  function resize() {
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

    canvas.style.width = `${Math.floor(displayWidth)}px`;
    canvas.style.height = `${Math.floor(displayHeight)}px`;
  }

  window.addEventListener('resize', resize);
  resize();

  // Detect touch device and show on-screen controls
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const touchControls = document.getElementById('touch-controls');
  if (isTouch && touchControls) {
    touchControls.classList.remove('hidden');
  }

  // Main 60fps Game Loop
  let lastTime = performance.now();
  function gameLoop(now) {
    requestAnimationFrame(gameLoop);

    // Delta time management
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    game.update();
    game.render();
  }

  requestAnimationFrame(gameLoop);
});
