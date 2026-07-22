/* ============================================================
 * level.js — 多层视差沙漠战场 / 区域锁屏清场 / 坦克 Boss
 * ============================================================ */
(function () {
  "use strict";
  const { R, drawText, textWidth } = SPR;

  const LEVEL = {
    length: 2500,
    bossLockX: 2020,      // Boss 战场锁屏位置
    boss: null,
    bossDefeated: false,
    zones: [],
    supplyDrops: [],
  };

  /* ---------------- 关卡布点 ---------------- */
  LEVEL.setup = function () {
    LEVEL.boss = null;
    LEVEL.bossDefeated = false;
    LEVEL.zones = [
      { trigger: 240,  lockX: 240,  list: null, cleared: false,
        spawns: [ {t:"grunt",x:520},{t:"grunt",x:580},{t:"grenadier",x:660},{t:"grunt",x:720} ] },
      { trigger: 700,  lockX: 700,  list: null, cleared: false,
        spawns: [ {t:"grunt",x:960},{t:"shield",x:1030},{t:"rocket",x:1120},{t:"grunt",x:1180},{t:"grenadier",x:1260} ] },
      { trigger: 1160, lockX: 1160, list: null, cleared: false,
        spawns: [ {t:"grunt",x:1420,sky:60},{t:"grunt",x:1480,sky:30},{t:"shield",x:1500},{t:"rocket",x:1600},{t:"grunt",x:1660},{t:"grenadier",x:1720} ] },
      { trigger: 1620, lockX: 1620, list: null, cleared: false,
        spawns: [ {t:"shield",x:1880},{t:"grunt",x:1930},{t:"rocket",x:1980},{t:"grenadier",x:2040},{t:"grunt",x:2090,sky:40},{t:"grunt",x:2130,sky:80} ] },
    ];
    LEVEL.supplyDrops = [
      { trigger: 480,  kind: "H", done: false },
      { trigger: 1080, kind: "S", done: false },
      { trigger: 1560, kind: "R", done: false },
      { trigger: 1900, kind: "F", done: false },
    ];
    // 静态布防:人质与油桶
    ENT.hostages.push(new ENT.Hostage(420), new ENT.Hostage(1010), new ENT.Hostage(1700));
    ENT.barrels.push(new ENT.Barrel(620), new ENT.Barrel(1240), new ENT.Barrel(1300), new ENT.Barrel(1840));
    ENT.items.push(new ENT.Item(300, ENT.groundY - 30, "H"));
  };

  /* ---------------- 更新:出怪 / 锁屏 / 补给 ---------------- */
  LEVEL.update = function () {
    const camR = GAME.camX + GAME.VW;
    for (const z of LEVEL.zones) {
      if (!z.list && camR > z.trigger + 400) {
        z.list = z.spawns.map(s => {
          const e = new ENT.Enemy(s.t, s.x, s.sky ? ENT.groundY - s.sky - 60 : ENT.groundY);
          if (s.sky) e.fromSky = true;
          ENT.enemies.push(e);
          return e;
        });
      }
      if (z.list && !z.cleared && z.list.every(e => e.dead)) {
        z.cleared = true;
        AudioSys.sfx.missionClear();
        ENT.addFloat(GAME.camX + GAME.VW / 2, 100, "AREA CLEAR!", "#a0e080");
      }
    }
    for (const d of LEVEL.supplyDrops) {
      if (!d.done && camR > d.trigger + 400) {
        d.done = true;
        ENT.items.push(new ENT.Item(GAME.camX + GAME.VW / 2, 30, d.kind, true));
      }
    }
    // Boss 触发
    if (!LEVEL.boss && !LEVEL.bossDefeated && GAME.camX >= LEVEL.bossLockX) {
      LEVEL.boss = new Boss(GAME.camX + GAME.VW + 90);
      AudioSys.sfx.alarm();
      AudioSys.bgm.start("boss");
    }
    if (LEVEL.boss) {
      LEVEL.boss.update();
      if (LEVEL.boss.dead) {
        LEVEL.boss = null;
        LEVEL.bossDefeated = true;
        GAME.missionComplete();
      }
    }
  };

  /* 相机锁定时返回锁定的最大 camX,否则返回 Infinity */
  LEVEL.cameraLock = function () {
    for (const z of LEVEL.zones) {
      if (z.list && !z.cleared) return Math.min(z.lockX, LEVEL.length - GAME.VW);
    }
    if (LEVEL.boss) return LEVEL.bossLockX;
    return Infinity;
  };

  /* ---------------- 背景绘制(多层视差) ---------------- */
  function lerp(a, b, t) { return a + (b - a) * t; }

  LEVEL.drawBackground = function (g, camX, t) {
    const VW = GAME.VW, VH = GAME.VH, gy = ENT.groundY;
    // 天空:黄昏沙漠渐变
    const grad = g.createLinearGradient(0, 0, 0, gy);
    grad.addColorStop(0, "#2a1a3e");
    grad.addColorStop(0.45, "#7a2e4a");
    grad.addColorStop(0.75, "#d8643c");
    grad.addColorStop(1, "#f0a050");
    g.fillStyle = grad; g.fillRect(0, 0, VW, gy);
    // 落日
    R(g, VW / 2 - 24, gy - 92, 48, 40, "#ffd870");
    R(g, VW / 2 - 20, gy - 96, 40, 44, "#ffe890");
    for (let i = 0; i < 4; i++) R(g, VW / 2 - 22, gy - 80 + i * 9, 44, 2, "#f0a050"); // 落日条纹
    // 云(0.1x 慢速)
    g.fillStyle = "rgba(240,140,90,0.5)";
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 220 - camX * 0.1 + t * 0.06) % (VW + 160) + VW + 160) % (VW + 160) - 80;
      R(g, cx, 30 + (i % 3) * 22, 46 + (i % 2) * 20, 6, "rgba(230,120,80,0.45)");
      R(g, cx + 8, 26 + (i % 3) * 22, 30, 4, "rgba(240,150,100,0.4)");
    }
    // 远景沙丘(0.25x)
    g.fillStyle = "#8a4a3a";
    for (let i = -1; i < 8; i++) {
      const bx = i * 130 - (camX * 0.25) % 130;
      const h = 26 + ((i * 37) % 18);
      g.beginPath();
      g.moveTo(bx - 20, gy);
      g.quadraticCurveTo(bx + 45, gy - h - 14, bx + 130, gy);
      g.fill();
    }
    // 金字塔与遗迹剪影(0.4x)
    g.fillStyle = "#5e3038";
    for (let i = -1; i < 10; i++) {
      const bx = i * 210 - (camX * 0.4) % 210;
      if (i % 3 === 0) { // 金字塔
        g.beginPath(); g.moveTo(bx, gy); g.lineTo(bx + 42, gy - 58); g.lineTo(bx + 84, gy); g.fill();
        g.fillStyle = "#6e3a40"; g.beginPath(); g.moveTo(bx + 42, gy - 58); g.lineTo(bx + 56, gy); g.lineTo(bx + 84, gy); g.fill();
        g.fillStyle = "#5e3038";
      } else if (i % 3 === 1) { // 残破柱廊
        for (let c = 0; c < 4; c++) R(g, bx + c * 16, gy - 34 - (c % 2) * 6, 6, 34 + (c % 2) * 6, "#5e3038");
        R(g, bx - 4, gy - 40, 68, 6, "#5e3038");
      }
    }
    // 中景:破败建筑与棕榈树(0.65x)
    for (let i = -1; i < 12; i++) {
      const bx = i * 170 - (camX * 0.65) % 170;
      if (i % 2 === 0) {
        R(g, bx, gy - 46, 52, 46, "#7a4a3e");
        R(g, bx, gy - 46, 52, 4, "#8e5a4a");
        R(g, bx + 6, gy - 36, 8, 10, "#3a2030");
        R(g, bx + 22, gy - 30, 8, 8, "#3a2030");
        R(g, bx + 36, gy - 38, 8, 12, "#3a2030");
        R(g, bx + 40, gy - 52, 8, 6, "#7a4a3e"); // 破损顶部
      } else {
        // 棕榈树
        R(g, bx + 20, gy - 30, 4, 30, "#5e4028");
        for (let f = 0; f < 5; f++) {
          const ang = -Math.PI / 2 + (f - 2) * 0.5;
          const fx = bx + 22 + Math.cos(ang) * 13, fy = gy - 30 + Math.sin(ang) * 8;
          R(g, Math.min(fx, bx + 22), Math.min(fy, gy - 32), Math.abs(fx - bx - 22) + 3, 3, "#3f6a34");
        }
      }
    }
    // 地面
    R(g, 0, gy, VW, VH - gy, "#c89458");
    R(g, 0, gy, VW, 3, "#e0b070");
    R(g, 0, gy + 12, VW, 1, "#b07c44");
    // 地面纹理(随相机滚动)
    for (let i = 0; i < 26; i++) {
      const wx = i * 47, sx = wx - (camX % (47 * 26)) + (camX % 47 > 0 ? 0 : 0);
      const xx = (wx - camX) % (47 * 26);
      if (xx > -20 && xx < VW + 20) {
        R(g, xx, gy + 6 + (i % 3) * 8, 8 + (i % 2) * 6, 1, "#a87c48");
        if (i % 5 === 0) R(g, xx + 10, gy + 16, 3, 2, "#907040");
      }
    }
    // 前景枯草(1.2x)
    for (let i = 0; i < 10; i++) {
      const xx = (i * 173 - camX * 1.18) % (VW + 80);
      const fx = xx < -40 ? xx + VW + 80 : xx;
      if (fx > -20 && fx < VW + 20) {
        R(g, fx, gy + 22 + (i % 2) * 6, 2, 6, "#8a6a38");
        R(g, fx + 3, gy + 24 + (i % 2) * 6, 2, 4, "#77603a");
      }
    }
  };

  /* ---------------- GO! 前进箭头 ---------------- */
  LEVEL.drawGoArrow = function (g, t) {
    const lock = LEVEL.cameraLock();
    if (lock !== Infinity || LEVEL.bossDefeated || GAME.state !== "play") return;
    if (GAME.camX < LEVEL.length - GAME.VW - 4 && Math.floor(t / 18) % 2 === 0) {
      const x = GAME.VW - 46, y = 84;
      drawText(g, "GO!", x, y, "#ffe040", 2);
      drawText(g, ">", x + 36 + Math.sin(t * 0.15) * 3, y, "#ff8020", 2);
    }
  };

  /* ============================================================
   * Boss:重型装甲战车
   * ============================================================ */
  class Boss {
    constructor(x) {
      this.x = x; this.y = ENT.groundY;
      this.hp = 260; this.maxHp = 260;
      this.state = "enter"; this.t = 0;
      this.atkCd = 120; this.pattern = 0; this.subT = 0; this.subN = 0;
      this.tread = 0; this.flash = 0; this.cannonGlow = 0;
      this.targetX = LEVEL.bossLockX + GAME.VW - 120;
      this.dead = false; this.dieT = 0;
      this.chargeDir = 0; this.vx = 0;
    }
    hittable() { return this.state === "fight"; }
    takeHit(d) {
      if (!this.hittable()) return;
      this.hp -= d; this.flash = 3;
      ENT.addPart(this.x - 30 + Math.random() * 20, this.y - 30 + Math.random() * 16, -1, -1, 8, "#ffe040", 2, 0);
      if (this.hp <= 0) {
        this.state = "dying"; this.dieT = 260;
        AudioSys.sfx.explosion(true);
      }
    }
    update() {
      this.flash = Math.max(0, this.flash - 1);
      this.tread += Math.abs(this.vx) * 2 + 0.3;
      const p = ENT.player;
      switch (this.state) {
        case "enter":
          this.vx = -1.6; this.x += this.vx;
          if (Math.random() < 0.4) ENT.addPart(this.x + 30, this.y - 2, 0.5, -0.5, 20, "#9a8a70", 3, 0);
          if (this.x <= this.targetX) { this.state = "fight"; this.vx = 0; this.t = 0; }
          break;
        case "fight": {
          this.t++;
          this.cannonGlow = Math.max(0, this.cannonGlow - 1);
          // 车体碾压判定
          if (p && p.alive && p.invuln <= 0 && Math.abs(p.x - this.x) < 34 && p.y > this.y - 46) p.die();
          // 缓慢逼近
          if (this.subT <= 0 && p && Math.abs(p.x - this.x) > 130) this.vx = (p.x < this.x ? -0.25 : 0.25);
          else if (this.subT <= 0) this.vx = 0;
          this.x += this.vx;
          this.x = Math.max(LEVEL.bossLockX + 120, Math.min(LEVEL.bossLockX + GAME.VW - 60, this.x));
          // 冒烟/起火(损伤阶段)
          if (this.hp < this.maxHp * 0.55 && Math.random() < 0.3)
            ENT.addPart(this.x + 10, this.y - 44, 0.2, -0.8, 26, "#555", 3, -0.02);
          if (this.hp < this.maxHp * 0.28 && Math.random() < 0.4)
            ENT.addPart(this.x - 14, this.y - 30, 0, -1, 12, "#ff7020", 2, 0);
          // 攻击循环
          if (this.subT > 0) {
            this.subT--;
            this.runPattern(p);
          } else {
            this.atkCd--;
            if (this.atkCd <= 0) {
              this.pattern = (this.pattern + 1) % 3;
              this.subN = 0;
              if (this.pattern === 0) { this.subT = 80; this.cannonGlow = 40; }   // 曲射炮弹
              else if (this.pattern === 1) { this.subT = 90; }                    // 机枪扫射
              else { this.subT = 70; this.chargeDir = p && p.x < this.x ? -1 : 1; } // 冲撞
              this.atkCd = Math.max(60, 130 - (1 - this.hp / this.maxHp) * 70);
            }
          }
          break;
        }
        case "dying":
          this.dieT--;
          if (this.dieT % 7 === 0) {
            ENT.spawnExplosion(this.x - 34 + Math.random() * 68, this.y - 8 - Math.random() * 40, 0.8 + Math.random() * 0.7, false);
          }
          if (this.dieT % 30 === 0) AudioSys.sfx.explosion(true);
          if (this.dieT <= 0) {
            ENT.spawnExplosion(this.x, this.y - 24, 2.6, false);
            ENT.spawnExplosion(this.x - 24, this.y - 10, 1.8, false);
            ENT.spawnExplosion(this.x + 24, this.y - 10, 1.8, false);
            this.dead = true;
            GAME.addScore(20000, this.x, this.y - 60);
          }
          break;
      }
    }
    runPattern(p) {
      const px = p ? p.x : this.x - 100;
      if (this.pattern === 0) {
        // 曲射炮弹 ×3
        if (this.subT % 24 === 0 && this.subN < 3) {
          this.subN++;
          const sx = this.x - 20, sy = this.y - 50;
          const frames = 70, dx = px - sx;
          ENT.ebullets.push(new ENT.EBullet(sx, sy, dx / frames, -4.6, "shell"));
          AudioSys.sfx.shot("R");
          ENT.addPart(sx - 4, sy, -1, -1, 8, "#ffe080", 4, 0);
        }
      } else if (this.pattern === 1) {
        // 机枪扫射
        if (this.subT % 9 === 0 && this.subN < 8) {
          this.subN++;
          const sx = this.x - 34, sy = this.y - 20;
          const dy = (p ? p.y - 10 : sy) - sy, dx = px - sx;
          const len = Math.max(1, Math.hypot(dx, dy)), sp = 3.1;
          ENT.ebullets.push(new ENT.EBullet(sx, sy, dx / len * sp, dy / len * sp, "shot"));
          AudioSys.sfx.shot("H");
          ENT.addPart(sx - 3, sy, -0.5, 0, 4, "#ffe080", 3, 0);
        }
      } else {
        // 冲撞
        if (this.subT > 40) {
          this.vx = this.chargeDir * 2.6; this.x += this.vx;
          if (Math.random() < 0.5) ENT.addPart(this.x - this.chargeDir * 36, this.y - 2, -this.chargeDir, -0.5, 14, "#9a8a70", 3, 0);
        } else this.vx = 0;
        this.x = Math.max(LEVEL.bossLockX + 60, Math.min(LEVEL.bossLockX + GAME.VW - 50, this.x));
      }
    }
    draw(g) {
      const x = Math.round(this.x), y = Math.round(this.y);
      const dmg = 1 - this.hp / this.maxHp;
      // 履带
      R(g, x - 38, y - 14, 76, 14, "#2e3338");
      for (let i = 0; i < 8; i++) {
        const tx = x - 36 + ((i * 10 + this.tread * 3) % 74);
        R(g, tx, y - 12, 5, 10, "#454c54");
      }
      R(g, x - 34, y - 11, 10, 8, "#1e2226"); R(g, x + 24, y - 11, 10, 8, "#1e2226");
      // 车体
      R(g, x - 34, y - 38, 68, 26, dmg > 0.55 ? "#4a4a42" : "#565a4a");
      R(g, x - 34, y - 38, 68, 4, dmg > 0.55 ? "#3a3a34" : "#686c58");
      R(g, x - 30, y - 30, 12, 8, "#2e3338");
      R(g, x + 14, y - 30, 12, 8, "#2e3338");
      R(g, x - 38, y - 20, 6, 6, "#6a7060"); // 前灯
      if (Math.floor(ENT.time / 30) % 2 === 0) R(g, x - 37, y - 19, 4, 4, "#ffe040");
      // 炮塔
      R(g, x - 16, y - 52, 34, 16, dmg > 0.55 ? "#42423a" : "#505444");
      R(g, x - 16, y - 52, 34, 3, "#33332c");
      R(g, x + 2, y - 56, 8, 4, "#33332c"); // 舱盖
      // 主炮(指向玩家)
      const p = ENT.player;
      const ang = p ? Math.atan2((p.y - 14) - (y - 46), p.x - (x - 16)) : Math.PI;
      const cl = 30;
      const cx = x - 16 + Math.cos(ang) * cl, cy = y - 46 + Math.sin(ang) * cl;
      g.strokeStyle = this.cannonGlow > 0 && Math.floor(this.cannonGlow / 4) % 2 ? "#ffe040" : "#3a3f36";
      g.lineWidth = 5;
      g.beginPath(); g.moveTo(x - 16, y - 46); g.lineTo(cx, cy); g.stroke();
      g.lineWidth = 2; g.strokeStyle = "#23261f";
      g.beginPath(); g.moveTo(x - 16, y - 44); g.lineTo(cx, cy + 2); g.stroke();
      // 天线
      R(g, x + 16, y - 66, 1, 14, "#2a2d28");
      if (Math.floor(ENT.time / 16) % 2 === 0) R(g, x + 15, y - 68, 3, 3, "#ff4030");
      // 受击闪白
      if (this.flash > 0) {
        g.save(); g.globalAlpha = this.flash / 5; g.globalCompositeOperation = "lighter";
        R(g, x - 34, y - 52, 68, 40, "#ffffff");
        g.restore();
      }
      // 濒死前的持续爆炸火花
      if (this.state === "dying" && Math.random() < 0.3) {
        R(g, x - 30 + Math.random() * 60, y - 50 + Math.random() * 40, 3, 3, "#ffe040");
      }
    }
    drawHP(g) {
      const w = 200, x = (GAME.VW - w) / 2, y = 14;
      drawText(g, "ARMORED VEHICLE", x + w / 2 - textWidth("ARMORED VEHICLE", 1) / 2, y - 8, "#ff6050", 1);
      R(g, x - 2, y - 2, w + 4, 8, "#1a1a24");
      R(g, x, y, w, 4, "#401818");
      const hw = Math.max(0, w * this.hp / this.maxHp);
      R(g, x, y, hw, 4, this.hp < this.maxHp * 0.28 ? "#ff3020" : "#e0a020");
      R(g, x, y, hw, 1, "#ffe080");
    }
  }

  LEVEL.Boss = Boss;
  window.LEVEL = LEVEL;
})();
