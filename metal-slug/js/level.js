/* ============================================================
 * level.js — 多层视差沙漠战场 / 区域锁屏清场 / 坦克 Boss
 * ============================================================ */
(function () {
  "use strict";
  const { R, drawText, textWidth } = SPR;

  const LEVEL = {
    stage: 1, totalStages: 3,
    length: 2500,
    bossLockX: 2020,
    boss: null,
    bossDefeated: false,
    zones: [],
    supplyDrops: [],
    theme: "desert",
  };

  /* ---------------- 关卡数据(3关) ---------------- */
  const STAGES = [
    { // Stage 1: 沙漠
      theme: "desert", length: 2500, bossLockX: 2020, bossHp: 140,
      zones: [
        { trigger: 240,  lockX: 240,  list: null, cleared: false,
          spawns: [ {t:"grunt",x:520},{t:"grunt",x:580},{t:"grenadier",x:660},{t:"grunt",x:720} ] },
        { trigger: 700,  lockX: 700,  list: null, cleared: false,
          spawns: [ {t:"grunt",x:960},{t:"shield",x:1030},{t:"rocket",x:1120},{t:"grunt",x:1180},{t:"grenadier",x:1260} ] },
        { trigger: 1160, lockX: 1160, list: null, cleared: false,
          spawns: [ {t:"grunt",x:1420,sky:60},{t:"grunt",x:1480,sky:30},{t:"shield",x:1500},{t:"rocket",x:1600},{t:"grunt",x:1660},{t:"grenadier",x:1720} ] },
        { trigger: 1620, lockX: 1620, list: null, cleared: false,
          spawns: [ {t:"shield",x:1880},{t:"grunt",x:1930},{t:"rocket",x:1980},{t:"grenadier",x:2040},{t:"grunt",x:2090,sky:40},{t:"grunt",x:2130,sky:80} ] },
      ],
      supplies: [ {trigger:480,kind:"H"},{trigger:1080,kind:"S"},{trigger:1560,kind:"R"},{trigger:1900,kind:"F"} ],
      hostages: [420,1010,1700], barrels: [620,1240,1300,1840], vehicleX: 350, startItem: "H",
    },
    { // Stage 2: 丛林
      theme: "jungle", length: 2600, bossLockX: 2120, bossHp: 170,
      zones: [
        { trigger: 240,  lockX: 240,  list: null, cleared: false,
          spawns: [ {t:"grunt",x:520},{t:"sniper",x:600},{t:"kamikaze",x:680},{t:"grunt",x:740} ] },
        { trigger: 700,  lockX: 700,  list: null, cleared: false,
          spawns: [ {t:"shield",x:960},{t:"sniper",x:1050},{t:"grunt",x:1150},{t:"kamikaze",x:1220},{t:"grenadier",x:1300} ] },
        { trigger: 1200, lockX: 1200, list: null, cleared: false,
          spawns: [ {t:"grunt",x:1460,sky:60},{t:"sniper",x:1540},{t:"shield",x:1620},{t:"rocket",x:1700},{t:"kamikaze",x:1780},{t:"grenadier",x:1850} ] },
        { trigger: 1700, lockX: 1700, list: null, cleared: false,
          spawns: [ {t:"shield",x:1960},{t:"sniper",x:2010},{t:"rocket",x:2070},{t:"kamikaze",x:2120,sky:40},{t:"grunt",x:2170,sky:60},{t:"grenadier",x:2230} ] },
      ],
      supplies: [ {trigger:480,kind:"S"},{trigger:1100,kind:"F"},{trigger:1620,kind:"L"},{trigger:1980,kind:"R"} ],
      hostages: [440,1080,1760], barrels: [640,1280,1380,1920], vehicleX: 1450, startItem: "S",
    },
    { // Stage 3: 军事基地
      theme: "base", length: 2700, bossLockX: 2220, bossHp: 200,
      zones: [
        { trigger: 260,  lockX: 260,  list: null, cleared: false,
          spawns: [ {t:"shield",x:540},{t:"sniper",x:620},{t:"grunt",x:700},{t:"kamikaze",x:780} ] },
        { trigger: 740,  lockX: 740,  list: null, cleared: false,
          spawns: [ {t:"shield",x:1000},{t:"rocket",x:1080},{t:"sniper",x:1160},{t:"grenadier",x:1240},{t:"kamikaze",x:1320} ] },
        { trigger: 1260, lockX: 1260, list: null, cleared: false,
          spawns: [ {t:"grunt",x:1520,sky:60},{t:"shield",x:1600},{t:"sniper",x:1680},{t:"rocket",x:1760},{t:"kamikaze",x:1840},{t:"grenadier",x:1920} ] },
        { trigger: 1780, lockX: 1780, list: null, cleared: false,
          spawns: [ {t:"shield",x:2040},{t:"sniper",x:2100},{t:"rocket",x:2160},{t:"kamikaze",x:2220,sky:40},{t:"grunt",x:2280,sky:60},{t:"grenadier",x:2340} ] },
        { trigger: 2150, lockX: 2150, list: null, cleared: false,
          spawns: [ {t:"shield",x:2410},{t:"sniper",x:2460},{t:"rocket",x:2520},{t:"kamikaze",x:2580},{t:"grenadier",x:2640} ] },
      ],
      supplies: [ {trigger:500,kind:"H"},{trigger:1140,kind:"L"},{trigger:1680,kind:"S"},{trigger:2080,kind:"F"} ],
      hostages: [460,1200,1860,2300], barrels: [660,1320,1420,1960,2400], vehicleX: 1550, startItem: "H",
    },
  ];

  /* ---------------- 关卡布点 ---------------- */
  LEVEL.setup = function (stageNum) {
    const s = STAGES[(stageNum || 1) - 1];
    LEVEL.theme = s.theme;
    LEVEL.length = s.length;
    LEVEL.bossLockX = s.bossLockX;
    LEVEL.boss = null;
    LEVEL.bossDefeated = false;
    LEVEL.zones = s.zones.map(z => ({ ...z, list: null, cleared: false }));
    LEVEL.supplyDrops = s.supplies.map(d => ({ ...d, done: false }));
    // 静态布防
    for (const hx of s.hostages) ENT.hostages.push(new ENT.Hostage(hx));
    for (const bx of s.barrels) ENT.barrels.push(new ENT.Barrel(bx));
    if (s.startItem) ENT.items.push(new ENT.Item(300, ENT.groundY - 30, s.startItem));
    // 载具
    if (s.vehicleX) ENT.vehicles.push(new ENT.Vehicle(s.vehicleX));
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
      LEVEL.boss = new Boss(GAME.camX + GAME.VW + 90, STAGES[LEVEL.stage - 1].bossHp);
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
    if (LEVEL.theme === "jungle") drawBgJungle(g, camX, t);
    else if (LEVEL.theme === "base") drawBgBase(g, camX, t);
    else drawBgDesert(g, camX, t);
  };

  /* ---- 沙漠背景(Stage 1) ---- */
  function drawBgDesert(g, camX, t) {
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
  }

  /* ---- 丛林背景(Stage 2) ---- */
  function drawBgJungle(g, camX, t) {
    const VW = GAME.VW, VH = GAME.VH, gy = ENT.groundY;
    // 天空:丛林晨雾渐变
    const grad = g.createLinearGradient(0, 0, 0, gy);
    grad.addColorStop(0, "#1a3a2e");
    grad.addColorStop(0.4, "#3a6a4a");
    grad.addColorStop(0.75, "#6a9a5a");
    grad.addColorStop(1, "#a0c070");
    g.fillStyle = grad; g.fillRect(0, 0, VW, gy);
    // 远山(0.2x)
    g.fillStyle = "#2a4a3a";
    for (let i = -1; i < 8; i++) {
      const bx = i * 160 - (camX * 0.2) % 160;
      const h = 40 + ((i * 53) % 24);
      g.beginPath(); g.moveTo(bx - 30, gy); g.quadraticCurveTo(bx + 50, gy - h - 10, bx + 130, gy); g.fill();
    }
    // 中景树林(0.45x)
    g.fillStyle = "#1a3a2a";
    for (let i = -1; i < 10; i++) {
      const bx = i * 120 - (camX * 0.45) % 120;
      g.beginPath(); g.arc(bx + 30, gy - 50, 28, Math.PI, 0); g.fill();
      g.beginPath(); g.arc(bx + 50, gy - 40, 22, Math.PI, 0); g.fill();
      R(g, bx + 28, gy - 50, 6, 50, "#3a2a1a");
    }
    // 近景大树与藤蔓(0.8x)
    for (let i = -1; i < 8; i++) {
      const bx = i * 200 - (camX * 0.8) % 200;
      if (i % 2 === 0) {
        R(g, bx + 10, gy - 80, 10, 80, "#2a1a10");
        g.fillStyle = "#1a3a2a";
        g.beginPath(); g.arc(bx + 15, gy - 85, 22, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(bx + 30, gy - 75, 18, 0, Math.PI * 2); g.fill();
        // 藤蔓
        R(g, bx + 20, gy - 80, 1, 40, "#3a5a2a");
      }
    }
    // 地面
    R(g, 0, gy, VW, VH - gy, "#3a5a2a");
    R(g, 0, gy, VW, 3, "#5a7a3a");
    R(g, 0, gy + 12, VW, 1, "#2a4a1a");
    // 地面草丛
    for (let i = 0; i < 26; i++) {
      const xx = (i * 47 - camX) % (47 * 26);
      if (xx > -20 && xx < VW + 20) {
        R(g, xx, gy + 4 + (i % 3) * 6, 3, 4, "#4a7a2a");
        if (i % 4 === 0) R(g, xx + 5, gy + 8, 2, 3, "#6a9a3a");
      }
    }
    // 前景蕨类(1.2x)
    for (let i = 0; i < 10; i++) {
      const xx = (i * 173 - camX * 1.18) % (VW + 80);
      const fx = xx < -40 ? xx + VW + 80 : xx;
      if (fx > -20 && fx < VW + 20) {
        R(g, fx, gy + 20 + (i % 2) * 6, 3, 8, "#2a5a1a");
        R(g, fx - 2, gy + 22, 2, 5, "#3a6a2a");
      }
    }
  }

  /* ---- 军事基地背景(Stage 3) ---- */
  function drawBgBase(g, camX, t) {
    const VW = GAME.VW, VH = GAME.VH, gy = ENT.groundY;
    // 天空:阴沉灰蓝渐变
    const grad = g.createLinearGradient(0, 0, 0, gy);
    grad.addColorStop(0, "#1a1a24");
    grad.addColorStop(0.5, "#2a2a38");
    grad.addColorStop(0.8, "#3a3a48");
    grad.addColorStop(1, "#4a4a58");
    g.fillStyle = grad; g.fillRect(0, 0, VW, gy);
    // 远景铁丝网与灯塔(0.2x)
    g.fillStyle = "#2a2a34";
    for (let i = -1; i < 10; i++) {
      const bx = i * 140 - (camX * 0.2) % 140;
      if (i % 3 === 0) { R(g, bx, gy - 60, 8, 60, "#3a3a44"); R(g, bx - 4, gy - 64, 16, 6, "#4a4a54"); }
    }
    // 中景仓库与围栏(0.5x)
    for (let i = -1; i < 10; i++) {
      const bx = i * 180 - (camX * 0.5) % 180;
      if (i % 2 === 0) {
        R(g, bx, gy - 50, 60, 50, "#3a3a44");
        R(g, bx, gy - 50, 60, 4, "#4a4a54");
        R(g, bx + 8, gy - 40, 12, 12, "#2a2a30"); // 窗
        R(g, bx + 30, gy - 40, 12, 12, "#2a2a30");
        R(g, bx + 24, gy - 14, 12, 14, "#1a1a20"); // 门
      } else {
        // 围栏
        for (let f = 0; f < 8; f++) R(g, bx + f * 8, gy - 30, 1, 30, "#4a4a54");
        R(g, bx, gy - 30, 64, 1, "#4a4a54");
        R(g, bx, gy - 15, 64, 1, "#4a4a54");
      }
    }
    // 近景集装箱(0.85x)
    for (let i = -1; i < 8; i++) {
      const bx = i * 220 - (camX * 0.85) % 220;
      const colors = ["#8a4a3a", "#3a5a6a", "#5a5a3a"];
      const col = colors[i % 3];
      R(g, bx, gy - 28, 40, 28, col);
      R(g, bx, gy - 28, 40, 3, "#1a1a20");
      R(g, bx + 2, gy - 24, 36, 2, "#000");
    }
    // 地面:水泥
    R(g, 0, gy, VW, VH - gy, "#5a5a64");
    R(g, 0, gy, VW, 3, "#6a6a74");
    R(g, 0, gy + 12, VW, 1, "#4a4a54");
    // 地面接缝线
    for (let i = 0; i < 20; i++) {
      const xx = (i * 60 - camX) % (60 * 20);
      if (xx > -10 && xx < VW + 10) R(g, xx, gy + 4, 1, VH - gy - 4, "#4a4a54");
    }
    // 前景铁丝网柱(1.2x)
    for (let i = 0; i < 8; i++) {
      const xx = (i * 200 - camX * 1.18) % (VW + 100);
      const fx = xx < -50 ? xx + VW + 100 : xx;
      if (fx > -20 && fx < VW + 20) {
        R(g, fx, gy - 40, 2, 40, "#3a3a44");
        R(g, fx - 1, gy - 30, 4, 1, "#4a4a54");
      }
    }
  }

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
    constructor(x, maxHp) {
      this.x = x; this.y = ENT.groundY;
      this.hp = maxHp || 140; this.maxHp = maxHp || 140;
      // 部位血量(可独立破坏)
      this.cannonHp = 40; this.cannonDead = false;
      this.gunHp = 30; this.gunDead = false;
      this.state = "enter"; this.t = 0;
      this.atkCd = 120; this.pattern = 0; this.subT = 0; this.subN = 0;
      this.tread = 0; this.flash = 0; this.cannonGlow = 0;
      this.targetX = LEVEL.bossLockX + GAME.VW - 120;
      this.dead = false; this.dieT = 0;
      this.chargeDir = 0; this.vx = 0;
    }
    hittable() { return this.state === "fight"; }
    takeHit(d, hitY) {
      if (!this.hittable()) return;
      // 部位判定: hitY 在炮塔区域(y-52~y-38)扣炮塔,否则扣车体/机枪
      if (hitY != null && hitY < this.y - 38 && !this.cannonDead) {
        this.cannonHp -= d;
        if (this.cannonHp <= 0) {
          this.cannonDead = true;
          ENT.spawnExplosion(this.x - 16, this.y - 48, 1.2, false);
          ENT.addFloat(this.x, this.y - 70, "CANNON DESTROYED!", "#ff6040");
        }
      } else if (hitY != null && hitY >= this.y - 38 && !this.gunDead) {
        this.gunHp -= d;
        if (this.gunHp <= 0) {
          this.gunDead = true;
          ENT.spawnExplosion(this.x - 34, this.y - 20, 1.0, false);
          ENT.addFloat(this.x, this.y - 50, "GUN DESTROYED!", "#ff6040");
        }
      }
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
          // 车体碾压判定(仅冲撞攻击阶段)
          if (p && p.alive && p.invuln <= 0 && this.pattern === 2 && this.subT <= 55 && this.subT > 25 && Math.abs(p.x - this.x) < 34 && p.y > this.y - 46) p.die();
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
              this.atkCd = 130;
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
        // 曲射炮弹 ×3(炮塔被破坏则跳过)
        if (this.cannonDead) { this.subT = 1; return; }
        if (this.subT % 24 === 0 && this.subN < 3) {
          this.subN++;
          const sx = this.x - 20, sy = this.y - 50;
          const frames = 70, dx = px - sx;
          ENT.ebullets.push(new ENT.EBullet(sx, sy, dx / frames, -4.6, "shell"));
          AudioSys.sfx.shot("R");
          ENT.addPart(sx - 4, sy, -1, -1, 8, "#ffe080", 4, 0);
        }
      } else if (this.pattern === 1) {
        // 机枪扫射(机枪被破坏则跳过)
        if (this.gunDead) { this.subT = 1; return; }
        if (this.subT % 14 === 0 && this.subN < 5) {
          this.subN++;
          const sx = this.x - 34, sy = this.y - 20;
          const dy = (p ? p.y - 10 : sy) - sy, dx = px - sx;
          const len = Math.max(1, Math.hypot(dx, dy)), sp = 3.1;
          const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.28;
          ENT.ebullets.push(new ENT.EBullet(sx, sy, Math.cos(ang) * sp, Math.sin(ang) * sp, "shot"));
          AudioSys.sfx.shot("H");
          ENT.addPart(sx - 3, sy, -0.5, 0, 4, "#ffe080", 3, 0);
        }
      } else {
        // 冲撞(前摇预警→冲撞→停止)
        if (this.subT > 55) {
          // 前摇预警:震动+白闪+尘土
          this.vx = 0; this.flash = 2;
          if (Math.random() < 0.5) ENT.addPart(this.x + (Math.random()-0.5)*60, this.y - 40, 0, -1, 10, "#ffe040", 2, 0);
        } else if (this.subT > 25) {
          // 冲撞
          this.vx = this.chargeDir * 2.6; this.x += this.vx;
          if (Math.random() < 0.5) ENT.addPart(this.x - this.chargeDir * 36, this.y - 2, -this.chargeDir, -0.5, 14, "#9a8a70", 3, 0);
        } else {
          this.vx = 0;
        }
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
      // 炮塔(被破坏则画焦黑破损)
      if (this.cannonDead) {
        R(g, x - 16, y - 52, 34, 16, "#1a1a14");
        R(g, x - 14, y - 50, 8, 6, "#0a0a08"); // 破洞
        R(g, x - 2, y - 48, 6, 4, "#0a0a08");
        R(g, x + 6, y - 54, 4, 6, "#2a2a20"); // 扭曲金属
        // 冒烟
        if (Math.random() < 0.3) ENT.addPart(x - 10, y - 52, 0.1, -0.6, 30, "#444", 3, -0.02);
      } else {
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
      }
      // 机枪位(被破坏则画焦黑)
      if (this.gunDead) {
        R(g, x - 36, y - 24, 10, 8, "#1a1a14");
        R(g, x - 34, y - 22, 4, 4, "#0a0a08");
        if (Math.random() < 0.2) ENT.addPart(x - 32, y - 22, -0.1, -0.4, 24, "#444", 2, -0.02);
      }
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
