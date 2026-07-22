/* ============================================================
 * sprites.js — 像素字体 + 程序化像素角色绘制(NeoGeo 风格)
 * 所有绘制都以整数像素块进行,在低分辨率缓冲上渲染后整体放大,
 * 形成统一的 90 年代街机像素视觉。
 * ============================================================ */
(function () {
  "use strict";

  /* ---------- 3x5 像素字体 ---------- */
  const FONT = {
    "0": ["111","101","101","101","111"], "1": ["010","110","010","010","111"],
    "2": ["111","001","111","100","111"], "3": ["111","001","111","001","111"],
    "4": ["101","101","111","001","001"], "5": ["111","100","111","001","111"],
    "6": ["111","100","111","101","111"], "7": ["111","001","001","010","010"],
    "8": ["111","101","111","101","111"], "9": ["111","101","111","001","111"],
    "A": ["010","101","111","101","101"], "B": ["110","101","110","101","110"],
    "C": ["011","100","100","100","011"], "D": ["110","101","101","101","110"],
    "E": ["111","100","110","100","111"], "F": ["111","100","110","100","100"],
    "G": ["011","100","101","101","011"], "H": ["101","101","111","101","101"],
    "I": ["111","010","010","010","111"], "J": ["001","001","001","101","010"],
    "K": ["101","101","110","101","101"], "L": ["100","100","100","100","111"],
    "M": ["101","111","111","101","101"], "N": ["110","101","101","101","101"],
    "O": ["010","101","101","101","010"], "P": ["110","101","110","100","100"],
    "Q": ["010","101","101","110","011"], "R": ["110","101","110","101","101"],
    "S": ["011","100","010","001","110"], "T": ["111","010","010","010","010"],
    "U": ["101","101","101","101","111"], "V": ["101","101","101","101","010"],
    "W": ["101","101","111","111","101"], "X": ["101","101","010","101","101"],
    "Y": ["101","101","010","010","010"], "Z": ["111","001","010","100","111"],
    " ": ["000","000","000","000","000"], "!": ["010","010","010","000","010"],
    "-": ["000","000","111","000","000"], ".": ["000","000","000","000","010"],
    ":": ["000","010","000","010","000"], "/": ["001","001","010","100","100"],
    "%": ["101","001","010","100","101"], ">": ["100","010","001","010","100"],
    "(": ["010","100","100","100","010"], ")": ["010","001","001","001","010"],
    "+": ["000","010","111","010","000"], "x": ["000","101","010","101","000"],
  };

  function drawText(g, text, x, y, color, scale) {
    scale = scale || 1;
    g.fillStyle = color;
    let cx = Math.round(x);
    const cy = Math.round(y);
    const s = scale;
    for (const ch of String(text).toUpperCase()) {
      const gl = FONT[ch] || FONT[" "];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 3; c++) {
          if (gl[r][c] === "1") g.fillRect(cx + c * s, cy + r * s, s, s);
        }
      }
      cx += 4 * s;
    }
    return cx;
  }
  function textWidth(text, scale) { return String(text).length * 4 * (scale || 1) - (scale || 1); }

  /* ---------- 基础矩形 ---------- */
  function R(g, x, y, w, h, c) {
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /* ---------- 调色板 ---------- */
  const PAL = {
    player:  { hair:"#e8c860", hat:null,       skin:"#eec39a", shirt:"#e8e4d8", shirtD:"#b8b4a8", pants:"#9a8048", pantsD:"#77653a", boots:"#5a4530", pack:"#6a7078" },
    grunt:   { hair:null,      hat:"#41682f",  skin:"#e0b088", shirt:"#4f7a38", shirtD:"#3c5e2c", pants:"#42663a", pantsD:"#334f2c", boots:"#3a3228", pack:null },
    shield:  { hair:null,      hat:"#4a5568",  skin:"#d8a880", shirt:"#5a6a7a", shirtD:"#46525e", pants:"#4a5560", pantsD:"#3a434c", boots:"#33302a", pack:null },
    rocket:  { hair:null,      hat:"#6a4a8a",  skin:"#d8a880", shirt:"#5a4a6a", shirtD:"#473a52", pants:"#4a4258", pantsD:"#3a3444", boots:"#33302a", pack:null },
    grenadier:{hair:null,      hat:"#8a6a2a",  skin:"#e0b088", shirt:"#7a5a30", shirtD:"#5f4626", pants:"#5e4a2e", pantsD:"#4a3a24", boots:"#33302a", pack:null },
    hostage: { hair:"#e8d878", hat:null,       skin:"#eec39a", shirt:"#e8e8e8", shirtD:"#c0c0c0", pants:"#e8e8e8", pantsD:"#c0c0c0", boots:"#d8d8d8", pack:null },
  };

  /* ---------- 人形角色绘制 ----------
   * o: { x, y(脚底), dir(1/-1), pose, phase, pal, aim('up'|'mid'|'down'), flash }
   * pose: idle|run|jump|crouch|shoot|throw|melee|tied|salute|celebrate
   * 站立高度约 22px,蹲姿约 15px。 */
  function drawFighter(g, o) {
    const p = PAL[o.pal] || PAL.grunt;
    const d = o.dir || 1;
    const x = Math.round(o.x), y = Math.round(o.y);
    const ph = o.phase || 0;
    const bob = (o.pose === "idle" || o.pose === "shoot") ? Math.round(Math.sin(ph * 0.08) * 0.5) : 0;

    g.save();
    g.translate(x, y);
    g.scale(d, 1); // 朝右为正向

    const crouch = o.pose === "crouch";
    const legH = crouch ? 4 : 8;
    const hipY = -legH;
    const torsoH = crouch ? 6 : 8;
    const torsoY = hipY - torsoH + bob;
    const headY = torsoY - 6;

    /* ---- 腿 ---- */
    if (o.pose === "run") {
      const s = Math.sin(ph * 0.35);
      const l1 = Math.round(s * 4), l2 = Math.round(-s * 4);
      R(g, -3 + Math.min(l1, 0), -legH, 3, legH + Math.max(l1, 0), p.pants);
      R(g, 1 + Math.min(l2, 0), -legH, 3, legH + Math.max(l2, 0), p.pantsD);
      R(g, -4 + l1, -2, 4, 2, p.boots);
      R(g, 0 + l2, -2, 4, 2, p.boots);
    } else if (o.pose === "jump") {
      R(g, -3, -6, 3, 5, p.pants); R(g, 1, -5, 3, 4, p.pantsD);
      R(g, -4, -2, 4, 2, p.boots); R(g, 0, -1, 4, 2, p.boots);
    } else if (crouch) {
      R(g, -4, -4, 4, 3, p.pants); R(g, 0, -3, 5, 3, p.pantsD);
      R(g, 2, -1, 5, 1, p.boots);
    } else if (o.pose === "tied") {
      R(g, -4, -5, 4, 4, p.pants); R(g, 0, -4, 4, 4, p.pantsD);
      R(g, -4, -1, 8, 1, p.boots);
    } else {
      R(g, -3, -legH, 3, legH, p.pants);
      R(g, 1, -legH, 3, legH, p.pantsD);
      R(g, -4, -2, 4, 2, p.boots); R(g, 1, -2, 4, 2, p.boots);
    }

    /* ---- 躯干 ---- */
    R(g, -4, torsoY, 8, torsoH, p.shirt);
    R(g, 1, torsoY, 3, torsoH, p.shirtD);
    if (p.pack) R(g, -6, torsoY + 1, 2, 5, p.pack); // 背包

    /* ---- 手臂与武器 ---- */
    const armY = torsoY + 2;
    if (o.pose === "shoot" || o.pose === "throw" || o.pose === "melee" || o.pose === "crouch") {
      if (o.pose === "throw") {
        R(g, 0, torsoY - 4, 2, 5, p.shirt);          // 手臂上扬
        R(g, 0, torsoY - 6, 2, 2, p.skin);
      } else if (o.pose === "melee") {
        R(g, 3, armY - 2, 4, 2, p.skin);             // 挥刀
        R(g, 7, armY - 4, 2, 6, "#d8dce2");          // 刀光
        R(g, 8, armY - 5, 1, 8, "#ffffff");
      } else {
        const aim = o.aim || "mid";
        const gy = aim === "up" ? armY - 4 : aim === "down" ? armY + 3 : armY;
        R(g, 2, armY, 4, 2, p.skin);                 // 手臂前伸
        R(g, 5, gy, 6, 2, "#3a3f46");                // 枪身
        R(g, 10, gy - (aim === "up" ? 4 : 0), 2, aim === "up" ? 6 : 2, "#26292e"); // 枪口
      }
    } else if (o.pose === "salute") {
      R(g, 2, torsoY - 1, 3, 2, p.skin);
    } else if (o.pose === "tied") {
      R(g, -5, armY + 1, 2, 3, p.shirtD);
      R(g, 3, armY + 1, 2, 3, p.shirtD);
      R(g, -4, armY + 2, 8, 1, "#c8a060");           // 绳子
    } else {
      R(g, -5, armY, 2, 4, p.shirtD);                // 垂手
      R(g, 3, armY, 2, 4, p.shirt);
      R(g, 3, armY + 3, 2, 2, p.skin);
    }

    /* ---- 头 ---- */
    R(g, -3, headY, 6, 6, p.skin);
    R(g, 2, headY + 2, 1, 1, "#1a1a1a");             // 眼睛
    if (p.hat) {
      R(g, -3, headY - 2, 6, 3, p.hat);              // 军帽/头盔
      R(g, -4, headY + 1, 1, 2, p.hat);
    } else if (p.hair) {
      R(g, -3, headY - 1, 6, 2, p.hair);
      R(g, -3, headY + 1, 1, 3, p.hair);
    }
    if (o.pose === "celebrate") {
      R(g, -2, headY - 5, 2, 4, p.skin); R(g, 2, headY - 5, 2, 4, p.skin); // 双手举起
    }

    g.restore();

    /* 受击白闪 */
    if (o.flash) {
      g.save();
      g.globalAlpha = Math.min(0.8, o.flash / 4);
      g.globalCompositeOperation = "source-atop";
      g.restore();
    }
  }

  /* ---------- 武器道具箱 ---------- */
  function drawItemBox(g, x, y, kind, t) {
    const bobY = Math.round(Math.sin(t * 0.08) * 2);
    const yy = Math.round(y) + bobY;
    R(g, x - 6, yy - 8, 13, 10, "#2a2a34");
    R(g, x - 5, yy - 7, 11, 8, "#f0f0e8");
    R(g, x - 5, yy - 7, 11, 2, "#c84030");
    const col = { H:"#c03028", S:"#2860c0", R:"#28a048", F:"#e08020", L:"#c0c8e8", G:"#487838", T:"#e0a020" }[kind] || "#333";
    drawText(g, kind, x - 5, yy - 4, col, 1);
    if (Math.floor(t / 20) % 2 === 0) { R(g, x - 7, yy - 9, 2, 2, "#ffe080"); R(g, x + 6, yy - 9, 2, 2, "#ffe080"); }
  }

  /* ---------- 手雷 ---------- */
  function drawGrenade(g, x, y) {
    R(g, x - 2, y - 3, 4, 5, "#3a5230");
    R(g, x - 1, y - 4, 2, 1, "#8a9298");
    R(g, x - 2, y - 2, 4, 1, "#2c3f24");
  }

  /* ---------- 降落伞道具 ---------- */
  function drawParachute(g, x, y, kind, t) {
    g.save();
    g.globalAlpha = 0.9;
    R(g, x - 8, y - 12, 17, 5, "#c84038");
    R(g, x - 6, y - 14, 13, 2, "#c84038");
    R(g, x - 8, y - 7, 1, 5, "#d8d8d0"); R(g, x + 8, y - 7, 1, 5, "#d8d8d0");
    g.restore();
    drawItemBox(g, x, y, kind, t);
  }

  window.SPR = { drawText, textWidth, R, drawFighter, drawItemBox, drawGrenade, drawParachute, PAL };
})();
