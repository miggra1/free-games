"use strict";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const bootStatus = document.querySelector("#bootStatus");
ctx.imageSmoothingEnabled = false;

const W = canvas.width;
const H = canvas.height;
const FLOOR = 430;
const GRAVITY = 0.72;
const ROUND_TIME = 60;
const TEAM_SIZE = 3;
const KEYS = new Set();
const TOUCH = new Set();
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sign = (v) => (v < 0 ? -1 : 1);

function setBootStatus(text, status = "") {
  if (!bootStatus) return;
  bootStatus.textContent = text;
  bootStatus.className = `boot-status ${status}`.trim();
}
setBootStatus("Script loaded");

const P1_KEYS = {
  left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS",
  lp: "KeyU", lk: "KeyJ", hp: "KeyI", hk: "KeyK", sp: "KeyO", su: "KeyL",
  dodge: "KeyQ", charge: "KeyE", switch: "ShiftLeft", start: "Enter"
};
const P2_KEYS = {
  left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown",
  lp: "Numpad1", lk: "Numpad2", hp: "Numpad4", hk: "Numpad5", sp: "Numpad6", su: "Numpad0",
  dodge: "Numpad3", charge: "NumpadAdd", switch: "NumpadEnter", start: "Space"
};

const CHARACTERS = [
  {
    id: "kyoji", name: "草焰京介", role: "近身压制", body: "#273c7a", skin: "#f0bd86", hair: "#221913", trim: "#f04e36",
    speed: 4.45, jump: 14.2, weight: 1, reach: 1.02, power: 1.0, projectile: "fire",
    quote: "火拳、滑步、强取消。"
  },
  {
    id: "maiha", name: "不知舞华", role: "高速牵制", body: "#b91e36", skin: "#f4c48a", hair: "#61371b", trim: "#ffd56b",
    speed: 5.15, jump: 15.4, weight: 0.92, reach: 0.92, power: 0.88, projectile: "fan",
    quote: "快跳、空压、扇影突进。"
  },
  {
    id: "daimon", name: "大门刚藏", role: "投技反击", body: "#f1f1d8", skin: "#dca66d", hair: "#1c1711", trim: "#0c4f50",
    speed: 3.35, jump: 12.3, weight: 1.25, reach: 1.16, power: 1.2, projectile: "quake",
    quote: "近身投、霸体重击。"
  },
  {
    id: "ioriha", name: "八神庵影", role: "残影连段", body: "#171417", skin: "#e8ad7a", hair: "#8f1828", trim: "#c6d1e8",
    speed: 4.8, jump: 14.0, weight: 1, reach: 1.05, power: 1.06, projectile: "purple",
    quote: "鬼步、爪击、紫炎爆发。"
  },
  {
    id: "benrei", name: "二阶堂雷", role: "电流远控", body: "#f0d64f", skin: "#f3bf82", hair: "#e8e5c2", trim: "#2b2b64",
    speed: 4.35, jump: 13.7, weight: 0.96, reach: 1.0, power: 0.96, projectile: "bolt",
    quote: "电球、对空、蓄气快。"
  },
  {
    id: "boss", name: "黑月卢卡", role: "最终Boss", body: "#302446", skin: "#d7b28d", hair: "#f4f4f8", trim: "#8effd2",
    speed: 4.65, jump: 13.9, weight: 1.05, reach: 1.24, power: 1.18, projectile: "void",
    quote: "长手、瞬移、暗月超杀。"
  }
];

const MOVES = {
  lp: { label: "轻拳", start: 4, active: 5, recover: 9, dmg: 24, stun: 14, block: 9, push: 3, w: 48, h: 20, y: -80, cancel: true, hitStop: 5, sfx: "tap" },
  lk: { label: "轻脚", start: 5, active: 5, recover: 10, dmg: 22, stun: 13, block: 9, push: 3.4, w: 52, h: 22, y: -48, cancel: true, hitStop: 5, sfx: "tap" },
  hp: { label: "重拳", start: 8, active: 6, recover: 18, dmg: 48, stun: 22, block: 15, push: 6, w: 68, h: 26, y: -82, launch: 1, cancel: true, hitStop: 9, sfx: "heavy" },
  hk: { label: "重脚", start: 10, active: 7, recover: 19, dmg: 52, stun: 22, block: 16, push: 6.5, w: 76, h: 25, y: -55, knock: 5, cancel: true, hitStop: 10, sfx: "heavy" },
  throw: { label: "投技", start: 4, active: 3, recover: 23, dmg: 72, stun: 34, block: 0, push: 12, w: 42, h: 78, y: -88, throw: true, hitStop: 12, sfx: "throw" },
  upper: { label: "升龙裂", start: 5, active: 10, recover: 25, dmg: 78, stun: 30, block: 22, push: 8, w: 62, h: 92, y: -110, invuln: 10, launch: 8, special: true, cost: 0, hitStop: 12, sfx: "slash" },
  wave: { label: "气功波", start: 12, active: 4, recover: 23, dmg: 64, stun: 24, block: 17, push: 8, projectile: true, special: true, cost: 0, hitStop: 9, sfx: "wave" },
  rush: { label: "荒咬突", start: 7, active: 15, recover: 20, dmg: 82, stun: 29, block: 18, push: 10, w: 70, h: 52, y: -70, vx: 8.5, special: true, cancel: true, hitStop: 12, sfx: "rush" },
  quake: { label: "地裂震", start: 15, active: 10, recover: 27, dmg: 88, stun: 34, block: 24, push: 13, w: 116, h: 36, y: -28, ground: true, special: true, hitStop: 14, sfx: "quake" },
  super: { label: "MAX超必杀", start: 6, active: 38, recover: 34, dmg: 168, stun: 46, block: 30, push: 15, w: 118, h: 96, y: -106, super: true, cost: 100, invuln: 16, hitStop: 18, sfx: "super" }
};

class AudioArcade {
  constructor() { this.ctx = null; this.master = null; this.musicTimer = 0; }
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.28;
    this.master.connect(this.ctx.destination);
  }
  tone(freq, dur, type = "square", gain = 0.18, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur);
  }
  noise(dur, gain = 0.16) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.buffer = buf; src.connect(g); g.connect(this.master); src.start(); src.stop(this.ctx.currentTime + dur);
  }
  sfx(name) {
    this.init();
    if (name === "tap") { this.tone(280, .04, "square", .09, -80); }
    if (name === "heavy") { this.noise(.06, .18); this.tone(95, .09, "sawtooth", .16, -25); }
    if (name === "block") { this.noise(.045, .11); this.tone(160, .05, "triangle", .1); }
    if (name === "wave") { this.tone(180, .12, "sawtooth", .14, 240); this.tone(360, .1, "square", .08, 320); }
    if (name === "rush") { this.noise(.07, .14); this.tone(410, .08, "square", .12, -170); }
    if (name === "slash") { this.tone(740, .08, "sawtooth", .12, -360); this.noise(.04, .08); }
    if (name === "quake") { this.tone(62, .18, "sawtooth", .2, -18); this.noise(.09, .12); }
    if (name === "throw") { this.tone(120, .12, "square", .16, -50); this.noise(.07, .13); }
    if (name === "super") { this.tone(110, .28, "sawtooth", .2, 560); this.tone(660, .2, "square", .11, -240); }
    if (name === "ko") { this.tone(190, .18, "square", .2, -90); setTimeout(() => this.tone(80, .5, "sawtooth", .22, -28), 120); }
    if (name === "select") { this.tone(520, .05, "square", .11, 120); }
  }
  music(frame, intense) {
    if (!this.ctx || frame < this.musicTimer) return;
    this.musicTimer = frame + (intense ? 16 : 24);
    const bar = Math.floor(frame / 24) % 16;
    const bass = [82, 82, 98, 110, 123, 110, 98, 82, 73, 82, 98, 147, 123, 110, 98, 82][bar];
    this.tone(bass, .08, "square", .035);
    if (bar % 4 === 0) this.tone(bass * 4, .05, "triangle", .028);
  }
}
const audio = new AudioArcade();

