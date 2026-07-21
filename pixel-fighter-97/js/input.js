/* input.js — 输入系统（含手柄） */

class Input {
  constructor(map, side) {
    this.map = map; this.side = side; this.prev = {};
    this.buffer = []; this.chargeBack = 0; this.chargeDown = 0; this.gpIdx = -1;
  }
  raw(action) {
    if (this.side === 0 && TOUCH.has(action)) return true;
    if (KEYS.has(this.map[action])) return true;
    if (this.gpIdx >= 0) {
      const gp = navigator.getGamepads ? navigator.getGamepads()[this.gpIdx] : null;
      if (gp) {
        const d = 0.4, ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        const mb = (i) => gp.buttons[i] && gp.buttons[i].pressed;
        const m = {
          left: ax < -d, right: ax > d,
          up: ay < -d || mb(12), down: ay > d || mb(13),
          lp: mb(2), lk: mb(1), hp: mb(3), hk: mb(0),
          sp: mb(5), su: mb(7), dodge: mb(4), charge: mb(6),
          switch: mb(9), start: mb(8), pause: mb(8)
        };
        if (m[action]) return true;
      }
    }
    return false;
  }
  scanGP() {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < gps.length; i++)
      if (gps[i] && this.gpIdx < 0) this.gpIdx = i;
  }
  pressed(action) { return this.raw(action) && !this.prev[action]; }
  dir(facing) {
    const l = this.raw("left"), r = this.raw("right");
    const u = this.raw("up"), d = this.raw("down");
    let x = (r ? 1 : 0) - (l ? 1 : 0);
    let y = (d ? 1 : 0) - (u ? 1 : 0);
    return { x, y, forward: x === facing, back: x === -facing, down: d, up: u };
  }
  tick(facing) {
    const d = this.dir(facing);
    if (d.back) this.chargeBack++; else this.chargeBack = Math.max(0, this.chargeBack - 2);
    if (d.down) this.chargeDown++; else this.chargeDown = Math.max(0, this.chargeDown - 2);
    const code = (d.down ? "D" : d.up ? "U" : "") + (d.forward ? "F" : d.back ? "B" : "");
    if (code && (!this.buffer.length || this.buffer[this.buffer.length - 1].code !== code))
      this.buffer.push({ code, t: G.frame });
    for (const b of ["lp","lk","hp","hk","sp","su","dodge","switch","charge"])
      if (this.pressed(b)) this.buffer.push({ code: b, t: G.frame });
    this.buffer = this.buffer.filter(e => G.frame - e.t < 42);
    for (const k of Object.keys(this.prev)) this.prev[k] = this.raw(k);
  }
  motion(seq, btn) {
    const list = this.buffer.map(e => e.code);
    let j = seq.length - 1;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i] === seq[j]) j--;
      if (j < 0) break;
    }
    const hasBtn = !btn || this.buffer.some(e => e.code === btn && G.frame - e.t < 10);
    return j < 0 && hasBtn;
  }
}
