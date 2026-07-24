/**
 * Raiden II - Core Engine
 * Game loop, input, canvas, state management
 */

const W = 480, H = 720;
const FPS = 60;
const DT = 1 / 60;

const KEY_UP = 0, KEY_DOWN = 1, KEY_LEFT = 2, KEY_RIGHT = 3;
const KEY_SHOT = 4, KEY_BOMB = 5, KEY_START = 6, KEY_PAUSE = 7;

class Input {
  constructor() {
    this.keys = new Array(8).fill(false);
    this.pressed = new Array(8).fill(false);
    this.justPressed = new Array(8).fill(false);
    this._bindings = {
      ArrowUp: KEY_UP, ArrowDown: KEY_DOWN, ArrowLeft: KEY_LEFT, ArrowRight: KEY_RIGHT,
      KeyW: KEY_UP, KeyS: KEY_DOWN, KeyA: KEY_LEFT, KeyD: KEY_RIGHT,
      KeyZ: KEY_SHOT, Space: KEY_SHOT, KeyX: KEY_BOMB, ShiftLeft: KEY_BOMB,
      Enter: KEY_START, Escape: KEY_PAUSE,
    };
    this._gamepadIndex = null;
    this._axisDeadzone = 0.3;

    window.addEventListener("keydown", (e) => {
      const idx = this._bindings[e.code];
      if (idx !== undefined) {
        e.preventDefault();
        if (!this.keys[idx]) this.justPressed[idx] = true;
        this.keys[idx] = true;
      }
    });
    window.addEventListener("keyup", (e) => {
      const idx = this._bindings[e.code];
      if (idx !== undefined) {
        e.preventDefault();
        this.keys[idx] = false;
      }
    });

    window.addEventListener("gamepadconnected", (e) => {
      this._gamepadIndex = e.gamepad.index;
    });
    window.addEventListener("gamepaddisconnected", () => {
      this._gamepadIndex = null;
    });
  }

  update() {
    this.pressed.fill(false);

    // Keyboard
    for (let i = 0; i < 8; i++) {
      if (this.keys[i]) this.pressed[i] = true;
    }

    // Gamepad
    if (this._gamepadIndex !== null) {
      const gp = navigator.getGamepads()[this._gamepadIndex];
      if (gp) {
        const ax = gp.axes;
        this.pressed[KEY_LEFT] = this.pressed[KEY_LEFT] || (ax[0] || 0) < -this._axisDeadzone;
        this.pressed[KEY_RIGHT] = this.pressed[KEY_RIGHT] || (ax[0] || 0) > this._axisDeadzone;
        this.pressed[KEY_UP] = this.pressed[KEY_UP] || (ax[1] || 0) < -this._axisDeadzone;
        this.pressed[KEY_DOWN] = this.pressed[KEY_DOWN] || (ax[1] || 0) > this._axisDeadzone;
        for (let i = 0; i < Math.min(gp.buttons.length, 12); i++) {
          if (gp.buttons[i].pressed) {
            if (i === 0 || i === 2) this.pressed[KEY_SHOT] = true;
            if (i === 1 || i === 3) this.pressed[KEY_BOMB] = true;
            if (i === 7 || i === 9) this.pressed[KEY_START] = true;
            if (i === 6 || i === 8) this.pressed[KEY_PAUSE] = true;
          }
        }
      }
    }
  }

  clearJustPressed() { this.justPressed.fill(false); }

  isDown(idx) { return this.pressed[idx]; }
  isJustPressed(idx) { return this.justPressed[idx]; }
}

const input = new Input();

function setupCanvas(id) {
  const canvas = document.getElementById(id);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function startGameLoop(fn) {
  let last = performance.now();
  function loop(now) {
    const elapsed = now - last;
    last = now;
    input.update();
    fn(Math.min(elapsed / 1000, 0.1));
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