class Input {
  constructor(map, side) {
    this.map = map; this.side = side; this.prev = {}; this.buffer = []; this.chargeBack = 0; this.chargeDown = 0;
  }
  raw(action) {
    if (this.side === 0 && TOUCH.has(action)) return true;
    return KEYS.has(this.map[action]);
  }
  pressed(action) { return this.raw(action) && !this.prev[action]; }
  dir(facing) {
    const l = this.raw("left"), r = this.raw("right"), u = this.raw("up"), d = this.raw("down");
    let x = (r ? 1 : 0) - (l ? 1 : 0);
    let y = (d ? 1 : 0) - (u ? 1 : 0);
    const forward = x === facing, back = x === -facing;
    return { x, y, forward, back, down: d, up: u };
  }
  tick(facing) {
    const d = this.dir(facing);
    if (d.back) this.chargeBack++; else this.chargeBack = Math.max(0, this.chargeBack - 2);
    if (d.down) this.chargeDown++; else this.chargeDown = Math.max(0, this.chargeDown - 2);
    const code = (d.down ? "D" : d.up ? "U" : "") + (d.forward ? "F" : d.back ? "B" : "");
    if (code && (!this.buffer.length || this.buffer[this.buffer.length - 1].code !== code)) this.buffer.push({ code, t: game.frame });
    for (const b of ["lp","lk","hp","hk","sp","su","dodge","switch","charge"]) {
      if (this.pressed(b)) this.buffer.push({ code: b, t: game.frame });
      this.prev[b] = this.raw(b);
    }
    this.buffer = this.buffer.filter(e => game.frame - e.t < 42);
  }
  motion(seq, button) {
    const list = this.buffer.map(e => e.code);
    let j = seq.length - 1;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i] === seq[j]) j--;
      if (j < 0) break;
    }
    const hasBtn = !button || this.buffer.some(e => e.code === button && game.frame - e.t < 10);
    return j < 0 && hasBtn;
  }
  endFrame() {
    for (const k of Object.keys(this.prev)) this.prev[k] = this.raw(k);
  }
}

