/* ============================================================
 * entities.js — 玩家 / 敌军 / 子弹 / 手雷 / 人质 / 道具 / 油桶 / 粒子
 * 坐标系:世界坐标,y 为"脚底"位置,地面 groundY 由 game.js 提供。
 * 绘制时调用方已完成 -camX 平移。
 * ============================================================ */
(function () {
  "use strict";
  const { R, drawFighter, drawItemBox, drawGrenade, drawParachute, drawText } = SPR;

  const WEAPONS = {
    pistol: { cd: 13, speed: 6.5, auto: false, name: "PISTOL" },
    H:  { cd: 5,  speed: 7.5, auto: true, ammo: 200, name: "HEAVY MACHINE GUN", voice: "Heavy Machine Gun!" },
    S:  { cd: 24, speed: 6.0, auto: false, ammo: 30, name: "SHOTGUN", voice: "Shotgun!" },
    R:  { cd: 28, speed: 4.2, auto: false, ammo: 30, name: "ROCKET LAUNCHER", voice: "Rocket Launcher!" },
    F:  { cd: 6,  speed: 3.2, auto: true, ammo: 120, name: "FLAME SHOT", voice: "Flame Shot!" },
    L:  { cd: 14, speed: 11,  auto: false, ammo: 120, name: "LASER GUN", voice: "Laser Gun!" },
  };

  const ENT = {
    bullets: [], ebullets: [], enemies: [], items: [], hostages: [],
    parts: [], floats: [], barrels: [], vehicles: [],
    shake: 0, time: 0,
    player: null, groundY: 232,
  };

  /* ---------------- 粒子与飘分 ---------------- */
  function addPart(x, y, vx, vy, life, color, size, grav) {
    ENT.parts.push({ x, y, vx, vy, life, maxLife: life, color, size: size || 2, grav: grav == null ? 0.15 : grav });
  }
  function addFloat(x, y, text, color) {
    ENT.floats.push({ x, y, text, color: color || "#ffe080", life: 55 });
  }

  function spawnExplosion(x, y, scale, hurtPlayer) {
    const s = scale || 1;
    AudioSys.sfx.explosion(s > 1.1);
    ENT.shake = Math.min(10, ENT.shake + 3.2 * s);
    for (let i = 0; i < 14 * s; i++) {
      const a = Math.random() * Math.PI * 2, sp = (0.5 + Math.random() * 2.4) * s;
      addPart(x, y - 4, Math.cos(a) * sp, Math.sin(a) * sp - 1,
        14 + Math.random() * 16, ["#ffe040", "#ff9020", "#ff4818"][i % 3], 2 + Math.random() * 3 * s, 0.05);
    }
    for (let i = 0; i < 8 * s; i++) {
      addPart(x + (Math.random() - 0.5) * 14 * s, y - 6, (Math.random() - 0.5) * 0.8, -0.6 - Math.random(),
        30 + Math.random() * 24, i % 2 ? "#5a5a5a" : "#3a3a3a", 3 + Math.random() * 4, -0.02);
    }
    for (let i = 0; i < 6 * s; i++) {
      const a = -Math.random() * Math.PI;
      addPart(x, y - 2, Math.cos(a) * (1 + Math.random() * 2.5), Math.sin(a) * (1.5 + Math.random() * 2),
        26 + Math.random() * 20, "#7a5230", 2, 0.3);
    }
    // 范围伤害
    const r = 30 * s;
    for (const e of ENT.enemies) {
      if (!e.dying && Math.abs(e.x - x) < r && Math.abs(e.y - y) < r) e.takeHit(10, x < e.x ? 1 : -1);
    }
    for (const b of ENT.barrels) {
      if (!b.dead && Math.abs(b.x - x) < r && Math.abs(b.y - y) < r) b.hp = 0;
    }
    // Boss 也受爆炸溅射伤害
    if (LEVEL.boss && LEVEL.boss.hittable() && !LEVEL.boss.dead) {
      if (Math.abs(LEVEL.boss.x - x) < r && Math.abs(LEVEL.boss.y - y) < r) LEVEL.boss.takeHit(3);
    }
    if (hurtPlayer !== false && ENT.player && ENT.player.alive && ENT.player.invuln <= 0) {
      if (Math.abs(ENT.player.x - x) < r * 0.75 && Math.abs(ENT.player.y - y) < r) {
        // 玩家在载具中时,爆炸伤害载具
        if (ENT.player.inVehicle) ENT.player.inVehicle.takeHit(1);
        else ENT.player.die();
      }
    }
    // 爆炸冲击波光圈
    ENT.parts.push({ x, y: y - 6, vx: 0, vy: 0, life: 10, maxLife: 10, color: "#fff0c0", size: 8 * s, grav: 0, ring: true });
  }

  /* ---------------- 玩家 ---------------- */
  class Player {
    constructor(x) { this.reset(x); this.lives = 3; this.grenades = 10; }
    reset(x) {
      this.x = x; this.y = ENT.groundY; this.vy = 0; this.dir = 1;
      this.alive = true; this.deadT = 0; this.invuln = 100;
      this.crouch = false; this.onGround = true; this.phase = 0;
      this.shotCd = 0; this.meleeT = 0; this.throwT = 0;
      this.weapon = "pistol"; this.ammo = Infinity;
      this.pose = "idle"; this.aim = "mid";
      this.inVehicle = null;
    }
    get wtype() { return WEAPONS[this.weapon]; }
    giveWeapon(kind) {
      if (WEAPONS[kind] && kind !== "pistol") {
        if (this.weapon === kind) this.ammo += WEAPONS[kind].ammo;
        else { this.weapon = kind; this.ammo = WEAPONS[kind].ammo; }
        AudioSys.voice(WEAPONS[kind].voice);
      }
    }
    die() {
      if (!this.alive || this.invuln > 0) return;
      // 载具替玩家挡伤害
      if (this.inVehicle) {
        this.inVehicle.takeHit(1);
        this.invuln = 40;
        return;
      }
      this.alive = false; this.deadT = 110;
      AudioSys.sfx.playerDie();
      spawnExplosion(this.x, this.y - 8, 0.9, false);
      for (let i = 0; i < 8; i++) addPart(this.x, this.y - 10, (Math.random() - 0.5) * 3, -1 - Math.random() * 2, 24, "#c03028", 2, 0.25);
    }
    update() {
      if (!this.alive) { if (this.deadT > 0) this.deadT--; return; }
      this.invuln = Math.max(0, this.invuln - 1);

      // 载具模式:玩家控制载具,不执行常规逻辑
      if (this.inVehicle) {
        const v = this.inVehicle;
        if (v.dead) { this.inVehicle = null; }
        else {
          v.update(this);
          // 同步玩家位置到载具
          this.x = v.x; this.y = v.y; this.dir = v.dir;
          this.phase = v.phase;
          // 退出载具:按跳跃键
          if (Input.pressed("jump")) {
            v.occupied = false;
            this.inVehicle = null;
            this.x = v.x + 24 * (this.dir >= 0 ? 1 : -1);
            this.y = ENT.groundY;
            this.vy = 0; this.onGround = true;
            this.invuln = 30;
            AudioSys.sfx.click();
          }
          // 瞄准方向(载具中也可8方向)
          const up = Input.held("up");
          const downAir = Input.held("down") && !v.onGround;
          const holdingLR = Input.held("left") || Input.held("right");
          if (up && holdingLR) this.aim = "up-fwd";
          else if (downAir && holdingLR) this.aim = "down-fwd";
          else if (up) this.aim = "up";
          else if (downAir) this.aim = "down";
          else this.aim = "mid";
          this.pose = "idle";
          return;
        }
      }

      // 检测附近有未占据的载具且按了跳跃键 → 进入
      if (Input.pressed("jump") && this.onGround) {
        for (const v of ENT.vehicles) {
          if (!v.dead && !v.occupied && Math.abs(v.x - this.x) < 30 && Math.abs(v.y - this.y) < 30) {
            v.occupied = true;
            this.inVehicle = v;
            this.invuln = 20;
            AudioSys.sfx.click();
            AudioSys.voice("Vehicle!");
            return;
          }
        }
      }

      const w = this.wtype;
      this.shotCd = Math.max(0, this.shotCd - 1);
      this.meleeT = Math.max(0, this.meleeT - 1);
      this.throwT = Math.max(0, this.throwT - 1);

      this.crouch = Input.held("down") && this.onGround;
      // 左右移动(蹲下不能走)
      let mx = 0;
      if (!this.crouch) {
        if (Input.held("left")) mx = -1.7;
        if (Input.held("right")) mx = 1.7;
      }
      if (mx !== 0) this.dir = mx > 0 ? 1 : -1;
      this.x += mx;
      this.phase += Math.abs(mx) * 2.2 + 0.6;
      // 跳跃
      if (Input.pressed("jump") && this.onGround && !this.crouch) {
        this.vy = -8.8; this.onGround = false; AudioSys.sfx.jump();
      }
      this.vy += 0.5; this.y += this.vy;
      if (this.y >= ENT.groundY) { this.y = ENT.groundY; this.vy = 0; this.onGround = true; }
      // 屏幕内活动范围
      const camL = GAME.camX + 6, camR = GAME.camX + GAME.VW - 6;
      this.x = Math.max(camL, Math.min(camR, this.x));

      // 瞄准方向(8方向: up/mid/down/up-fwd/down-fwd)
      const up = Input.held("up");
      const downAir = Input.held("down") && !this.onGround;
      const holdingLR = Input.held("left") || Input.held("right");
      if (up && holdingLR && !this.crouch) this.aim = "up-fwd";
      else if (downAir && holdingLR) this.aim = "down-fwd";
      else if (up) this.aim = "up";
      else if (downAir) this.aim = "down";
      else this.aim = "mid";

      // 近战判定:射击键 + 近身敌人
      const wantFire = w.auto ? Input.held("fire") : Input.pressed("fire");
      if (wantFire && this.shotCd <= 0) {
        let near = null, nd = 24;
        for (const e of ENT.enemies) {
          if (e.dying) continue;
          const d = Math.abs(e.x - this.x);
          if (d < nd && Math.abs(e.y - this.y) < 24) { near = e; nd = d; }
        }
        if (near) {
          this.dir = near.x >= this.x ? 1 : -1;
          this.meleeT = 12; this.shotCd = 16;
          AudioSys.sfx.melee();
          near.takeHit(2, this.dir, "melee");
          addPart(near.x, near.y - 12, this.dir * 2, -1, 8, "#ffffff", 3, 0);
          addPart(near.x, near.y - 12, this.dir * 3, -2, 6, "#ffe040", 2, 0);
        } else {
          this.fire();
        }
      }
      // 手雷
      if (Input.pressed("bomb") && this.grenades > 0 && this.throwT <= 0) {
        this.grenades--; this.throwT = 24;
        AudioSys.sfx.throwG();
        const up = Input.held("up");
        ENT.bullets.push(new Bullet(this.x + this.dir * 6, this.y - 16,
          this.dir * (up ? 1.2 : 2.6), up ? -6.4 : -4.2, "grenade", 1));
      }
      // 姿态
      if (this.meleeT > 0) this.pose = "melee";
      else if (this.throwT > 14) this.pose = "throw";
      else if (!this.onGround) this.pose = "jump";
      else if (this.crouch) this.pose = "crouch";
      else if (Input.held("fire") || this.shotCd > 4) this.pose = "shoot";
      else if (mx !== 0) this.pose = "run";
      else this.pose = "idle";
    }
    fire() {
      const w = this.wtype;
      this.shotCd = w.cd;
      if (this.weapon !== "pistol") {
        this.ammo--;
        if (this.ammo <= 0) { this.weapon = "pistol"; this.ammo = Infinity; }
      }
      AudioSys.sfx.shot(this.weapon);
      const gy = this.crouch ? this.y - 8 : this.y - 14;
      let vx = 0, vy = 0;
      if (this.aim === "up") vy = -w.speed;
      else if (this.aim === "down") vy = w.speed;
      else if (this.aim === "up-fwd") { vx = this.dir * w.speed * 0.7; vy = -w.speed * 0.7; }
      else if (this.aim === "down-fwd") { vx = this.dir * w.speed * 0.7; vy = w.speed * 0.7; }
      else vx = this.dir * w.speed;
      const bx = this.x + (vx !== 0 ? this.dir * 12 : 2), by = vy !== 0 ? this.y - 20 : gy;
      // 枪口火光
      addPart(bx + (vx !== 0 ? this.dir * 3 : 0), by, vx * 0.1, vy * 0.1, 4, "#ffe080", 4, 0);
      addPart(bx, by, 0, 0, 3, "#ffffff", 2, 0);
      if (this.weapon === "S") {
        for (let i = -2; i <= 2; i++) {
          const sp = 6 + Math.random();
          const base = Math.atan2(vy, vx);
          ENT.bullets.push(new Bullet(bx, by, Math.cos(base + i * 0.16) * sp, Math.sin(base + i * 0.16) * sp, "pellet", 1));
        }
      } else if (this.weapon === "F") {
        for (let i = 0; i < 2; i++) {
          const j = (Math.random() - 0.5) * 0.8;
          ENT.bullets.push(new Bullet(bx, by, vx + j, vy + j - 0.3, "flame", 1));
        }
      } else {
        const kind = this.weapon === "R" ? "rocket" : this.weapon === "L" ? "laser" : "shot";
        const spread = this.weapon === "H" ? (Math.random() - 0.5) * 0.7 : 0;
        ENT.bullets.push(new Bullet(bx, by, vx + (vx ? 0 : spread), vy + (vy ? 0 : spread), kind, this.weapon === "L" ? 2 : 1));
      }
    }
    draw(g) {
      if (!this.alive) return;
      if (this.inVehicle) return; // 在载具中不画玩家(载具draw会画舱口里的头)
      if (this.invuln > 0 && Math.floor(this.invuln / 4) % 2 === 0) return; // 无敌闪烁
      drawFighter(g, { x: this.x, y: this.y, dir: this.dir, pose: this.pose, phase: this.phase, pal: "player", aim: this.aim });
    }
  }

  /* ---------------- 玩家子弹 ---------------- */
  class Bullet {
    constructor(x, y, vx, vy, kind, dmg) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.kind = kind; this.dmg = dmg; this.dead = false;
      this.life = kind === "pellet" ? 16 : kind === "flame" ? 22 : kind === "grenade" ? 999 : 90;
      this.pierce = kind === "laser";
      this.bounce = 0;
    }
    update() {
      this.life--;
      if (this.life <= 0) { if (this.kind === "grenade") this.explode(); else this.dead = true; return; }
      if (this.kind === "grenade") {
        this.vy += 0.32; this.x += this.vx; this.y += this.vy;
        if (this.y >= ENT.groundY) {
          this.y = ENT.groundY;
          if (this.bounce++ >= 1 || Math.abs(this.vy) < 1.2) this.explode();
          else { this.vy *= -0.42; this.vx *= 0.6; }
        }
      } else if (this.kind === "rocket") {
        this.vy += 0.06; this.x += this.vx; this.y += this.vy;
        if (Math.random() < 0.6) addPart(this.x, this.y, -this.vx * 0.1, (Math.random() - 0.5), 10, "#b8b8b8", 2, 0);
        if (this.y >= ENT.groundY) this.explode();
      } else {
        this.x += this.vx; this.y += this.vy;
        if (this.kind === "flame") { this.vy -= 0.04; this.vx *= 0.985; }
        if (this.y > ENT.groundY + 2) { this.dead = true; addPart(this.x, ENT.groundY, 0, -0.5, 6, "#c8a060", 2, 0); }
      }
      // 命中敌人
      if (this.dead) return;
      for (const e of ENT.enemies) {
        if (e.dying) continue;
        if (Math.abs(e.x - this.x) < 9 && this.y > e.y - 24 && this.y < e.y + 2) {
          if (this.kind === "grenade" || this.kind === "rocket") { this.explode(); return; }
          const blocked = e.takeHit(this.dmg, this.vx >= 0 ? 1 : -1, this.kind);
          if (this.kind === "flame") { this.dead = true; return; }
          if (!this.pierce && !blocked) { this.dead = true; return; }
          if (blocked) { this.dead = true; return; }
        }
      }
      // Boss 命中(由 level 注册)
      if (LEVEL.boss && LEVEL.boss.hittable() && !this.dead) {
        const b = LEVEL.boss;
        if (this.x > b.x - 34 && this.x < b.x + 34 && this.y > b.y - 52 && this.y < b.y) {
          if (this.kind === "grenade" || this.kind === "rocket") {
            b.takeHit(this.kind === "rocket" ? 5 : 4, this.y);
            this.explode();
            return;
          }
          b.takeHit(this.dmg, this.y);
          if (!this.pierce) { this.dead = true; return; }
        }
      }
      // 打爆油桶
      for (const br of ENT.barrels) {
        if (!br.dead && Math.abs(br.x - this.x) < 8 && this.y > br.y - 18 && this.y < br.y) {
          br.hp -= this.dmg;
          addPart(this.x, this.y, -this.vx * 0.2, -1, 6, "#ffe040", 2, 0);
          if (this.kind === "grenade" || this.kind === "rocket") { this.explode(); return; }
          if (!this.pierce) { this.dead = true; return; }
        }
      }
    }
    explode() {
      if (this.dead) return;
      this.dead = true;
      spawnExplosion(this.x, Math.min(this.y, ENT.groundY), this.kind === "rocket" ? 1.25 : 1.1, true);
    }
    draw(g, t) {
      if (this.kind === "grenade") { drawGrenade(g, this.x, this.y); return; }
      if (this.kind === "rocket") {
        R(g, this.x - 4, this.y - 2, 8, 4, "#5a626a"); R(g, this.x + (this.vx > 0 ? 2 : -5), this.y - 1, 3, 2, "#c03028");
        R(g, this.x - (this.vx > 0 ? 6 : -4), this.y - 1, 2, 2, "#ffe040"); return;
      }
      if (this.kind === "flame") {
        const s = 2 + (22 - this.life) * 0.14;
        R(g, this.x - s / 2, this.y - s / 2, s, s, Math.random() < 0.5 ? "#ff9020" : "#ffe040"); return;
      }
      if (this.kind === "laser") {
        R(g, this.x - 7, this.y - 1, 14, 2, "#e8f0ff"); R(g, this.x - 7, this.y - 2, 14, 1, "#80c0ff"); return;
      }
      R(g, this.x - 2, this.y - 1, 4, 2, this.kind === "pellet" ? "#ffd040" : "#fff0a0");
    }
  }

  /* ---------------- 敌方子弹 ---------------- */
  class EBullet {
    constructor(x, y, vx, vy, kind) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.kind = kind; this.dead = false; this.hp = kind === "rocket" ? 1 : 0;
    }
    update() {
      if (this.kind === "shell" || this.kind === "grenadeE") this.vy += 0.16;
      this.x += this.vx; this.y += this.vy;
      if (this.y >= ENT.groundY) {
        if (this.kind === "shot") { this.dead = true; addPart(this.x, ENT.groundY, 0, -0.5, 5, "#c8a060", 1, 0); }
        else { this.dead = true; spawnExplosion(this.x, ENT.groundY, this.kind === "shell" ? 1.1 : 0.8, true); }
        return;
      }
      const p = ENT.player;
      if (p && p.alive && p.invuln <= 0 && Math.abs(p.x - this.x) < 7 && this.y > p.y - 22 && this.y < p.y) {
        // 玩家在载具中时,子弹打中载具
        if (p.inVehicle) {
          p.inVehicle.takeHit(1);
          this.dead = true;
        } else {
          p.die(); this.dead = true;
        }
      }
    }
    draw(g) {
      if (this.kind === "rocket") {
        R(g, this.x - 4, this.y - 2, 8, 4, "#7a4a3a"); R(g, this.x - 1, this.y - 3, 2, 6, "#c06040");
      } else if (this.kind === "shell") {
        R(g, this.x - 2, this.y - 2, 5, 5, "#3a3f46"); R(g, this.x - 1, this.y - 1, 2, 2, "#6a7078");
      } else if (this.kind === "grenadeE") {
        drawGrenade(g, this.x, this.y);
      } else {
        R(g, this.x - 1, this.y - 1, 3, 3, "#ffe040"); R(g, this.x, this.y, 1, 1, "#ffffff");
      }
    }
  }

  /* ---------------- 敌军 ---------------- */
  const ECFG = {
    grunt:     { hp: 3, speed: 0.55, score: 100, pal: "grunt" },
    shield:    { hp: 4, speed: 0.38, score: 200, pal: "shield" },
    rocket:    { hp: 2, speed: 0.3,  score: 200, pal: "rocket" },
    grenadier: { hp: 2, speed: 0.45, score: 200, pal: "grenadier" },
    sniper:    { hp: 2, speed: 0.2,  score: 300, pal: "sniper" },
    kamikaze:  { hp: 1, speed: 1.2,  score: 150, pal: "kamikaze" },
  };
  class Enemy {
    constructor(type, x, y) {
      const c = ECFG[type] || ECFG.grunt;
      this.type = type; this.cfg = c;
      this.x = x; this.y = y || ENT.groundY; this.vy = 0;
      this.hp = c.hp; this.dir = -1; this.phase = Math.random() * 100;
      this.state = "walk"; this.t = 60 + Math.random() * 60;
      this.dying = false; this.dieT = 0; this.spin = 0; this.vx = 0;
      this.flash = 0; this.dead = false; this.fromSky = !!y && y < ENT.groundY;
    }
    takeHit(dmg, fromDir, kind) {
      if (this.dying) return false;
      // 盾牌兵正面格挡(攻击中除外)
      if (this.type === "shield" && this.state !== "attack" && kind !== "melee") {
        if ((fromDir > 0 && this.dir < 0) || (fromDir < 0 && this.dir > 0)) {
          AudioSys.sfx.clang();
          addPart(this.x + this.dir * 6, this.y - 12, fromDir * 1.5, -1, 6, "#ffe040", 2, 0);
          return true;
        }
      }
      this.hp -= dmg; this.flash = 4;
      addPart(this.x, this.y - 12, fromDir, -1, 5, "#fff0a0", 2, 0);
      if (this.hp <= 0) {
        this.dying = true; this.dieT = 42;
        this.vx = fromDir * (1.2 + Math.random()); this.vy = -3.4;
        AudioSys.sfx.enemyDie();
        GAME.addScore(this.cfg.score, this.x, this.y - 22);
        // 掉落
        const roll = Math.random();
        if (roll < 0.07) ENT.items.push(new Item(this.x, this.y - 20, "G"));
        else if (roll < 0.12) ENT.items.push(new Item(this.x, this.y - 20, ["H","S","R","F","L"][Math.floor(Math.random()*5)]));
        for (let i = 0; i < 4; i++) addPart(this.x, this.y - 10, (Math.random()-0.5)*2, -1-Math.random()*2, 16, "#c03028", 2, 0.2);
      }
      return false;
    }
    update() {
      this.flash = Math.max(0, this.flash - 1);
      if (this.dying) {
        this.vy += 0.4; this.x += this.vx; this.y += this.vy; this.spin += 0.25;
        if (this.y > ENT.groundY) { this.y = ENT.groundY; this.vy = 0; this.vx *= 0.8; }
        if (--this.dieT <= 0) {
          this.dead = true;
          for (let i = 0; i < 6; i++) addPart(this.x, this.y - 4, (Math.random()-0.5)*1.5, -0.8-Math.random(), 22, "#8a8a8a", 3, -0.01);
        }
        return;
      }
      const p = ENT.player;
      const dx = p && p.alive ? p.x - this.x : 0;
      const adx = Math.abs(dx);
      this.dir = dx >= 0 ? 1 : -1;
      this.phase += 1.2;
      this.t--;
      switch (this.type) {
        case "grunt":
          if (adx > 130) { this.x += this.dir * this.cfg.speed; this.state = "walk"; }
          else if (adx < 16) {
            this.state = "melee";
            if (this.t <= 0) {
              this.t = 50;
              if (p && p.alive && p.invuln <= 0 && Math.abs(p.x - this.x) < 18) p.die();
              AudioSys.sfx.melee();
            }
          } else {
            this.state = "attack";
            if (this.t <= 0) {
              this.t = 110 + Math.random() * 70;
              const ty = (p ? p.y - 12 : this.y - 12), dy = ty - (this.y - 12);
              const sp = 2.1, len = Math.max(1, Math.hypot(dx, dy));
              ENT.ebullets.push(new EBullet(this.x + this.dir * 8, this.y - 12, dx / len * sp, dy / len * sp, "shot"));
              AudioSys.sfx.shot("pistol");
            }
          }
          break;
        case "shield":
          if (adx > 90) this.x += this.dir * this.cfg.speed;
          if (this.t <= 0) {
            this.t = 150 + Math.random() * 60;
            this.state = "attack"; this.atkT = 30;
          }
          if (this.state === "attack") {
            this.atkT--;
            if (this.atkT === 15 && adx < 260) {
              const dy = (p ? p.y - 10 : 0) - (this.y - 10), sp = 2.3, len = Math.max(1, Math.hypot(dx, dy));
              ENT.ebullets.push(new EBullet(this.x + this.dir * 8, this.y - 10, dx / len * sp, dy / len * sp, "shot"));
              AudioSys.sfx.shot("pistol");
            }
            if (this.atkT <= 0) this.state = "walk";
          }
          break;
        case "rocket":
          if (adx < 60 && this.x > GAME.camX + 20) this.x -= this.dir * this.cfg.speed;   // 保持距离
          else if (adx > 220) this.x += this.dir * this.cfg.speed;
          if (this.t <= 0 && adx < 300) {
            this.t = 170 + Math.random() * 60;
            ENT.ebullets.push(new EBullet(this.x + this.dir * 8, this.y - 8, this.dir * 1.5, -0.4, "rocket"));
            AudioSys.sfx.shot("R");
          }
          break;
        case "grenadier":
          if (adx > 200) this.x += this.dir * this.cfg.speed;
          else if (adx < 70 && this.x > GAME.camX + 20) this.x -= this.dir * this.cfg.speed;
          if (this.t <= 0 && adx < 260) {
            this.t = 140 + Math.random() * 60;
            const power = Math.min(3.2, adx / 60);
            ENT.ebullets.push(new EBullet(this.x, this.y - 18, this.dir * power * 0.8, -3.2, "grenadeE"));
            AudioSys.sfx.throwG();
          }
          break;
        case "sniper":
          // 狙击手:保持远距离 250px,每 200 帧射一发高速精准子弹
          if (adx < 200 && this.x > GAME.camX + 20) this.x -= this.dir * this.cfg.speed;
          else if (adx > 320) this.x += this.dir * this.cfg.speed;
          this.state = adx < 200 ? "walk" : "attack";
          if (this.t <= 0 && adx < 400) {
            this.t = 200;
            const ty = (p ? p.y - 12 : this.y - 12), dy = ty - (this.y - 14);
            const sp = 4.5, len = Math.max(1, Math.hypot(dx, dy));
            ENT.ebullets.push(new EBullet(this.x + this.dir * 8, this.y - 14, dx / len * sp, dy / len * sp, "shot"));
            AudioSys.sfx.shot("L");
            ENT.addPart(this.x + this.dir * 10, this.y - 14, this.dir, 0, 5, "#ffe080", 3, 0);
          }
          break;
        case "kamikaze":
          // 自爆兵:快速冲向玩家,距离 < 25 时自爆
          this.x += this.dir * this.cfg.speed;
          this.x = Math.max(GAME.camX + 10, this.x);
          this.state = "walk";
          if (adx < 25 && p && p.alive) {
            // 自爆
            this.dying = true; this.dieT = 5; this.dead = true;
            spawnExplosion(this.x, this.y - 8, 0.9, true);
            AudioSys.sfx.enemyDie();
            GAME.addScore(this.cfg.score, this.x, this.y - 22);
          }
          break;
      }
      // 伞兵降落
      if (this.fromSky) {
        this.y += 1.1; this.vy = 0;
        if (this.y >= ENT.groundY) { this.y = ENT.groundY; this.fromSky = false; }
      }
    }
    draw(g, t) {
      const pal = this.cfg.pal;
      if (this.dying) {
        g.save();
        g.translate(Math.round(this.x), Math.round(this.y - 10));
        g.rotate(this.spin * this.dir);
        drawFighter(g, { x: 0, y: 10, dir: this.dir, pose: "jump", phase: this.phase, pal });
        g.restore();
        return;
      }
      let pose = "idle";
      if (this.fromSky) pose = "jump";
      else if (this.state === "attack" || this.state === "melee") pose = this.state === "melee" ? "melee" : "shoot";
      else if (this.state === "walk") pose = "run";
      if (this.type === "rocket" && !this.fromSky) pose = this.state === "attack" ? "shoot" : "crouch";
      drawFighter(g, { x: this.x, y: this.y, dir: this.dir, pose, phase: this.phase, pal, flash: this.flash });
      if (this.flash > 0) { // 受击白闪
        g.save(); g.globalAlpha = this.flash / 6; g.globalCompositeOperation = "lighter";
        drawFighter(g, { x: this.x, y: this.y, dir: this.dir, pose, phase: this.phase, pal, flash: 0 });
        g.restore();
      }
      // 盾牌兵的盾
      if (this.type === "shield" && this.state !== "attack") {
        const sx = this.x + this.dir * 5;
        R(g, sx - 1, this.y - 20, 3, 18, "#8a96a2");
        R(g, sx, this.y - 18, 1, 14, "#5a646e");
      }
      // 降落伞
      if (this.fromSky) {
        R(g, this.x - 7, this.y - 34, 15, 4, "#c84038");
        R(g, this.x - 7, this.y - 30, 1, 6, "#d8d8d0"); R(g, this.x + 7, this.y - 30, 1, 6, "#d8d8d0");
      }
    }
  }

  /* ---------------- 道具 ---------------- */
  class Item {
    constructor(x, y, kind, para) {
      this.x = x; this.y = y; this.kind = kind; this.vy = para ? 0.9 : -1.5;
      this.para = !!para; this.dead = false; this.grounded = false;
    }
    update() {
      if (!this.grounded) {
        if (!this.para) this.vy += 0.25;
        this.y += this.vy;
        if (this.para) this.x += Math.sin(this.y * 0.05) * 0.4;
        if (this.y >= ENT.groundY) { this.y = ENT.groundY; this.vy = 0; this.grounded = true; }
      }
      const p = ENT.player;
      if (p && p.alive && Math.abs(p.x - this.x) < 12 && Math.abs(p.y - this.y) < 22) {
        this.dead = true;
        AudioSys.sfx.pickup();
        if (this.kind === "G") { p.grenades = Math.min(99, p.grenades + 5); addFloat(this.x, this.y - 16, "GRENADE+5", "#a0e080"); }
        else if (this.kind === "T") { GAME.addScore(1000, this.x, this.y - 16); }
        else { p.giveWeapon(this.kind); addFloat(this.x, this.y - 16, WEAPONS[this.kind].name, "#ffe080"); }
      }
    }
    draw(g, t) {
      if (this.para && !this.grounded) drawParachute(g, this.x, this.y, this.kind, t);
      else drawItemBox(g, this.x, this.y - 4, this.kind, t);
    }
  }

  /* ---------------- 人质 ---------------- */
  class Hostage {
    constructor(x) {
      this.x = x; this.y = ENT.groundY;
      this.state = "tied"; this.t = 0; this.dead = false; this.phase = Math.random() * 60;
      this.gift = Math.random() < 0.55 ? ["H","S","R","F","L"][Math.floor(Math.random()*5)] : (Math.random() < 0.5 ? "G" : "T");
    }
    update() {
      this.phase++;
      const p = ENT.player;
      if (this.state === "tied" && p && p.alive && Math.abs(p.x - this.x) < 14 && Math.abs(p.y - this.y) < 20) {
        this.state = "freed"; this.t = 50;
        AudioSys.sfx.hostage(); AudioSys.voice("Thank you!");
        GAME.hostages++; GAME.addScore(500, this.x, this.y - 24);
        ENT.items.push(new Item(this.x + 8 * (p.dir || 1), this.y - 14, this.gift));
      } else if (this.state === "freed") {
        if (--this.t <= 0) this.state = "run";
      } else if (this.state === "run") {
        this.x += 2.2;
        if (this.x > GAME.camX + GAME.VW + 40) this.dead = true;
      }
    }
    draw(g) {
      const pose = this.state === "tied" ? "tied" : this.state === "freed" ? "salute" : "run";
      drawFighter(g, { x: this.x, y: this.y, dir: 1, pose, phase: this.phase, pal: "hostage" });
      if (this.state === "tied" && Math.floor(this.phase / 24) % 2 === 0) {
        drawText(g, "HELP!", this.x - 10, this.y - 34, "#ffe080", 1);
      }
    }
  }

  /* ---------------- 油桶 ---------------- */
  class Barrel {
    constructor(x) { this.x = x; this.y = ENT.groundY; this.hp = 3; this.dead = false; }
    update() {
      if (!this.dead && this.hp <= 0) {
        this.dead = true;
        spawnExplosion(this.x, this.y - 8, 1.6, true);
        // 火焰残留
        for (let i = 0; i < 10; i++) addPart(this.x + (Math.random()-0.5)*16, this.y - 2, (Math.random()-0.5), -1-Math.random()*1.5, 30, "#ff8020", 3, 0.05);
      }
    }
    draw(g) {
      if (this.dead) return;
      R(g, this.x - 7, this.y - 16, 14, 16, "#a03828");
      R(g, this.x - 7, this.y - 13, 14, 2, "#7a2818");
      R(g, this.x - 7, this.y - 6, 14, 2, "#7a2818");
      R(g, this.x - 7, this.y - 16, 14, 2, "#c05038");
      if (this.hp < 3) R(g, this.x - 3, this.y - 10, 6, 4, "#3a2a20"); // 弹孔
    }
  }

  /* ---------------- 载具:SV-001 合金弹头坦克 ---------------- */
  class Vehicle {
    constructor(x) {
      this.x = x; this.y = ENT.groundY;
      this.hp = 3; this.maxHp = 3; this.dir = 1;
      this.occupied = false; this.cannonCd = 0;
      this.phase = 0; this.flash = 0; this.dead = false;
      this.vy = 0; this.onGround = true; this.cannonAng = 0;
    }
    update(player) {
      this.phase += 0.3;
      this.flash = Math.max(0, this.flash - 1);
      this.cannonCd = Math.max(0, this.cannonCd - 1);
      if (!this.occupied) return;
      // 被玩家占据时:跟随玩家移动
      const mx = (Input.held("left") ? -1 : 0) + (Input.held("right") ? 1 : 0);
      if (mx !== 0) this.dir = mx > 0 ? 1 : -1;
      this.x += mx * 2.2;
      this.phase += Math.abs(mx) * 1.5;
      // 跳跃(跳跃力比步行低)
      if (Input.pressed("jump") && this.onGround) {
        this.vy = -7.5; this.onGround = false; AudioSys.sfx.jump();
      }
      this.vy += 0.5; this.y += this.vy;
      if (this.y >= ENT.groundY) { this.y = ENT.groundY; this.vy = 0; this.onGround = true; }
      // 屏幕内活动范围
      const camL = GAME.camX + 10, camR = GAME.camX + GAME.VW - 10;
      this.x = Math.max(camL, Math.min(camR, this.x));
      // 碾压小兵:碰到敌人直接杀死
      for (const e of ENT.enemies) {
        if (!e.dying && Math.abs(e.x - this.x) < 24 && Math.abs(e.y - this.y) < 30) {
          e.takeHit(10, this.dir, "melee");
        }
      }
      // 开炮
      if (Input.held("fire") && this.cannonCd <= 0) {
        this.fireCannon(player);
      }
      // 更新炮塔角度(基于玩家瞄准方向)
      const aim = player ? player.aim : "mid";
      if (aim === "up") this.cannonAng = -Math.PI / 2;
      else if (aim === "down") this.cannonAng = Math.PI / 2;
      else if (aim === "up-fwd") this.cannonAng = -Math.PI / 4;
      else if (aim === "down-fwd") this.cannonAng = Math.PI / 4;
      else this.cannonAng = 0;
    }
    fireCannon(player) {
      this.cannonCd = 25;
      AudioSys.sfx.shot("R");
      const aim = player.aim || "mid";
      let vx = 0, vy = 0;
      const sp = 5;
      if (aim === "up") vy = -sp;
      else if (aim === "down") vy = sp;
      else if (aim === "up-fwd") { vx = this.dir * sp * 0.7; vy = -sp * 0.7; }
      else if (aim === "down-fwd") { vx = this.dir * sp * 0.7; vy = sp * 0.7; }
      else vx = this.dir * sp;
      const bx = this.x + (vx !== 0 ? this.dir * 14 : 2), by = this.y - 22;
      ENT.bullets.push(new Bullet(bx, by, vx, vy, "rocket", 3));
      // 枪口火光
      addPart(bx, by, vx * 0.1, vy * 0.1, 6, "#ffe080", 5, 0);
      addPart(bx, by, 0, 0, 4, "#ffffff", 3, 0);
    }
    takeHit(dmg) {
      this.hp -= dmg; this.flash = 4;
      if (this.hp <= 0) {
        // 爆炸并弹射玩家
        spawnExplosion(this.x, this.y - 12, 1.5, false);
        if (this.occupied) {
          const p = ENT.player;
          if (p) {
            p.inVehicle = null;
            p.reset(this.x + 30);
            p.invuln = 80;
          }
          this.occupied = false;
        }
        this.dead = true;
      }
    }
    draw(g) {
      SPR.drawVehicle(g, this);
    }
  }

  /* ---------------- 统一更新与绘制 ---------------- */
  ENT.update = function () {
    ENT.time++;
    for (const arr of [ENT.bullets, ENT.ebullets, ENT.enemies, ENT.items, ENT.hostages, ENT.barrels]) {
      for (const o of arr) o.update();
    }
    // 载具更新:被占据的载具已由 Player.update() 驱动,这里只更新空闲载具
    for (const v of ENT.vehicles) {
      if (!v.occupied) v.update(null);
    }
    for (const p of ENT.parts) {
      p.life--; p.x += p.vx; p.y += p.vy; p.vy += p.grav;
      if (p.ring) p.size += 1.6;
    }
    ENT.parts = ENT.parts.filter(p => p.life > 0);
    for (const f of ENT.floats) { f.life--; f.y -= 0.5; }
    ENT.floats = ENT.floats.filter(f => f.life > 0);
    ENT.bullets = ENT.bullets.filter(b => !b.dead && b.x > GAME.camX - 40 && b.x < GAME.camX + GAME.VW + 80);
    ENT.ebullets = ENT.ebullets.filter(b => !b.dead && b.x > GAME.camX - 60 && b.x < GAME.camX + GAME.VW + 100 && b.y < 300);
    ENT.enemies = ENT.enemies.filter(e => !e.dead && e.x > GAME.camX - 120 && e.x < GAME.camX + GAME.VW + 160);
    ENT.items = ENT.items.filter(i => !i.dead);
    ENT.hostages = ENT.hostages.filter(h => !h.dead);
    ENT.barrels = ENT.barrels.filter(b => !b.dead);
    ENT.vehicles = ENT.vehicles.filter(v => !v.dead);
    ENT.shake *= 0.86;
    if (ENT.shake < 0.1) ENT.shake = 0;
  };

  ENT.drawParts = function (g) {
    for (const p of ENT.parts) {
      const a = Math.max(0, p.life / p.maxLife);
      g.globalAlpha = a;
      if (p.ring) {
        g.strokeStyle = p.color; g.lineWidth = 2;
        g.strokeRect(Math.round(p.x - p.size), Math.round(p.y - p.size / 2), Math.round(p.size * 2), Math.round(p.size));
      } else {
        R(g, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size, p.color);
      }
    }
    g.globalAlpha = 1;
    for (const f of ENT.floats) {
      g.globalAlpha = Math.min(1, f.life / 30);
      drawText(g, f.text, f.x - SPR.textWidth(f.text, 1) / 2, f.y, f.color, 1);
    }
    g.globalAlpha = 1;
  };

  ENT.reset = function () {
    ENT.bullets = []; ENT.ebullets = []; ENT.enemies = []; ENT.items = [];
    ENT.hostages = []; ENT.parts = []; ENT.floats = []; ENT.barrels = [];
    ENT.vehicles = [];
    ENT.shake = 0; ENT.time = 0;
  };

  ENT.Player = Player; ENT.Enemy = Enemy; ENT.Item = Item; ENT.Hostage = Hostage;
  ENT.Barrel = Barrel; ENT.EBullet = EBullet; ENT.WEAPONS = WEAPONS; ENT.Vehicle = Vehicle;
  ENT.spawnExplosion = spawnExplosion; ENT.addFloat = addFloat; ENT.addPart = addPart;

  window.ENT = ENT;
})();