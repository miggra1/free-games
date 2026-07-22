/* ============================================================
 * input.js — 键盘 + 手柄输入,提供 held(按住)与 pressed(边沿)
 * 映射:方向键/WASD 移动,Z/J 射击,X/K 跳跃,C/L 手雷,
 *       Enter 开始/暂停,M 静音;手柄 A 跳 X 射击 Y 手雷 Start 暂停
 * ============================================================ */
(function () {
  "use strict";

  const KEYMAP = {
    ArrowLeft:"left", KeyA:"left",
    ArrowRight:"right", KeyD:"right",
    ArrowUp:"up", KeyW:"up",
    ArrowDown:"down", KeyS:"down",
    KeyZ:"fire", KeyJ:"fire",
    KeyX:"jump", KeyK:"jump",
    KeyC:"bomb", KeyL:"bomb",
    Enter:"start",
    KeyM:"mute",
  };

  const held = {}, pressed = {}, prevPad = {};

  window.addEventListener("keydown", (e) => {
    const k = KEYMAP[e.code];
    if (!k) return;
    e.preventDefault();
    if (!held[k]) pressed[k] = true;
    held[k] = true;
  });
  window.addEventListener("keyup", (e) => {
    const k = KEYMAP[e.code];
    if (!k) return;
    e.preventDefault();
    held[k] = false;
  });

  /* 手柄:标准映射(dpad/左摇杆移动,0=A跳,2=X射击,3=Y手雷,1=B射击,9=Start) */
  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && pads[0];
    const state = {};
    if (pad) {
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      state.left  = ax < -0.35 || (pad.buttons[14] && pad.buttons[14].pressed);
      state.right = ax >  0.35 || (pad.buttons[15] && pad.buttons[15].pressed);
      state.up    = ay < -0.5  || (pad.buttons[12] && pad.buttons[12].pressed);
      state.down  = ay >  0.5  || (pad.buttons[13] && pad.buttons[13].pressed);
      state.jump  = pad.buttons[0] && pad.buttons[0].pressed;
      state.fire  = (pad.buttons[2] && pad.buttons[2].pressed) || (pad.buttons[1] && pad.buttons[1].pressed);
      state.bomb  = pad.buttons[3] && pad.buttons[3].pressed;
      state.start = pad.buttons[9] && pad.buttons[9].pressed;
    }
    for (const k of ["left","right","up","down","jump","fire","bomb","start"]) {
      if (state[k]) {
        if (!held[k] && !prevPad[k]) pressed[k] = true;
        held[k] = true;
      } else if (prevPad[k]) {
        // 仅当键盘也没按时才释放
        held[k] = false;
      }
      prevPad[k] = !!state[k];
    }
  }

  window.Input = {
    update() { pollPad(); },
    held(n) { return !!held[n]; },
    pressed(n) { return !!pressed[n]; },
    clear() { for (const k in pressed) pressed[k] = false; },
  };
})();