class Fighter {
  constructor(team, side, input, ai = false) {
    this.team = team; this.side = side; this.input = input; this.ai = ai; this.index = 0; this.wins = 0;
    this.hpStock = team.map(() => 1000);
    this.spawn();
  }
  get data() { return CHARACTERS[this.team[this.index]]; }
  spawn(keepMeter = true) {
    const meter = keepMeter ? (this.meter || 0) : 0;
    this.x = this.side === 0 ? 250 : 710; this.y = FLOOR; this.vx = 0; this.vy = 0; this.facing = this.side === 0 ? 1 : -1;
    this.hp = this.hpStock[this.index] || 1000; this.maxHp = 1000; this.meter = meter; this.state = "intro"; this.frame = 0; this.move = null;
    this.hitStun = 0; this.blockStun = 0; this.invuln = 24; this.dead = false; this.combo = 0; this.lastHit = 0; this.hitOnce = false;
    this.width = this.data.id === "daimon" ? 72 : this.data.id === "maiha" ? 52 : 60;
    this.height = this.data.id === "daimon" ? 142 : this.data.id === "maiha" ? 124 : 134;
    this.afterImage = []; this.cancelWindow = 0; this.air = false; this.downTimer = 0; this.orderFlash = 60;
  }
  readyAt(x) { this.x = x; this.y = FLOOR; this.state = "idle"; this.frame = 0; this.hp = this.maxHp; }
  switchMember() {
    const alive = this.hpStock.some((hp, i) => i !== this.index && hp > 0);
    if (!alive || !this.canAct()) return false;
    this.hpStock[this.index] = this.hp;
    for (let step = 1; step <= this.team.length; step++) {
      const next = (this.index + step) % this.team.length;
      if (this.hpStock[next] > 0) {
        this.index = next;
        this.spawn(true);
        this.readyAt(this.side === 0 ? 225 : 735);
        this.hp = this.hpStock[this.index];
        this.invuln = 34;
        this.state = "dodge";
        game.message = `${this.data.name} 换入`;
        game.messageTimer = 56;
        audio.sfx("rush");
        return true;
      }
    }
    return false;
  }
  canAct() { return ["idle","walk","run","crouch","jump","land"].includes(this.state) && this.hitStun <= 0 && this.blockStun <= 0 && !this.dead; }
  hurtbox() {
    const crouch = this.state === "crouch" || (this.input && this.input.raw("down"));
    return { x: this.x - this.width / 2, y: this.y - (crouch ? this.height * .68 : this.height), w: this.width, h: crouch ? this.height * .68 : this.height };
  }
  attackBox() {
    if (!this.move || this.state !== "attack") return null;
    const m = MOVES[this.move];
    const active = this.frame >= m.start && this.frame < m.start + m.active;
    if (!active || m.projectile) return null;
    const reach = m.w * this.data.reach;
    return {
      x: this.x + this.facing * (this.width * .35),
      y: this.y + m.y,
      w: reach * this.facing,
      h: m.h,
      move: this.move
    };
  }
  startMove(name, forced = false) {
    if (!forced && !this.canAct()) {
      if (this.cancelWindow > 0 && MOVES[name].special) { this.state = "attack"; }
      else return false;
    }
    const m = MOVES[name];
    if (m.cost && this.meter < m.cost) return false;
    if (m.cost) this.meter -= m.cost;
    this.state = "attack"; this.move = name; this.frame = 0; this.hitOnce = false; this.invuln = Math.max(this.invuln, m.invuln || 0);
    if (m.vx) this.vx = this.facing * m.vx;
    if (name === "super") {
      game.flash = 18; game.slow = 12; this.afterImage.push({ x: this.x, y: this.y, life: 20, color: this.data.trim });
    }
    audio.sfx(m.sfx);
    return true;
  }
  launchProjectile() {
    const type = this.data.projectile;
    game.projectiles.push({
      owner: this, x: this.x + this.facing * 54, y: this.y - 78,
      vx: this.facing * (type === "fan" ? 8.5 : type === "void" ? 6.2 : 7.2),
      w: type === "quake" ? 96 : 48, h: type === "quake" ? 24 : 34,
      dmg: type === "void" ? 78 : 58, life: 92, type, hit: false
    });
  }
  tick(opponent) {
    this.facing = this.x < opponent.x ? 1 : -1;
    if (this.input) this.input.tick(this.facing);
    if (this.invuln > 0) this.invuln--;
    if (this.cancelWindow > 0) this.cancelWindow--;
    this.afterImage.forEach(a => a.life--); this.afterImage = this.afterImage.filter(a => a.life > 0);
    if (game.frame - this.lastHit > 80) this.combo = 0;

    if (this.dead) { this.frame++; this.vx *= .88; this.physics(); return; }
    if (this.hitStun > 0) { this.hitStun--; this.frame++; this.physics(); return; }
    if (this.blockStun > 0) { this.blockStun--; this.frame++; this.vx *= .78; this.physics(); return; }
    if (this.ai) this.aiThink(opponent);

    const d = this.input ? this.input.dir(this.facing) : { x: 0, y: 0, forward: false, back: false, down: false, up: false };
    if (this.state === "intro") { this.frame++; if (this.frame > 50) this.state = "idle"; return; }
    if (this.state === "down") {
      this.downTimer--; this.vx *= .88; this.physics();
      if (this.downTimer <= 0) { this.state = "rise"; this.frame = 0; this.invuln = 24; }
      return;
    }
    if (this.state === "rise") { this.frame++; if (this.frame > 22) this.state = "idle"; return; }

    if (this.state === "attack") {
      const m = MOVES[this.move];
      if (this.move === "wave" && this.frame === m.start) this.launchProjectile();
      if (this.move === "quake" && this.frame === m.start + 2) {
        game.effects.push({ type: "quake", x: this.x + this.facing * 80, y: FLOOR - 10, life: 30, color: this.data.trim });
      }
      this.frame++;
      if (this.frame >= m.start + m.active + m.recover) { this.state = "idle"; this.move = null; this.frame = 0; this.vx *= .2; }
      this.physics(); return;
    }

    if (this.input && this.input.raw("charge") && this.state !== "jump") {
      this.state = "charge"; this.meter = clamp(this.meter + (this.data.id === "benrei" ? 0.8 : 0.55), 0, 300);
      game.effects.push({ type: "spark", x: this.x + rand(-24,24), y: this.y - rand(40,120), life: 14, color: this.data.trim });
      this.frame++; return;
    }
    if (this.state === "charge" && (!this.input || !this.input.raw("charge"))) this.state = "idle";

    this.handleActions(d, opponent);
    if (this.state === "attack") { this.physics(); return; }

    if (this.input && this.input.pressed("dodge") && this.y >= FLOOR) {
      this.state = "dodge"; this.frame = 0; this.invuln = 18; this.vx = this.facing * (d.back ? -7 : 7); audio.sfx("rush");
    }
    if (this.state === "dodge") {
      this.frame++; this.vx *= .93; if (this.frame > 24) this.state = "idle"; this.physics(); return;
    }

    if (d.up && this.y >= FLOOR && this.state !== "jump") {
      this.vy = -this.data.jump; this.vx = d.x * this.data.speed * .85; this.state = "jump"; this.frame = 0;
    } else if (this.y < FLOOR) {
      this.state = "jump"; this.vx += d.x * .3; this.vx = clamp(this.vx, -this.data.speed * 1.35, this.data.speed * 1.35);
    } else if (d.down) {
      this.state = "crouch"; this.vx *= .72;
    } else if (d.x) {
      const running = d.forward && this.input && (this.input.motion(["F","F"]) || this.input.raw("right") && this.side === 0 && KEYS.has("KeyD"));
      this.state = running ? "run" : "walk";
      this.vx = d.x * this.data.speed * (running ? 1.45 : 1);
    } else {
      this.state = "idle"; this.vx *= .75;
    }
    this.frame++;
    this.physics();
  }
  handleActions(d, opponent) {
    if (!this.input) return;
    if (this.input.pressed("switch")) {
      if (this.switchMember()) return;
    }
    const near = Math.abs(this.x - opponent.x) < 78 && Math.abs(this.y - opponent.y) < 28;
    if (this.input.motion(["D","DF","F"], "su") || this.input.motion(["D","DF","F"], "hp") && this.input.raw("lk")) { this.startMove("super"); return; }
    if (this.input.motion(["F","D","DF"], "hp") || this.input.chargeDown > 34 && d.up && this.input.pressed("hp")) { this.startMove("upper"); return; }
    if (this.input.motion(["D","DF","F"], "sp") || this.input.motion(["D","DF","F"], "lp")) { this.startMove("wave"); return; }
    if (this.input.motion(["D","DB","B"], "sp") || this.input.chargeBack > 40 && d.forward && this.input.pressed("sp")) {
      this.startMove(this.data.id === "daimon" ? "quake" : "rush"); return;
    }
    if (near && d.forward && (this.input.pressed("hp") || this.input.pressed("hk"))) { this.startMove("throw"); return; }
    for (const b of ["lp","lk","hp","hk"]) if (this.input.pressed(b)) { this.startMove(b); return; }
  }
  aiThink(opponent) {
    const ai = this.input;
    ai.prev = ai.prev || {};
    const dist = Math.abs(opponent.x - this.x);
    const hard = game.aiLevel;
    const chance = hard === 3 ? .75 : hard === 2 ? .45 : .25;
    ai.fake = ai.fake || {};
    Object.keys(P2_KEYS).forEach(k => ai.fake[k] = false);
    if (this.hitStun || this.blockStun) return;
    if (dist > 250) {
      ai.fake[this.x < opponent.x ? "right" : "left"] = true;
      if (this.canAct() && Math.random() < .012 * hard) this.startMove("wave");
    }
    else if (dist > 105) {
      if (Math.random() < .55) ai.fake[this.x < opponent.x ? "right" : "left"] = true;
      if (this.canAct() && Math.random() < .018 * hard) this.startMove(Math.random() < .5 ? "wave" : "rush");
      if (opponent.y < FLOOR - 50 && Math.random() < .04 * hard) ai.fake.hp = true;
    } else {
      if (opponent.state === "attack" && Math.random() < .04 * hard) ai.fake.dodge = true;
      if (Math.random() < .018 * hard) ai.fake.down = true;
      if (Math.random() < .035 * chance) ai.fake.hp = true;
      else if (Math.random() < .05 * chance) ai.fake.lk = true;
      else if (this.canAct() && Math.random() < .018 * hard) this.startMove(this.data.id === "daimon" ? "quake" : "upper");
      if (this.meter >= 100 && this.canAct() && Math.random() < .01 * hard) this.startMove("super");
    }
    ai.raw = (action) => !!ai.fake[action];
  }
  physics() {
    this.vy += GRAVITY * this.data.weight;
    this.x += this.vx; this.y += this.vy;
    if (this.y >= FLOOR) { this.y = FLOOR; this.vy = 0; if (this.state === "jump") { this.state = "land"; this.frame = 0; } }
    this.x = clamp(this.x, 55, W - 55);
  }
  receiveHit(attacker, moveName, projectile = null) {
    if (this.invuln > 0) return false;
    const m = MOVES[moveName] || { dmg: projectile.dmg, stun: 20, block: 15, push: 6, hitStop: 8, sfx: "wave" };
    const d = this.input ? this.input.dir(this.facing) : {};
    const blocking = this.y >= FLOOR && d.back && !m.throw && this.state !== "attack";
    if (blocking) {
      this.blockStun = m.block || 12; this.vx = attacker.facing * (m.push || 5) * .55; attacker.meter = clamp(attacker.meter + 8, 0, 300);
      game.hitStop = Math.max(game.hitStop, Math.floor((m.hitStop || 6) * .55)); game.shake = Math.max(game.shake, 4);
      game.effects.push({ type: "block", x: (this.x + attacker.x) / 2, y: this.y - 78, life: 18, color: "#9fd8ff" });
      audio.sfx("block"); return true;
    }
    const dmg = Math.floor((m.dmg || projectile.dmg) * attacker.data.power * (game.training ? 0.75 : 1));
    this.hp = clamp(this.hp - dmg, 0, this.maxHp);
    this.hpStock[this.index] = this.hp;
    this.hitStun = m.stun || 18; this.vx = attacker.facing * (m.push || 7); this.vy = -(m.launch || m.knock || 0);
    this.state = this.hp <= 0 ? "ko" : (m.knock || m.throw || this.hp <= 0 ? "down" : "hurt");
    this.downTimer = m.throw ? 34 : m.knock ? 42 : 0;
    attacker.meter = clamp(attacker.meter + (m.super ? 0 : 14), 0, 300);
    attacker.combo = game.frame - attacker.lastHit < 72 ? attacker.combo + 1 : 1;
    attacker.lastHit = game.frame; attacker.cancelWindow = m.cancel ? 18 : 0;
    game.hitStop = Math.max(game.hitStop, m.hitStop || 8); game.shake = Math.max(game.shake, m.super ? 16 : m.dmg > 60 ? 10 : 6);
    game.effects.push({ type: m.super ? "superhit" : "hit", x: this.x - this.facing * 28, y: this.y - rand(60,100), life: m.super ? 34 : 18, color: attacker.data.trim });
    if (m.super) for (let i = 0; i < 10; i++) game.effects.push({ type: "spark", x: this.x + rand(-65,65), y: this.y - rand(20,145), life: rand(12,28), color: attacker.data.trim });
    audio.sfx(m.sfx || "heavy");
    if (this.hp <= 0) { this.dead = true; audio.sfx("ko"); }
    return true;
  }
}

