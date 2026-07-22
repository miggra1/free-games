/* ============================================================
 * game.js — 状态机 / 相机 / HUD / 主循环
 * 状态:title → start → play ⇄ pause → continue → gameover
 *                 play → complete(Boss 击破)
 * ============================================================ */
(function () {
  "use strict";
  const { R, drawText, textWidth, drawItemBox, drawGrenade } = SPR;

  const GAME = {
    VW: 480, VH: 270,
    state: "title", t: 0,
    camX: 0, score: 0, hiScore: 50000, credits: 0,
    hostages: 0, contT: 0, compT: 0, muted: false,
  };
  window.GAME = GAME;

  /* ---------------- 画布 ---------------- */
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const buf = document.createElement("canvas");
  buf.width = GAME.VW; buf.height = GAME.VH;
  const g = buf.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  function fitCanvas() {
    const aw = window.innerWidth, ah = window.innerHeight - 30;
    const s = Math.min(aw / 960, ah / 540);
    canvas.style.width = Math.floor(960 * s) + "px";
    canvas.style.height = Math.floor(540 * s) + "px";
  }
  window.addEventListener("resize", fitCanvas);
  fitCanvas();

  /* ---------------- 分数 ---------------- */
  GAME.addScore = function (n, x, y) {
    GAME.score += n;
    if (GAME.score > GAME.hiScore) GAME.hiScore = GAME.score;
    if (x != null) ENT.addFloat(x, y, "+" + n, "#ffe080");
  };

  /* ---------------- 流程控制 ---------------- */
  function startGame() {
    ENT.reset();
    GAME.score = 0; GAME.hostages = 0; GAME.camX = 0;
    ENT.player = new ENT.Player(60);
    LEVEL.setup();
    GAME.state = "start"; GAME.t = 0;
    AudioSys.bgm.start("field");
  }

  GAME.missionComplete = function () {
    GAME.state = "complete"; GAME.compT = 0;
    ENT.ebullets = [];
    AudioSys.bgm.stop();
    AudioSys.sfx.missionClear();
    setTimeout(() => AudioSys.voice("Mission Complete!"), 600);
  };

  function respawn() {
    const p = ENT.player;
    p.reset(Math.min(GAME.camX + 50, LEVEL.length - 100));
  }

  /* ---------------- 更新 ---------------- */
  function update() {
    GAME.t++;
    Input.update();

    if (Input.pressed("mute")) {
      GAME.muted = AudioSys.toggleMute();
      ENT.addFloat(GAME.camX + GAME.VW / 2, 60, GAME.muted ? "MUTE ON" : "MUTE OFF", "#a0c0ff");
    }

    switch (GAME.state) {
      case "title":
        if (Input.pressed("start")) {
          AudioSys.ensure();
          AudioSys.sfx.coin();
          GAME.credits++;
          startGame();
        }
        break;

      case "start":
        if (GAME.t > 100) { GAME.state = "play"; GAME.t = 0; }
        break;

      case "play": {
        if (Input.pressed("start")) { GAME.state = "pause"; AudioSys.sfx.click(); break; }
        const p = ENT.player;
        p.update();
        ENT.update();
        LEVEL.update();
        // 相机跟随 + 锁屏
        const lock = LEVEL.cameraLock();
        let target = p.x - GAME.VW * 0.36;
        const maxCam = Math.min(LEVEL.length - GAME.VW, lock === Infinity ? LEVEL.length - GAME.VW : lock);
        target = Math.max(GAME.camX, Math.min(maxCam, target));
        GAME.camX += (target - GAME.camX) * 0.18;
        if (Math.abs(target - GAME.camX) < 0.4) GAME.camX = target;
        // 阵亡处理
        if (!p.alive && p.deadT <= 0) {
          if (p.lives > 0) { p.lives--; respawn(); }
          else { GAME.state = "continue"; GAME.contT = 10 * 60; AudioSys.bgm.stop(); }
        }
        break;
      }

      case "pause":
        if (Input.pressed("start")) { GAME.state = "play"; AudioSys.sfx.click(); }
        break;

      case "continue": {
        GAME.contT--;
        if (GAME.contT % 60 === 0 && GAME.contT > 0) AudioSys.sfx.countTick();
        if (Input.pressed("start") && GAME.credits > 0) {
          GAME.credits--;
          ENT.player.lives = 2;
          ENT.player.grenades = Math.max(ENT.player.grenades, 6);
          ENT.ebullets = [];
          respawn();
          GAME.state = "play";
          AudioSys.bgm.start(LEVEL.boss ? "boss" : "field");
          AudioSys.sfx.coin();
        } else if (GAME.contT <= 0) {
          GAME.state = "gameover"; GAME.t = 0;
        }
        break;
      }

      case "gameover":
        if (GAME.t > 200) { GAME.state = "title"; GAME.t = 0; GAME.credits = 0; }
        break;

      case "complete": {
        GAME.compT++;
        ENT.update();
        if (GAME.compT === 120 && GAME.hostages > 0) {
          const bonus = GAME.hostages * 1000;
          GAME.addScore(bonus, GAME.camX + GAME.VW / 2, 120);
          AudioSys.sfx.hostage();
        }
        if (GAME.compT > 300 && Input.pressed("start")) {
          GAME.state = "title"; GAME.t = 0; GAME.credits = 0;
        }
        break;
      }
    }
    Input.clear();
  }

  /* ---------------- HUD ---------------- */
  function drawHUD(bg) {
    const p = ENT.player;
    // 1P 面板
    R(bg, 4, 4, 108, 30, "rgba(10,10,20,0.55)");
    drawText(bg, "1P", 8, 8, "#ff5040", 1);
    drawText(bg, String(GAME.score).padStart(8, "0"), 24, 8, "#ffe8c0", 1);
    // 残机(头像点)
    drawText(bg, "x" + Math.max(0, p ? p.lives : 0), 8, 18, "#ffe8c0", 1);
    R(bg, 8, 26, 6, 6, "#eec39a"); R(bg, 8, 26, 6, 2, "#e8c860");
    // 人质计数
    drawText(bg, "POWx" + GAME.hostages, 44, 18, "#a0e080", 1);

    // 武器面板(右上)
    R(bg, GAME.VW - 96, 4, 92, 30, "rgba(10,10,20,0.55)");
    if (p) {
      if (p.weapon === "pistol") {
        drawText(bg, "PISTOL", GAME.VW - 90, 8, "#c0c0c0", 1);
        drawText(bg, "AMMO --", GAME.VW - 90, 18, "#808080", 1);
      } else {
        drawItemBox(bg, GAME.VW - 86, 16, p.weapon, 1);
        drawText(bg, "x" + Math.max(0, p.ammo), GAME.VW - 70, 12, "#ffe8c0", 2);
      }
      // 手雷
      drawGrenade(bg, GAME.VW - 30, 12);
      drawText(bg, "x" + p.grenades, GAME.VW - 24, 10, "#a0e080", 1);
      // 玩家当前血条概念:街机一击死,用 INVULN 显示复活无敌
      if (p.invuln > 0) drawText(bg, "INVULN", GAME.VW - 90, 26, "#80c0ff", 1);
    }
    // HI SCORE
    drawText(bg, "HI " + String(GAME.hiScore).padStart(8, "0"), GAME.VW / 2 - textWidth("HI 00000000", 1) / 2, 6, "#ffb060", 1);
    // Boss 血条
    if (LEVEL.boss && LEVEL.boss.state !== "enter") LEVEL.boss.drawHP(bg);
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    const t = GAME.t + ENT.time;
    switch (GAME.state) {
      case "title": {
        R(g, 0, 0, GAME.VW, GAME.VH, "#0c0a16");
        // 装饰地平线与闪烁星空
        for (let i = 0; i < 40; i++) {
          const sx = (i * 67) % GAME.VW, sy = (i * 41) % 140;
          if (Math.floor(t / 20 + i) % 3 !== 0) R(g, sx, sy, 1, 1, "#e8d8a0");
        }
        const grad = g.createLinearGradient(0, 150, 0, GAME.VH);
        grad.addColorStop(0, "#3a1a2e"); grad.addColorStop(1, "#c86838");
        g.fillStyle = grad; g.fillRect(0, 150, GAME.VW, GAME.VH - 150);
        R(g, GAME.VW / 2 - 20, 132, 40, 34, "#ffd870");
        // LOGO
        drawText(g, "METAL", 74, 66, "#c03028", 6);
        drawText(g, "METAL", 76, 64, "#ffe040", 6);
        drawText(g, "SLUG", 254, 96, "#c03028", 6);
        drawText(g, "SLUG", 256, 94, "#ffe040", 6);
        drawText(g, "BROWSER REMAKE - MISSION 1", GAME.VW / 2 - textWidth("BROWSER REMAKE - MISSION 1", 1) / 2, 140, "#c0b0a0", 1);
        if (Math.floor(t / 30) % 2 === 0)
          drawText(g, "PRESS ENTER TO START", GAME.VW / 2 - textWidth("PRESS ENTER TO START", 2) / 2, 180, "#ffffff", 2);
        drawText(g, "CREDIT " + GAME.credits, 8, GAME.VH - 16, "#ffe080", 1);
        drawText(g, "HI " + String(GAME.hiScore).padStart(8, "0"), GAME.VW - 110, GAME.VH - 16, "#ffb060", 1);
        drawText(g, "ARROWS:MOVE  Z:FIRE  X:JUMP  C:GRENADE", GAME.VW / 2 - textWidth("ARROWS:MOVE  Z:FIRE  X:JUMP  C:GRENADE", 1) / 2, GAME.VH - 34, "#8a8aa0", 1);
        break;
      }

      case "start": {
        R(g, 0, 0, GAME.VW, GAME.VH, "#000000");
        const a = Math.min(1, GAME.t / 40);
        g.globalAlpha = a;
        drawText(g, "MISSION 1", GAME.VW / 2 - textWidth("MISSION 1", 4) / 2, 100, "#e8e8e8", 4);
        if (GAME.t > 40)
          drawText(g, "START!", GAME.VW / 2 - textWidth("START!", 3) / 2, 150, "#ffe040", 3);
        g.globalAlpha = 1;
        break;
      }

      case "play":
      case "pause":
      case "complete": {
        LEVEL.drawBackground(g, GAME.camX, ENT.time);
        g.save();
        const shx = (Math.random() - 0.5) * ENT.shake, shy = (Math.random() - 0.5) * ENT.shake;
        g.translate(Math.round(-GAME.camX + shx), Math.round(shy));
        // 实体(远到近)
        for (const b of ENT.barrels) b.draw(g);
        for (const h of ENT.hostages) h.draw(g);
        for (const i of ENT.items) i.draw(g, ENT.time);
        for (const e of ENT.enemies) e.draw(g, ENT.time);
        if (LEVEL.boss) LEVEL.boss.draw(g);
        if (ENT.player) ENT.player.draw(g);
        for (const b of ENT.bullets) b.draw(g, ENT.time);
        for (const b of ENT.ebullets) b.draw(g);
        ENT.drawParts(g);
        g.restore();

        LEVEL.drawGoArrow(g, ENT.time);
        drawHUD(g);

        if (GAME.state === "pause") {
          R(g, 0, 0, GAME.VW, GAME.VH, "rgba(0,0,0,0.55)");
          drawText(g, "PAUSE", GAME.VW / 2 - textWidth("PAUSE", 4) / 2, 110, "#ffffff", 4);
          drawText(g, "PRESS ENTER TO RESUME", GAME.VW / 2 - textWidth("PRESS ENTER TO RESUME", 1) / 2, 150, "#a0a0c0", 1);
        }
        if (GAME.state === "complete") {
          const a = Math.min(1, GAME.compT / 60);
          g.globalAlpha = a * 0.75;
          R(g, 0, 90, GAME.VW, 80, "#0a0a14");
          g.globalAlpha = 1;
          drawText(g, "MISSION", GAME.VW / 2 - textWidth("MISSION", 4) / 2, 100, "#ffe040", 4);
          drawText(g, "COMPLETE!", GAME.VW / 2 - textWidth("COMPLETE!", 4) / 2, 130, "#ffe040", 4);
          if (GAME.compT > 120) {
            drawText(g, "POW BONUS " + GAME.hostages + "x1000", GAME.VW / 2 - textWidth("POW BONUS 0x0000", 1) / 2, 180, "#a0e080", 1);
            drawText(g, "TOTAL " + String(GAME.score).padStart(8, "0"), GAME.VW / 2 - textWidth("TOTAL 00000000", 1) / 2, 194, "#ffe8c0", 1);
          }
          if (GAME.compT > 300 && Math.floor(GAME.t / 30) % 2 === 0)
            drawText(g, "PRESS ENTER", GAME.VW / 2 - textWidth("PRESS ENTER", 1) / 2, 220, "#ffffff", 1);
        }
        break;
      }

      case "continue": {
        // 背景压暗的战斗画面
        LEVEL.drawBackground(g, GAME.camX, ENT.time);
        g.save();
        g.translate(Math.round(-GAME.camX), 0);
        for (const e of ENT.enemies) e.draw(g, ENT.time);
        g.restore();
        R(g, 0, 0, GAME.VW, GAME.VH, "rgba(0,0,0,0.6)");
        drawText(g, "CONTINUE?", GAME.VW / 2 - textWidth("CONTINUE?", 4) / 2, 90, "#ffffff", 4);
        const sec = Math.ceil(GAME.contT / 60);
        drawText(g, String(sec), GAME.VW / 2 - 8, 130, sec <= 3 ? "#ff4030" : "#ffe040", 4);
        drawText(g, "PRESS ENTER - CREDIT " + GAME.credits, GAME.VW / 2 - textWidth("PRESS ENTER - CREDIT 0", 1) / 2, 170, "#c0c0c0", 1);
        break;
      }

      case "gameover": {
        R(g, 0, 0, GAME.VW, GAME.VH, "#000000");
        const a = Math.min(1, GAME.t / 60);
        g.globalAlpha = a;
        drawText(g, "GAME OVER", GAME.VW / 2 - textWidth("GAME OVER", 4) / 2, 110, "#c03028", 4);
        g.globalAlpha = 1;
        drawText(g, "SCORE " + String(GAME.score).padStart(8, "0"), GAME.VW / 2 - textWidth("SCORE 00000000", 1) / 2, 150, "#ffe8c0", 1);
        break;
      }
    }

    // 低分辨率缓冲 → 主画布(整数放大,保持像素锐利)
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, GAME.VW, GAME.VH, 0, 0, 960, 540);
  }

  /* ---------------- 主循环(固定步长) ---------------- */
  let last = 0, acc = 0;
  const STEP = 1000 / 60;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (!last) last = ts;
    acc += Math.min(100, ts - last);
    last = ts;
    while (acc >= STEP) { update(); acc -= STEP; }
    render();
  }
  requestAnimationFrame(frame);
})();
