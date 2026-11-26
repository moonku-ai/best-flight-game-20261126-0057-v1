// input.js — keyboard + mouse input that never loses a key release.
// (guizang-game-skill pitfall: lost keyup events.) Keys are tracked in a
// Set; the game reads intent each frame, it never trusts single events.
export function createInput() {
  const keys = new Set();
  const mouse = { x: 0, y: 0, active: false, lastMove: 0 };
  let paused = false;

  const GAME_KEYS = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
    'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyC', 'KeyP', 'KeyR', 'KeyM',
  ]);

  function onKeyDown(e) {
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
  }
  function onKeyUp(e) {
    if (!GAME_KEYS.has(e.code)) return;
    keys.delete(e.code);
  }
  function onBlur() { keys.clear(); mouse.active = false; }
  function onMouseMove(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    mouse.active = true;
    mouse.lastMove = performance.now();
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('mousemove', onMouseMove);

  // One-shot edge: was the key pressed since the last frame read?
  const pressedEdges = new Set();
  const edgeListener = (e) => {
    if (GAME_KEYS.has(e.code) && !e.repeat) pressedEdges.add(e.code);
  };
  window.addEventListener('keydown', edgeListener);

  return {
    keys,
    mouse,
    get paused() { return paused; },
    set paused(v) { paused = v; },
    // Read + clear the edge set once per frame.
    consumeEdges() {
      const out = new Set(pressedEdges);
      pressedEdges.clear();
      return out;
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', edgeListener);
    },
  };
}