function rectsOverlap(a, b) {
  const ax = a.w < 0 ? a.x + a.w : a.x, aw = Math.abs(a.w);
  return ax < b.x + b.w && ax + aw > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

const game = {
  frame: 0, state: "title", mode: "arcade", menu: 0, selectCursor: [0, 3], chosen: [[], []], orderCursor: [0, 0],
  p1: null, p2: null, round: 1, time: ROUND_TIME * 60, message: "READY", messageTimer: 0, hitStop: 0, slow: 0, shake: 0, flash: 0,
  projectiles: [], effects: [], particles: [], aiLevel: 2, training: false, arcadeStage: 1, finalBoss: false, winner: null,
  settings: { roundTime: 60, ai: 2, sound: true }
};

function resetMatch(mode = game.mode) {
  game.mode = mode; game.training = mode === "training"; game.aiLevel = mode === "arcade" && game.arcadeStage >= 4 ? 3 : game.settings.ai;
  const p1Team = game.chosen[0].length ? game.chosen[0] : [0, 1, 4];
  let p2Team = game.chosen[1].length ? game.chosen[1] : [3, 2, 5];
  if (mode === "arcade" && game.arcadeStage >= 5) p2Team = [5, 3, 5];
  game.p1 = new Fighter(p1Team, 0, new Input(P1_KEYS, 0), false);
  game.p2 = new Fighter(p2Team, 1, new Input(P2_KEYS, 1), mode !== "versus");
  game.p1.readyAt(250); game.p2.readyAt(710); game.p1.hp = 1000; game.p2.hp = 1000;
  game.p1.hpStock = game.p1.team.map(() => 1000); game.p2.hpStock = game.p2.team.map(() => 1000);
  game.round = 1; game.time = game.settings.roundTime * 60; game.projectiles = []; game.effects = []; game.winner = null;
  game.message = mode === "training" ? "TRAINING" : "ROUND 1"; game.messageTimer = 100; game.state = "fight";
}

function nextMember(f) {
  f.hpStock[f.index] = 0;
  f.index++;
  if (f.index >= f.team.length) return false;
  const meter = f.meter;
  f.hp = 1000; f.spawn(true); f.meter = meter; f.readyAt(f.side === 0 ? 235 : 725);
  game.message = `${f.data.name} 登场`; game.messageTimer = 90;
  return true;
}

function finishRound(winner) {
  if (game.training) { game.p1.hp = 1000; game.p2.hp = 1000; game.time = 999 * 60; return; }
  game.winner = winner; game.message = winner === game.p1 ? "PLAYER 1 WINS" : "PLAYER 2 WINS"; game.messageTimer = 130;
  game.state = "between";
}

function updateFight() {
  if (game.hitStop > 0) { game.hitStop--; return; }
  if (game.slow > 0 && game.frame % 2 === 0) { game.slow--; return; }
  game.time--;
  audio.music(game.frame, game.time < 900);
  game.p1.tick(game.p2); game.p2.tick(game.p1);
  resolvePush();
  resolveHits(game.p1, game.p2); resolveHits(game.p2, game.p1); resolveProjectiles();
  game.effects.forEach(e => e.life--); game.effects = game.effects.filter(e => e.life > 0);
  game.projectiles.forEach(p => { p.x += p.vx; p.life--; });
  game.projectiles = game.projectiles.filter(p => p.life > 0 && p.x > -80 && p.x < W + 80 && !p.hit);
  if (game.p1.hp <= 0) {
    if (!nextMember(game.p1)) finishRound(game.p2);
  }
  if (game.p2.hp <= 0) {
    if (!nextMember(game.p2)) finishRound(game.p1);
  }
  if (game.time <= 0 && !game.training) {
    if (game.p1.hp === game.p2.hp) { game.time = 10 * 60; game.message = "OVERTIME"; game.messageTimer = 80; }
    else finishRound(game.p1.hp > game.p2.hp ? game.p1 : game.p2);
  }
}

function resolvePush() {
  const dx = game.p2.x - game.p1.x;
  const min = 58;
  if (Math.abs(dx) < min) {
    const push = (min - Math.abs(dx)) / 2 * sign(dx || 1);
    game.p1.x -= push; game.p2.x += push;
  }
}

function resolveHits(a, b) {
  const box = a.attackBox();
  if (!box || a.hitOnce) return;
  if (rectsOverlap(box, b.hurtbox())) {
    a.hitOnce = b.receiveHit(a, box.move);
  }
}

function resolveProjectiles() {
  for (const p of game.projectiles) {
    const target = p.owner === game.p1 ? game.p2 : game.p1;
    const box = { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
    if (rectsOverlap(box, target.hurtbox())) p.hit = target.receiveHit(p.owner, "wave", p);
  }
}

function drawPixelText(text, x, y, size = 18, color = "#fff", align = "left") {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.font = `900 ${size}px Arial, "Microsoft YaHei", "Courier New", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.lineJoin = "miter";
  ctx.lineWidth = Math.max(3, Math.floor(size / 7));
  ctx.strokeStyle = "#050509";
  ctx.strokeText(String(text), Math.round(x), Math.round(y));
  ctx.fillStyle = color;
  ctx.fillText(String(text), Math.round(x), Math.round(y));
  ctx.restore();
}

function drawRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawOutlinedRect(x, y, w, h, color, outline = "#050509") {
  drawRect(x - 2, y - 2, w + 4, h + 4, outline);
  drawRect(x, y, w, h, color);
  drawRect(x + 2, y + 2, Math.max(2, w - 4), 3, "rgba(255,255,255,.18)");
  drawRect(x, y + h - 4, w, 4, "rgba(0,0,0,.28)");
}

function drawBackground() {
  const t = game.frame;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#0b0f2a"); sky.addColorStop(.52, "#2a101c"); sky.addColorStop(1, "#07080c");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 15; i++) {
    const x = (i * 82 - (t * .1) % 82);
    ctx.fillStyle = i % 2 ? "#141a33" : "#10162d"; ctx.fillRect(x, 94 + (i % 4) * 8, 58, 210);
    for (let w = 0; w < 4; w++) for (let h = 0; h < 7; h++) {
      if ((w + h + i + Math.floor(t / 45)) % 5 === 0) { ctx.fillStyle = "rgba(255,211,106,.72)"; ctx.fillRect(x + 9 + w * 11, 116 + h * 20, 5, 8); }
    }
  }
  ctx.fillStyle = "#080910"; ctx.fillRect(0, 274, W, 174);
  ctx.fillStyle = "#172a36"; ctx.fillRect(0, 305, W, 8);
  for (let i = 0; i < 24; i++) {
    const x = i * 38 + Math.sin((t + i * 9) / 18) * 3;
    const y = 294 + (i % 3) * 13;
    ctx.fillStyle = ["#7e2c32", "#8d7636", "#32657c", "#8c8770"][i % 4];
    ctx.fillRect(x, y, 12, 16); ctx.fillStyle = "#07080d"; ctx.fillRect(x + 3, y - 6, 7, 7);
    if ((t + i * 5) % 54 < 14) ctx.fillRect(x - 3, y + 4, 18, 4);
  }
  ctx.fillStyle = "#2b1715"; ctx.fillRect(0, 340, W, 18);
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? "#a2292f" : "#b8862e";
    ctx.fillRect(i * 86 + 15, 240 + Math.sin((t + i * 30) / 35) * 4, 46, 16);
  }
  ctx.fillStyle = "rgba(255,244,190,.06)";
  ctx.beginPath(); ctx.moveTo(180, 0); ctx.lineTo(340, 0); ctx.lineTo(480, FLOOR); ctx.lineTo(210, FLOOR); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(780, 0); ctx.lineTo(610, 0); ctx.lineTo(505, FLOOR); ctx.lineTo(760, FLOOR); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,.54)"; ctx.fillRect(0, 348, W, 98);
  ctx.fillStyle = "rgba(13,15,20,.82)"; ctx.fillRect(0, 358, W, 82);
  ctx.fillStyle = "rgba(91,209,255,.09)";
  ctx.beginPath(); ctx.ellipse(285, FLOOR + 2, 168, 24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,98,83,.08)";
  ctx.beginPath(); ctx.ellipse(675, FLOOR + 2, 168, 24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#201c1a"; ctx.fillRect(0, FLOOR, W, H - FLOOR);
  for (let x = 0; x < W; x += 48) {
    ctx.fillStyle = (x / 48) % 2 ? "#302d2a" : "#252320";
    ctx.fillRect(x, FLOOR, 48, 74);
    ctx.fillStyle = "rgba(255,213,107,.34)"; ctx.fillRect(x, FLOOR, 48, 4);
    ctx.fillStyle = "rgba(0,0,0,.24)"; ctx.fillRect(x, FLOOR + 66, 48, 8);
  }
  ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(0, FLOOR + 6, W, 2);
  ctx.fillStyle = "#0f1014"; ctx.fillRect(0, FLOOR + 74, W, 36);
}

function drawFighter(f) {
  ctx.save();
  ctx.globalAlpha = .5;
  ctx.fillStyle = "#030306";
  ctx.beginPath();
  ctx.ellipse(f.x, FLOOR + 4, f.width * .86, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = .14;
  ctx.fillStyle = f.side === 0 ? "#5bd4ff" : "#ff6b5c";
  ctx.beginPath();
  ctx.ellipse(f.x, FLOOR - 65, f.width * .9, f.height * .6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  for (const a of f.afterImage) {
    ctx.save();
    ctx.globalAlpha = a.life / 38;
    drawSprite(f, a.x, a.y, a.color, true);
    ctx.restore();
  }
  const flicker = f.invuln > 0 && Math.floor(game.frame / 3) % 2 === 0;
  if (!flicker) drawSprite(f, f.x, f.y, null, false);
  if (game.state === "fight" && game.training) {
    ctx.strokeStyle = "rgba(76,214,255,.45)"; const h = f.hurtbox(); ctx.strokeRect(h.x, h.y, h.w, h.h);
    const a = f.attackBox(); if (a) { ctx.strokeStyle = "rgba(255,70,70,.8)"; ctx.strokeRect(a.w < 0 ? a.x + a.w : a.x, a.y, Math.abs(a.w), a.h); }
  }
}

function drawSprite(f, x, y, tint, ghost) {
  const d = f.data, flip = f.facing < 0 ? -1 : 1;
  const crouch = f.state === "crouch";
  const hurt = f.hitStun > 0 || f.state === "hurt";
  const atk = f.state === "attack";
  const jump = f.y < FLOOR || f.state === "jump";
  const walk = f.state === "walk" || f.state === "run";
  const bob = Math.sin((game.frame + f.side * 12) / (walk ? 4 : 14)) * (walk ? 3 : 1.5);
  const scale = d.id === "daimon" ? 1.16 : d.id === "maiha" ? .96 : d.id === "boss" ? 1.08 : 1;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y + bob));
  ctx.scale(flip * scale, scale);
  const skin = tint || d.skin, body = tint || d.body, trim = tint || d.trim, hair = tint || d.hair;
  const lean = hurt ? -12 : atk ? 8 : jump ? 5 : walk ? 3 : 0;
  const cy = crouch ? 18 : 0;
  const wide = d.id === "daimon", slim = d.id === "maiha";
  const torsoW = wide ? 50 : slim ? 34 : 40;
  const torsoH = crouch ? 46 : wide ? 72 : 64;
  const legH = crouch ? 34 : wide ? 60 : 55;
  const headW = wide ? 35 : slim ? 28 : 31;
  const outline = ghost ? "rgba(0,0,0,.2)" : "#050509";
  const part = (px, py, pw, ph, color) => pixel(px, py, pw, ph, color, outline);

  part(-torsoW / 2 + lean, -118 + cy, torsoW, torsoH, body);
  part(-torsoW / 2 - 2 + lean, -116 + cy, torsoW + 4, 9, trim);
  part(-torsoW / 2 + 6 + lean, -101 + cy, 8, 38, "rgba(255,255,255,.2)");
  part(-headW / 2 + lean, -153 + cy, headW, 33, skin);
  part(-headW / 2 - 4 + lean, -161 + cy, headW + 8, 16, hair);
  part(6 + lean, -139 + cy, 5, 4, "#101014");

  if (d.id === "maiha") {
    part(-33 + lean, -127 + cy, 17, 58, trim);
    part(19 + lean, -104 + cy, 13, 38, skin);
  } else if (d.id === "daimon") {
    part(-38 + lean, -111 + cy, 19, 48, body);
    part(20 + lean, -111 + cy, 19, 48, body);
  } else {
    part(-34 + lean, -108 + cy, 16, 45, body);
    part(20 + lean, -106 + cy, 15, 43, body);
  }

  const step = walk ? Math.sin(game.frame / 4) * 8 : 0;
  part(-24 + lean - step * .25, -60 + cy, 17, legH, d.id === "maiha" ? trim : body);
  part(8 + lean + step * .25, -60 + cy, 17, legH, d.id === "maiha" ? trim : body);
  part(-31 + lean - step * .45, -9 + cy, 26, 9, "#111216");
  part(6 + lean + step * .45, -9 + cy, 28, 9, "#111216");

  if (atk) {
    const m = MOVES[f.move], active = f.frame >= m.start && f.frame < m.start + m.active;
    const ext = active ? (f.move === "hk" ? 76 : f.move === "hp" ? 68 : 54) : 30;
    if (f.move === "lk" || f.move === "hk") {
      part(14 + lean, -66 + cy, ext, 15, body);
      part(64 + lean, -69 + cy, 24, 12, trim);
      part(-27 + lean, -59 + cy, 16, 48, body);
    } else if (f.move === "upper") {
      part(8 + lean, -184 + cy, 20, 65, body);
      part(6 + lean, -197 + cy, 25, 16, trim);
      part(-28 + lean, -92 + cy, 16, 38, body);
      if (!ghost) { ctx.globalAlpha = .72; part(23 + lean, -190 + cy, 18, 92, trim); ctx.globalAlpha = 1; }
    } else if (f.move === "throw") {
      part(12 + lean, -114 + cy, 54, 18, body);
      part(56 + lean, -117 + cy, 18, 15, skin);
    } else if (f.move === "wave") {
      part(14 + lean, -110 + cy, 44, 16, body);
      part(50 + lean, -114 + cy, 18, 18, skin);
      if (!ghost) { ctx.globalAlpha = .45; part(70 + lean, -118 + cy, 30, 28, trim); ctx.globalAlpha = 1; }
    } else {
      part(16 + lean, -109 + cy, ext, 16, body);
      part(62 + lean, -112 + cy, 20, 16, skin);
    }
    if (f.move === "super") {
      ctx.globalAlpha = ghost ? ctx.globalAlpha : .78;
      part(-58, -151, 116, 8, trim);
      part(-52, -132, 104, 9, trim);
      part(-62, -90, 124, 10, trim);
      ctx.globalAlpha = 1;
    }
  }
  if (d.id === "benrei") { part(-27, -168 + cy, 54, 8, "#eef4ff"); part(18, -145 + cy, 16, 10, trim); }
  if (d.id === "ioriha") { part(-25, -165 + cy, 50, 10, hair); part(-23, -74 + cy, 46, 10, "#b21728"); }
  if (d.id === "boss") { part(-34, -168 + cy, 68, 12, hair); part(-31, -123 + cy, 62, 13, trim); }
  ctx.restore();
  function pixel(px, py, pw, ph, color, stroke) {
    if (ph < 0) { py += ph; ph = Math.abs(ph); }
    if (pw < 0) { px += pw; pw = Math.abs(pw); }
    if (!ghost) drawOutlinedRect(px, py, pw, ph, color, stroke);
    else drawRect(px, py, pw, ph, color);
  }
}

function drawProjectiles() {
  for (const p of game.projectiles) {
    ctx.save(); ctx.translate(p.x, p.y);
    const colors = { fire: "#ff663d", fan: "#ffe7a0", purple: "#b94cff", bolt: "#65e7ff", void: "#8effd2", quake: "#f5bb62" };
    ctx.fillStyle = colors[p.type] || "#fff";
    for (let i = 0; i < 4; i++) ctx.fillRect(-p.w/2 + i * 10 + Math.sin((game.frame+i)*.6)*5, -p.h/2 + i % 2 * 7, p.w - i*12, p.h - i*6);
    ctx.fillStyle = "#fff7c8"; ctx.fillRect(-10, -8, 20, 16);
    ctx.restore();
  }
}

function drawEffects() {
  for (const e of game.effects) {
    const a = e.life / 34;
    ctx.save(); ctx.globalAlpha = clamp(a, .1, 1); ctx.translate(e.x, e.y);
    if (e.type === "hit" || e.type === "superhit" || e.type === "block") {
      ctx.fillStyle = e.type === "block" ? "#9fd8ff" : e.color;
      const n = e.type === "superhit" ? 12 : 7;
      for (let i = 0; i < n; i++) {
        const ang = i / n * Math.PI * 2 + game.frame * .08;
        const len = (e.type === "superhit" ? 58 : 34) * a;
        ctx.fillRect(Math.cos(ang) * 8, Math.sin(ang) * 8, Math.cos(ang) * len, 5);
      }
      ctx.fillStyle = "#fff"; ctx.fillRect(-10*a, -10*a, 20*a, 20*a);
    } else if (e.type === "spark") {
      ctx.fillStyle = e.color; ctx.fillRect(-3, -3, 6, 6); ctx.fillRect(-12, 0, 24, 3); ctx.fillRect(0, -12, 3, 24);
    } else if (e.type === "quake") {
      ctx.fillStyle = e.color; for (let i = 0; i < 6; i++) ctx.fillRect(i*24-70, -i*8, 18, i*8+18);
    }
    ctx.restore();
  }
}

function drawHud() {
  const p1 = game.p1, p2 = game.p2;
  bar(34, 24, 342, 19, p1.hp / 1000, "#f5d65d", "#b6272f", false);
  bar(W - 376, 24, 342, 19, p2.hp / 1000, "#f5d65d", "#b6272f", true);
  bar(72, 488, 258, 12, p1.meter / 300, "#5ad6ff", "#263f60", false);
  bar(W - 330, 488, 258, 12, p2.meter / 300, "#5ad6ff", "#263f60", true);
  portrait(30, 49, p1.data, false); portrait(W - 92, 49, p2.data, true);
  drawPixelText(p1.data.name, 104, 52, 16, "#fff4cf");
  drawPixelText(p2.data.name, W - 104, 52, 16, "#fff4cf", "right");
  drawPixelText(String(Math.ceil(game.time / 60)).padStart(2, "0"), W / 2, 18, 38, game.time < 600 ? "#ff5a57" : "#fff4cf", "center");
  drawPixelText(`P1 ${p1.index + 1}/${p1.team.length}`, 36, 84, 14, "#9fd8ff");
  drawPixelText(`P2 ${p2.index + 1}/${p2.team.length}`, W - 36, 84, 14, "#ffb0a9", "right");
  if (p1.combo > 1 && game.frame - p1.lastHit < 70) drawPixelText(`${p1.combo} HIT`, 120, 112, 30, "#ffd56b");
  if (p2.combo > 1 && game.frame - p2.lastHit < 70) drawPixelText(`${p2.combo} HIT`, W - 120, 112, 30, "#ffd56b", "right");
  if (game.training) {
    drawPixelText("TRAINING 伤害/判定框 ON", W / 2, 488, 15, "#9fffe6", "center");
  }
  if (game.messageTimer > 0) {
    drawPixelText(game.message, W / 2, 188, game.message.length > 12 ? 34 : 48, "#fff1b2", "center");
    game.messageTimer--;
  }
  function bar(x, y, w, h, pct, fill, back, flip) {
    ctx.fillStyle = "#08080d"; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = back; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill;
    const ww = Math.floor(w * clamp(pct, 0, 1));
    ctx.fillRect(flip ? x + w - ww : x, y, ww, h);
    ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(x, y, w, 4);
  }
  function portrait(x, y, d) {
    ctx.fillStyle = "#05050a"; ctx.fillRect(x, y, 58, 50);
    ctx.fillStyle = d.body; ctx.fillRect(x + 8, y + 24, 42, 20);
    ctx.fillStyle = d.skin; ctx.fillRect(x + 17, y + 10, 24, 25);
    ctx.fillStyle = d.hair; ctx.fillRect(x + 13, y + 5, 32, 12);
    ctx.fillStyle = d.trim; ctx.fillRect(x + 6, y + 43, 46, 4);
  }
}

function drawTitle() {
  drawBackground();
  ctx.fillStyle = "rgba(0,0,0,.52)"; ctx.fillRect(0,0,W,H);
  drawPixelText("格斗皇 97", W / 2, 82, 64, "#ffd56b", "center");
  drawPixelText("PIXEL FIGHTER 97", W / 2, 150, 24, "#9fd8ff", "center");
  const items = ["街机模式", "本地双人", "人机对战", "训练模式", "设置/按键", "出招表"];
  items.forEach((it, i) => {
    const y = 220 + i * 38;
    if (i === game.menu) { ctx.fillStyle = "#b6272f"; ctx.fillRect(350, y - 5, 260, 30); }
    drawPixelText(it, W / 2, y, 22, i === game.menu ? "#fff" : "#fff1b2", "center");
  });
  drawPixelText("W/S选择  ENTER确认  |  P1: WASD+U/I/J/K/O/L  P2:方向键+小键盘", W / 2, 486, 15, "#d7c6a4", "center");
}

function drawSelect() {
  drawBackground();
  ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(0,0,W,H);
  drawPixelText("选择三人队伍", W / 2, 28, 36, "#ffd56b", "center");
  CHARACTERS.forEach((c, i) => {
    const col = i % 3, row = Math.floor(i / 3), x = 180 + col * 190, y = 116 + row * 160;
    ctx.fillStyle = "#11131d"; ctx.fillRect(x, y, 150, 126);
    ctx.fillStyle = "#050509"; ctx.fillRect(x + 25, y + 19, 100, 86);
    drawSelectPortrait(c, x + 75, y + 104);
    if (game.selectCursor[0] === i) { ctx.strokeStyle = "#69d9ff"; ctx.lineWidth = 4; ctx.strokeRect(x - 5, y - 5, 160, 136); }
    if (game.selectCursor[1] === i) { ctx.strokeStyle = "#ff5a57"; ctx.lineWidth = 4; ctx.strokeRect(x - 10, y - 10, 170, 146); }
    drawPixelText(c.name, x + 75, y + 108, 15, "#fff4cf", "center");
  });
  drawPixelText(`P1队伍: ${game.chosen[0].map(i=>CHARACTERS[i].name).join(" / ") || "待选"}`, 40, 438, 18, "#9fd8ff");
  drawPixelText(`P2队伍: ${game.mode === "versus" ? (game.chosen[1].map(i=>CHARACTERS[i].name).join(" / ") || "待选") : "AI自动组队"}`, 40, 466, 18, "#ffb0a9");
  drawPixelText("方向移动光标  U确认P1  小键盘1确认P2  选满自动开战  ESC返回", W / 2, 506, 15, "#d7c6a4", "center");
}

function drawSelectPortrait(c, cx, baseY) {
  const wide = c.id === "daimon", slim = c.id === "maiha";
  const bodyW = wide ? 56 : slim ? 38 : 46;
  drawOutlinedRect(cx - bodyW / 2, baseY - 63, bodyW, 54, c.body);
  drawOutlinedRect(cx - bodyW / 2 - 3, baseY - 62, bodyW + 6, 8, c.trim);
  drawOutlinedRect(cx - 18, baseY - 94, 36, 34, c.skin);
  drawOutlinedRect(cx - 25, baseY - 102, 50, 15, c.hair);
  drawOutlinedRect(cx - bodyW / 2 - 20, baseY - 53, 18, 40, c.body);
  drawOutlinedRect(cx + bodyW / 2 + 2, baseY - 53, 18, 40, c.body);
  drawOutlinedRect(cx - 24, baseY - 12, 19, 13, "#121217");
  drawOutlinedRect(cx + 5, baseY - 12, 23, 13, "#121217");
  if (c.id === "benrei") drawOutlinedRect(cx - 28, baseY - 108, 56, 8, "#eef4ff");
  if (c.id === "ioriha") drawOutlinedRect(cx - 28, baseY - 109, 56, 10, c.hair);
  if (c.id === "boss") drawOutlinedRect(cx - 35, baseY - 110, 70, 12, c.hair);
}

function drawMoveList() {
  drawBackground();
  ctx.fillStyle = "rgba(0,0,0,.62)"; ctx.fillRect(0,0,W,H);
  drawPixelText("出招表 / 系统", W / 2, 34, 38, "#ffd56b", "center");
  const lines = [
    "移动: A/D 或 ←/→    跳跃: W/↑    下蹲: S/↓    防御: 拉后",
    "轻拳 U / Num1   轻脚 J / Num2   重拳 I / Num4   重脚 K / Num5",
    "闪避 Q / Num3   蓄气 E / Num+   换人 Shift / NumEnter",
    "投技: 近身前+重拳/重脚",
    "气功波: ↓↘→ + 轻拳 或 必杀",
    "突进/地裂: ↓↙← + 必杀，部分角色可后蓄前+必杀",
    "升龙裂: →↓↘ + 重拳，或下蓄上+重拳",
    "MAX超必杀: ↓↘→ + 超杀，消耗一格气",
    "取消: 普通技命中后可取消必杀，必杀命中后短窗口可接超杀",
    "训练模式显示攻击框、受击框、伤害和连击。"
  ];
  lines.forEach((line, i) => drawPixelText(line, 92, 104 + i * 34, 18, i > 3 ? "#fff4cf" : "#9fd8ff"));
  drawPixelText("ESC返回", W / 2, 492, 18, "#d7c6a4", "center");
}

function drawSettings() {
  drawBackground();
  ctx.fillStyle = "rgba(0,0,0,.62)"; ctx.fillRect(0,0,W,H);
  drawPixelText("设置", W / 2, 60, 42, "#ffd56b", "center");
  const opts = [`AI难度: ${game.settings.ai}`, `回合时间: ${game.settings.roundTime}`, "音效/BGM: 合成街机声"];
  opts.forEach((o, i) => {
    if (i === game.menu) { ctx.fillStyle = "#263f60"; ctx.fillRect(326, 170 + i * 54, 308, 36); }
    drawPixelText(o, W / 2, 176 + i * 54, 22, "#fff4cf", "center");
  });
  drawPixelText("W/S选择  A/D调整  ESC返回", W / 2, 430, 18, "#d7c6a4", "center");
}

function drawResults() {
  drawBackground();
  ctx.fillStyle = "rgba(0,0,0,.68)"; ctx.fillRect(0,0,W,H);
  const win = game.winner === game.p1;
  drawPixelText(win ? "通关胜利" : "挑战结束", W / 2, 88, 54, win ? "#ffd56b" : "#ff8a80", "center");
  drawPixelText(`街机进度 ${game.arcadeStage}/5`, W / 2, 176, 24, "#9fd8ff", "center");
  drawPixelText(`最终队伍: ${game.p1.team.map(i=>CHARACTERS[i].name).join(" / ")}`, W / 2, 230, 18, "#fff4cf", "center");
  drawPixelText("ENTER重新开始街机  ESC回标题", W / 2, 430, 20, "#d7c6a4", "center");
}

function resetCanvasState(clear = false) {
  if (clear && typeof ctx.reset === "function") {
    ctx.reset();
  } else {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.filter = "none";
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
  }
  ctx.imageSmoothingEnabled = false;
}

function render() {
  resetCanvasState(true);
  const ox = game.shake ? Math.floor(rand(-game.shake, game.shake)) : 0;
  const oy = game.shake ? Math.floor(rand(-game.shake, game.shake)) : 0;
  try {
    ctx.save();
    ctx.translate(ox, oy);
    if (game.state === "title") drawTitle();
    else if (game.state === "select") drawSelect();
    else if (game.state === "moves") drawMoveList();
    else if (game.state === "settings") drawSettings();
    else if (game.state === "results") drawResults();
    else if (game.p1 && game.p2) {
      drawBackground(); drawProjectiles(); drawFighter(game.p1); drawFighter(game.p2); drawEffects(); drawHud();
      if (game.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${game.flash/30})`; ctx.fillRect(0,0,W,H); game.flash--; }
    } else {
      game.state = "title";
      drawTitle();
    }
    ctx.restore();
    if (game.frame > 6) setBootStatus("Ready", "ready");
  } catch (error) {
    resetCanvasState(true);
    drawBackground();
    ctx.fillStyle = "rgba(0,0,0,.72)";
    ctx.fillRect(0, 0, W, H);
    ctx.font = "900 20px Arial, Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#ff8a80";
    ctx.fillText("Render recovered. Press ESC or refresh.", W / 2, 210);
    ctx.fillStyle = "#fff4cf";
    ctx.fillText(String(error && error.message ? error.message : error).slice(0, 96), W / 2, 244);
    window.__pixelFighterLastError = error;
    setBootStatus(String(error && error.message ? error.message : error).slice(0, 140), "error");
    console.error(error);
    game.state = "title";
  }
  resetCanvasState(false);
  game.shake *= .82; if (game.shake < .4) game.shake = 0;
}

