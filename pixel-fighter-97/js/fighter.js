/* fighter.js - combatant logic */
class Fighter {
  constructor(team, side, input, ai) {
    this.team = team; this.side = side; this.input = input; this.ai = !!ai; this.index = 0;
    this.hpStock = team.map(() => 1000); this.maxHp = 1000; this.spawn();
  }
  get data() { return CHARACTERS[this.team[this.index]]; }
  moveData(name) { const base = BASE_MOVES[name] || BASE_MOVES.lp; const mod = this.data.moveMod && this.data.moveMod[name]; return mod ? Object.assign({}, base, mod) : base; }
  spawn(keepMeter) {
    const meter = keepMeter ? (this.meter || 0) : 0;
    this.x = this.side ? 710 : 250; this.y = FLOOR; this.vx = 0; this.vy = 0; this.facing = this.side ? -1 : 1;
    this.hp = this.hpStock[this.index] || 1000; this.meter = meter; this.state = "intro"; this.frame = 0; this.moveFrame = 0; this.move = null;
    this.hitStun = 0; this.blockStun = 0; this.invuln = 24; this.dead = false; this.hitOnce = false;
    this.combo = 0; this.lastHit = 0; this.cancelWindow = 0; this.afterImage = [];
    this.maxMode = false; this.maxTimer = 0; this.stunGauge = 0; this.stunned = false; this.stunTimer = 0;
    this.guardGauge = 100; this.guardBroken = false; this.guardBreakTimer = 0; this.ukemiWindow = 0;
    this.victoryPose = false; this.victoryTimer = 0; this.teleportTarget = null;
    this.width = this.data.id === "daimon" ? 72 : this.data.id === "maiha" ? 52 : this.data.id === "boss" ? 66 : 60;
    this.height = this.data.id === "daimon" ? 142 : this.data.id === "maiha" ? 124 : this.data.id === "boss" ? 138 : 134;
  }
  readyAt(x) { this.x = x; this.y = FLOOR; this.state = "idle"; this.frame = 0; this.invuln = 0; this.hp = this.hpStock[this.index] || 1000; }
  canAct() { return ["idle","walk","run","crouch","jump","land"].includes(this.state) && !this.dead && !this.stunned && !this.guardBroken && this.hitStun <= 0 && this.blockStun <= 0; }
  switchMember() {
    if (!this.canAct() || !this.hpStock.some((hp, i) => i !== this.index && hp > 0)) return false;
    this.hpStock[this.index] = this.hp;
    for (let s = 1; s <= this.team.length; s++) {
      const n = (this.index + s) % this.team.length;
      if (this.hpStock[n] > 0) { this.index = n; this.spawn(true); this.readyAt(this.side ? 735 : 225); this.invuln = 34; this.state = "dodge"; G.message = this.data.name + " 换入"; G.messageTimer = 55; audio.sfx("rush"); return true; }
    }
    return false;
  }
  hurtbox() { const crouch = this.state === "crouch" || (this.input && this.input.raw("down") && this.canAct()); const h = crouch ? this.height * .68 : this.height; return {x:this.x-this.width/2,y:this.y-h,w:this.width,h}; }
  attackBox() {
    if (this.state !== "attack" || !this.move) return null;
    const m = this.moveData(this.move);
    if (m.projectile || this.moveFrame < m.start || this.moveFrame >= m.start + m.active) return null;
    return {x:this.x+this.facing*this.width*.35,y:this.y+m.y,w:m.w*this.data.reach*this.facing,h:m.h,move:this.move};
  }
  startMove(name, forced) {
    const m = this.moveData(name);
    if (!forced && !this.canAct()) { if (!(this.cancelWindow > 0 && (m.special || m.super))) return false; }
    if (m.airOnly && this.y >= FLOOR) return false;
    if (m.cost && this.meter < m.cost) return false;
    if (m.cost) this.meter -= m.cost;
    this.state = "attack"; this.move = name; this.moveFrame = 0; this.hitOnce = false; this.invuln = Math.max(this.invuln, m.invuln || 0);
    if (m.vx) this.vx = this.facing * m.vx;
    if (m.super) { G.flash = 18; G.slow = 12; this.afterImage.push({x:this.x,y:this.y,life:22,color:this.data.trail}); }
    if (m.teleport) this.teleportTarget = (this.side ? G.p1 : G.p2).x - this.facing * 85;
    audio.sfx(m.sfx); return true;
  }
  launchProjectile() { const t = this.data.projectile; G.projectiles.push({owner:this,x:this.x+this.facing*54,y:this.y-78,vx:this.facing*(t === "fan" ? 8.5 : t === "void" ? 6.2 : 7.2),w:t === "quake"?96:48,h:t === "quake"?24:34,dmg:t === "void"?78:58,life:92,type:t,hit:false,color:this.data.trail}); }
  tick(opponent) {
    this.facing = this.x < opponent.x ? 1 : -1; if (this.input) this.input.tick(this.facing);
    if (this.invuln > 0) this.invuln--; if (this.cancelWindow > 0) this.cancelWindow--;
    this.afterImage.forEach(a => a.life--); this.afterImage = this.afterImage.filter(a => a.life > 0);
    if (this.maxMode && --this.maxTimer <= 0) this.maxMode = false;
    if (this.stunGauge > 0 && this.hitStun <= 0) this.stunGauge = Math.max(0, this.stunGauge - .3);
    if (this.guardGauge < 100 && this.blockStun <= 0) this.guardGauge = Math.min(100, this.guardGauge + .16);
    if (this.stunned) { if (--this.stunTimer <= 0) { this.stunned = false; this.stunGauge = 0; this.state = "idle"; } else { this.frame++; this.physics(); return; } }
    if (this.guardBroken) { if (--this.guardBreakTimer <= 0) { this.guardBroken = false; this.guardGauge = 35; this.state = "idle"; } else { this.frame++; this.physics(); return; } }
    if (this.ukemiWindow > 0 && --this.ukemiWindow > 0 && this.input && (this.input.pressed("lp") || this.input.pressed("lk") || this.input.pressed("dodge"))) { this.state = "land"; this.vy = -6; this.invuln = 12; this.ukemiWindow = 0; audio.sfx("dodge"); }
    if (this.victoryPose) { this.victoryTimer++; this.vx *= .9; this.physics(); return; }
    if (this.dead) { this.frame++; this.vx *= .88; this.physics(); return; }
    if (this.hitStun > 0) { this.hitStun--; this.frame++; this.physics(); return; }
    if (this.blockStun > 0) { this.blockStun--; this.frame++; this.vx *= .78; this.physics(); return; }
    if (this.ai) this.aiThink(opponent);
    const d = this.input ? this.input.dir(this.facing) : {x:0,y:0,forward:false,back:false,down:false,up:false};
    if (this.state === "intro") { if (++this.frame > 50) this.state = "idle"; return; }
    if (this.state === "down") { this.downTimer--; this.vx *= .88; this.physics(); if (this.downTimer <= 0) { this.state = "rise"; this.frame = 0; this.invuln = 24; } return; }
    if (this.state === "rise") { if (++this.frame > 22) this.state = "idle"; return; }
    if (this.state === "ko") { this.frame++; this.vx *= .92; this.physics(); return; }
    if (this.state === "attack") {
      const m = this.moveData(this.move);
      if ((this.move === "wave" || this.move === "kaiser") && this.moveFrame === m.start) this.launchProjectile();
      if (m.teleport && this.moveFrame === m.start && this.teleportTarget != null) { this.x = clamp(this.teleportTarget, 55, W - 55); this.teleportTarget = null; G.effects.push({type:"teleport",x:this.x,y:this.y-70,life:22,color:this.data.trail}); }
      if ((this.move === "quake" || this.move === "jirai") && this.moveFrame === m.start + 2) G.effects.push({type:"quake",x:this.x+this.facing*70,y:FLOOR-10,life:30,color:this.data.trail});
      if (++this.moveFrame >= m.start + m.active + m.recover) { this.state = "idle"; this.move = null; this.moveFrame = 0; this.vx *= .2; }
      this.physics(); return;
    }
    if (this.input && this.input.pressed("sp") && this.input.pressed("charge") && this.meter >= 50 && !this.maxMode) { this.maxMode = true; this.maxTimer = 480; this.meter -= 50; G.flash = 12; audio.sfx("maxmode"); }
    if (this.input && this.input.raw("charge") && this.state !== "jump") { this.state = "charge"; this.meter = clamp(this.meter + .55, 0, 300); if (G.frame % 5 === 0) audio.sfx("charge"); this.frame++; return; }
    if (this.state === "charge" && !this.input.raw("charge")) this.state = "idle";
    this.handleActions(d, opponent); if (this.state === "attack") { this.physics(); return; }
    if (this.input && this.input.pressed("dodge") && this.y >= FLOOR) { this.state = "dodge"; this.frame = 0; this.invuln = 18; this.vx = this.facing * (d.back ? -7 : 7); audio.sfx("dodge"); }
    if (this.state === "dodge") { if (++this.frame > 24) this.state = "idle"; this.vx *= .93; this.physics(); return; }
    if (d.up && this.y >= FLOOR) { this.vy = -this.data.jump; this.vx = d.x * this.data.speed * .85; this.state = "jump"; this.frame = 0; }
    else if (this.y < FLOOR) { this.state = "jump"; this.vx = clamp(this.vx + d.x * .3, -this.data.speed*1.35, this.data.speed*1.35); }
    else if (d.down) { this.state = "crouch"; this.vx *= .72; }
    else if (d.x) { this.state = d.forward && this.input.motion(["F","F"]) ? "run" : "walk"; this.vx = d.x * this.data.speed * (this.state === "run" ? 1.45 : 1); }
    else { this.state = "idle"; this.vx *= .75; }
    this.frame++; this.physics();
  }
  handleActions(d, opponent) {
    if (!this.input) return;
    if (this.input.pressed("switch") && this.switchMember()) return;
    const spec = this.data.specials || [];
    if (this.input.motion(["D","DF","F"], "su") && this.meter >= 100) { this.startMove(this.data.superName); return; }
    if (spec.includes("upper") && this.input.motion(["F","D","DF"], "hp")) { this.startMove("upper"); return; }
    if (spec.includes("wave") && this.input.motion(["D","DF","F"], "sp")) { this.startMove("wave"); return; }
    if (spec.includes("rush") && this.input.motion(["D","DB","B"], "sp")) { this.startMove("rush"); return; }
    if (spec.includes("jirai") && this.input.motion(["D","DF","F"], "sp")) { this.startMove("jirai"); return; }
    if (spec.includes("quake") && this.input.motion(["D","DB","B"], "sp")) { this.startMove("quake"); return; }
    if (spec.includes("arashi") && this.input.motion(["D","DB","B"], "hp")) { this.startMove("arashi"); return; }
    if (spec.includes("yaotome") && this.input.motion(["D","DB","B"], "hp")) { this.startMove("yaotome"); return; }
    if (spec.includes("raijin") && this.input.motion(["D","DB","B"], "hk")) { this.startMove("raijin"); return; }
    if (spec.includes("teleport") && this.input.motion(["D","DF","F"], "sp")) { this.startMove("teleport"); return; }
    if (spec.includes("kaiser") && this.input.motion(["D","DB","B"], "sp")) { this.startMove("kaiser"); return; }
    const near = Math.abs(this.x - opponent.x) < 78 && Math.abs(this.y - opponent.y) < 28;
    if (near && d.forward && (this.input.pressed("hp") || this.input.pressed("hk"))) { this.startMove("throw"); return; }
    const pre = d.down ? "c_" : this.y < FLOOR ? "j_" : "";
    for (const b of ["lp","lk","hp","hk"]) if (this.input.pressed(b)) { this.startMove(pre + b); return; }
  }
  aiThink(opponent) {
    const ai = this.input; ai.fake = ai.fake || {};
    Object.keys(P2_KEYS).forEach(k => ai.fake[k] = false);
    const dist = Math.abs(opponent.x - this.x), hard = G.aiLevel || 2;
    if (this.hitStun || this.blockStun || this.stunned) return;
    if (dist > 200) { ai.fake[this.x < opponent.x ? "right" : "left"] = true; if (Math.random() < .012 * hard) this.startMove("wave"); }
    else if (dist > 95) { if (Math.random() < .6) ai.fake[this.x < opponent.x ? "right" : "left"] = true; if (Math.random() < .018 * hard) this.startMove(Math.random() < .5 ? "wave" : "rush"); }
    else { if (opponent.state === "attack" && Math.random() < .04 * hard) ai.fake.dodge = true; if (Math.random() < .03 * hard) ai.fake.hp = true; else if (Math.random() < .05 * hard) ai.fake.lk = true; if (this.meter >= 100 && Math.random() < .008 * hard) this.startMove(this.data.superName); }
    ai.raw = action => !!ai.fake[action];
  }
  receiveHit(attacker, name, projectile) {
    if (this.invuln > 0) return false;
    const m = this.moveData(name), d = this.input ? this.input.dir(this.facing) : {};
    const blocking = this.y >= FLOOR && d.back && !m.throw && this.state !== "attack";
    if (blocking) {
      this.blockStun = m.block || 12; this.vx = attacker.facing * (m.push || 5) * .55;
      this.guardGauge = Math.max(0, this.guardGauge - (m.dmg || 20) * .32);
      attacker.meter = clamp(attacker.meter + 8, 0, 300); G.hitStop = Math.max(G.hitStop, Math.floor((m.hitStop || 6) * .55));
      G.shake = Math.max(G.shake, 4); G.effects.push({type:"block",x:(this.x+attacker.x)/2,y:this.y-78,life:18,color:"#9fd8ff"}); audio.sfx("block");
      if (this.guardGauge <= 0) { this.guardBroken = true; this.guardBreakTimer = 65; this.blockStun = 0; G.message = "GUARD CRUSH!"; G.messageTimer = 50; audio.sfx("guardbreak"); }
      return true;
    }
    const baseDmg = projectile ? projectile.dmg : m.dmg;
    const dmg = Math.floor(baseDmg * attacker.data.power * (attacker.maxMode ? 1.2 : 1) * (G.training ? .75 : 1));
    this.hp = clamp(this.hp - dmg, 0, this.maxHp); this.hpStock[this.index] = this.hp;
    this.hitStun = m.stun || 18; this.stunGauge += m.stun || 18; this.vx = attacker.facing * (m.push || 7); this.vy = -(m.launch || m.knock || 0);
    this.state = this.hp <= 0 ? "ko" : (m.knock || m.throw ? "down" : "hurt"); this.downTimer = m.throw ? 34 : m.knock ? 42 : 0;
    if (this.state === "down") this.ukemiWindow = 18;
    attacker.meter = clamp(attacker.meter + (m.super ? 0 : 14), 0, 300); attacker.combo = G.frame - attacker.lastHit < 72 ? attacker.combo + 1 : 1; attacker.lastHit = G.frame; attacker.cancelWindow = m.cancel ? (attacker.maxMode ? 28 : 18) : 0;
    G.hitStop = Math.max(G.hitStop, m.hitStop || 8); G.shake = Math.max(G.shake, m.super ? 16 : m.dmg > 60 ? 10 : 6);
    G.effects.push({type:m.super ? "superhit" : "hit",x:this.x-attacker.facing*28,y:this.y-rand(60,100),life:m.super?34:18,color:attacker.data.trail}); audio.sfx(m.sfx || "heavy");
    if (this.stunGauge >= 1000 && this.hp > 0) { this.stunned = true; this.stunTimer = 90; this.state = "stun"; this.hitStun = 0; audio.sfx("stun"); }
    if (this.hp <= 0) { this.dead = true; this.state = "ko"; G.slow = 26; audio.sfx("ko"); }
    return true;
  }
  physics() {
    this.vy += GRAVITY * this.data.weight; this.x += this.vx; this.y += this.vy;
    if (this.y >= FLOOR) { this.y = FLOOR; this.vy = 0; if (this.state === "jump") { this.state = "land"; this.frame = 0; } }
    this.x = clamp(this.x, 55, W - 55);
  }
}