function updateMenu() {
  if (pressed("KeyW") || pressed("ArrowUp")) { game.menu = (game.menu + 5) % 6; audio.sfx("select"); }
  if (pressed("KeyS") || pressed("ArrowDown")) { game.menu = (game.menu + 1) % 6; audio.sfx("select"); }
  if (pressed("Enter") || pressed("Space")) {
    audio.init(); audio.sfx("select");
    if (game.menu === 0) { game.mode = "arcade"; game.arcadeStage = 1; game.chosen = [[], []]; game.state = "select"; }
    if (game.menu === 1) { game.mode = "versus"; game.chosen = [[], []]; game.state = "select"; }
    if (game.menu === 2) { game.mode = "cpu"; game.chosen = [[], [3,2,4]]; game.state = "select"; }
    if (game.menu === 3) { game.mode = "training"; game.chosen = [[0,1,4], [3,2,5]]; resetMatch("training"); }
    if (game.menu === 4) { game.state = "settings"; game.menu = 0; }
    if (game.menu === 5) game.state = "moves";
  }
}

const prevKeys = new Set();
function pressed(code) { return KEYS.has(code) && !prevKeys.has(code); }
function updatePrev() { prevKeys.clear(); for (const k of KEYS) prevKeys.add(k); }

function updateSelect() {
  const moveCursor = (player, dx, dy) => {
    let c = game.selectCursor[player], col = c % 3, row = Math.floor(c / 3);
    col = clamp(col + dx, 0, 2); row = clamp(row + dy, 0, 1); game.selectCursor[player] = row * 3 + col;
  };
  if (pressed("KeyA")) moveCursor(0, -1, 0); if (pressed("KeyD")) moveCursor(0, 1, 0); if (pressed("KeyW")) moveCursor(0, 0, -1); if (pressed("KeyS")) moveCursor(0, 0, 1);
  if (pressed("ArrowLeft")) moveCursor(1, -1, 0); if (pressed("ArrowRight")) moveCursor(1, 1, 0); if (pressed("ArrowUp")) moveCursor(1, 0, -1); if (pressed("ArrowDown")) moveCursor(1, 0, 1);
  if (pressed("KeyU") || pressed("Enter")) choose(0, game.selectCursor[0]);
  if (game.mode === "versus" && (pressed("Numpad1") || pressed("Space"))) choose(1, game.selectCursor[1]);
  if (pressed("Escape")) game.state = "title";
  const needP2 = game.mode === "versus";
  if (game.chosen[0].length >= TEAM_SIZE && (!needP2 || game.chosen[1].length >= TEAM_SIZE)) {
    if (!needP2) game.chosen[1] = game.mode === "arcade" ? [3,2,4] : [4,3,2];
    resetMatch(game.mode);
  }
  function choose(p, idx) {
    if (game.chosen[p].length < TEAM_SIZE) { game.chosen[p].push(idx); audio.sfx("select"); }
  }
}

function updateBetween() {
  if (game.messageTimer > 0) game.messageTimer--;
  else {
    if (game.mode === "arcade" && game.winner === game.p1 && game.arcadeStage < 5) {
      game.arcadeStage++; game.chosen[1] = game.arcadeStage >= 5 ? [5,3,5] : shuffle([0,1,2,3,4]).slice(0,3); resetMatch("arcade");
    } else if (game.mode === "arcade") {
      game.state = "results";
    } else {
      resetMatch(game.mode);
    }
  }
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function updateSettings() {
  if (pressed("KeyW") || pressed("ArrowUp")) game.menu = (game.menu + 2) % 3;
  if (pressed("KeyS") || pressed("ArrowDown")) game.menu = (game.menu + 1) % 3;
  const delta = (pressed("KeyD") || pressed("ArrowRight") ? 1 : 0) - (pressed("KeyA") || pressed("ArrowLeft") ? 1 : 0);
  if (delta && game.menu === 0) game.settings.ai = clamp(game.settings.ai + delta, 1, 3);
  if (delta && game.menu === 1) game.settings.roundTime = clamp(game.settings.roundTime + delta * 10, 30, 99);
  if (pressed("Escape")) { game.state = "title"; game.menu = 0; }
}

function tick() {
  game.frame++;
  if (game.state === "title") updateMenu();
  else if (game.state === "select") updateSelect();
  else if (game.state === "settings") updateSettings();
  else if (game.state === "moves" && pressed("Escape")) game.state = "title";
  else if (game.state === "fight") { if (pressed("Escape")) game.state = "title"; else updateFight(); }
  else if (game.state === "between") updateBetween();
  else if (game.state === "results") {
    if (pressed("Enter")) { game.arcadeStage = 1; game.chosen = [[], []]; game.state = "select"; }
    if (pressed("Escape")) game.state = "title";
  }
  render();
  updatePrev();
  requestAnimationFrame(tick);
}

window.addEventListener("keydown", (e) => { KEYS.add(e.code); if (["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)) e.preventDefault(); audio.init(); });
window.addEventListener("keyup", (e) => KEYS.delete(e.code));
window.addEventListener("blur", () => { KEYS.clear(); TOUCH.clear(); });
document.querySelectorAll("[data-touch]").forEach(btn => {
  const action = btn.dataset.touch;
  btn.addEventListener("pointerdown", e => { e.preventDefault(); TOUCH.add(action); audio.init(); });
  btn.addEventListener("pointerup", e => { e.preventDefault(); TOUCH.delete(action); });
  btn.addEventListener("pointercancel", () => TOUCH.delete(action));
});

if (new URLSearchParams(location.search).has("fight")) {
  game.chosen = [[0, 1, 4], [3, 2, 5]];
  resetMatch("cpu");
}

tick();
