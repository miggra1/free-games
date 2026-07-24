/* ============================================================
 * render.js — 五子棋 Canvas 渲染
 * 实木棋盘 / 棋子3D效果 / 落子动画 / 五连高亮 / 禁手警示 / 主题切换
 * ============================================================ */
(function () {
  "use strict";
  const SIZE = 15;

  const RENDER = {
    canvas: null, ctx: null,
    cellSize: 36,
    boardPad: 30, // 棋盘边缘留白
    theme: "wood",  // "wood" | "ink" | "pixel"
    // 动画状态
    placingStones: [],  // [{x, y, player, t}]
    winFlash: 0,
    shakeT: 0,
    hoverPos: null,     // {x, y} 悬停位置
    forbiddenPos: null, // 禁手位置
    lastMove: null,     // 最后落子
    showCoords: true,
    showMoveNum: false,
  };

  RENDER.init = function (canvas) {
    RENDER.canvas = canvas;
    RENDER.ctx = canvas.getContext("2d");
    const px = RENDER.boardPad * 2 + RENDER.cellSize * (SIZE - 1);
    canvas.width = px; canvas.height = px;
    canvas.style.width = px + "px";
    canvas.style.height = px + "px";
  };

  /* ---------------- 坐标转换 ---------------- */
  RENDER.boardToScreen = function (bx, by) {
    return { x: RENDER.boardPad + bx * RENDER.cellSize, y: RENDER.boardPad + by * RENDER.cellSize };
  };
  RENDER.screenToBoard = function (sx, sy) {
    const bx = Math.round((sx - RENDER.boardPad) / RENDER.cellSize);
    const by = Math.round((sy - RENDER.boardPad) / RENDER.cellSize);
    if (bx >= 0 && bx < SIZE && by >= 0 && by < SIZE) return { x: bx, y: by };
    return null;
  };

  /* ---------------- 主题配色 ---------------- */
  const THEMES = {
    wood: {
      boardBg: "#c8965a", boardEdge: "#a07030", gridLine: "#8a6a30",
      starPoint: "#5a4a20", coordColor: "#8a6a30",
      blackPiece: ["#555","#222","#000"], whitePiece: ["#fff","#e8e0d0","#c0b8a8"],
      shadow: "rgba(0,0,0,0.3)", hover: "rgba(255,255,255,0.35)",
      winLine: "#ff4040", forbidden: "#ff2020",
    },
    ink: {
      boardBg: "#f0e8d8", boardEdge: "#c0b090", gridLine: "#908060",
      starPoint: "#504030", coordColor: "#908060",
      blackPiece: ["#444","#111","#000"], whitePiece: ["#f8f8f8","#e0d8c8","#b0a890"],
      shadow: "rgba(0,0,0,0.2)", hover: "rgba(0,0,0,0.15)",
      winLine: "#c03030", forbidden: "#c02020",
    },
    pixel: {
      boardBg: "#2a2a3a", boardEdge: "#1a1a2a", gridLine: "#4a4a5a",
      starPoint: "#8a8a9a", coordColor: "#6a6a7a",
      blackPiece: ["#666","#333","#111"], whitePiece: ["#e8e8f0","#c0c0d0","#9090a0"],
      shadow: "rgba(0,0,0,0.5)", hover: "rgba(255,255,255,0.2)",
      winLine: "#ff5060", forbidden: "#ff3040",
    },
  };

  function T() { return THEMES[RENDER.theme] || THEMES.wood; }

  /* ---------------- 木纹绘制 ---------------- */
  function drawWoodGrain(g, x, y, w, h) {
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    // 基础木纹色
    const grad = g.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, "#d4a55e"); grad.addColorStop(0.5, "#c8965a"); grad.addColorStop(1, "#b8854a");
    g.fillStyle = grad; g.fillRect(x, y, w, h);
    // 木纹曲线
    g.strokeStyle = "rgba(160,110,50,0.15)"; g.lineWidth = 1;
    for (let i = 0; i < 25; i++) {
      const yy = y + (i / 25) * h + Math.sin(i * 0.7) * 3;
      g.beginPath();
      g.moveTo(x, yy);
      for (let xx = x; xx < x + w; xx += 10) {
        g.lineTo(xx, yy + Math.sin(xx * 0.02 + i) * 2);
      }
      g.stroke();
    }
    // 深浅变化
    for (let i = 0; i < 8; i++) {
      const yy = y + (i / 8) * h;
      g.fillStyle = `rgba(140,95,40,${0.03 + (i % 3) * 0.02})`;
      g.fillRect(x, yy, w, h / 8);
    }
    g.restore();
  }

  /* ---------------- 绘制棋盘 ---------------- */
  function drawBoard(g) {
    const t = T();
    const pad = RENDER.boardPad, cs = RENDER.cellSize;
    const bx = pad - cs / 2, by = pad - cs / 2;
    const bw = cs * SIZE, bh = cs * SIZE;

    // 棋盘底
    if (RENDER.theme === "wood") {
      drawWoodGrain(g, bx - 6, by - 6, bw + 12, bh + 12);
    } else {
      g.fillStyle = t.boardBg;
      g.fillRect(bx - 6, by - 6, bw + 12, bh + 12);
    }
    // 边框
    g.strokeStyle = t.boardEdge; g.lineWidth = 3;
    g.strokeRect(bx - 6, by - 6, bw + 12, bh + 12);
    // 内边框
    g.strokeStyle = t.boardEdge; g.lineWidth = 1;
    g.strokeRect(bx - 1, by - 1, bw + 2, bh + 2);

    // 网格线
    g.strokeStyle = t.gridLine; g.lineWidth = 0.8;
    for (let i = 0; i < SIZE; i++) {
      g.beginPath(); g.moveTo(pad, pad + i * cs); g.lineTo(pad + (SIZE - 1) * cs, pad + i * cs); g.stroke();
      g.beginPath(); g.moveTo(pad + i * cs, pad); g.lineTo(pad + i * cs, pad + (SIZE - 1) * cs); g.stroke();
    }

    // 星位（天元 + 四星位）
    const stars = [[3,3],[11,3],[3,11],[11,11],[7,7]];
    for (const [sx, sy] of stars) {
      const { x, y } = RENDER.boardToScreen(sx, sy);
      g.fillStyle = t.starPoint;
      g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
    }

    // 坐标刻度
    if (RENDER.showCoords) {
      g.fillStyle = t.coordColor; g.font = "10px monospace"; g.textAlign = "center";
      const letters = "ABCDEFGHIJKLMNO";
      for (let i = 0; i < SIZE; i++) {
        g.fillText(letters[i], pad + i * cs, pad - 12);
        g.fillText(String(i + 1), pad - 12, pad + i * cs + 3);
      }
    }

    // 柔和顶光
    const light = g.createRadialGradient(bw / 2, by, 0, bw / 2, by, bw * 0.7);
    light.addColorStop(0, "rgba(255,255,255,0.08)");
    light.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = light;
    g.fillRect(bx - 6, by - 6, bw + 12, bh + 12);
  }

  /* ---------------- 绘制棋子 ---------------- */
  function drawStone(g, bx, by, player, alpha, scale, isLast) {
    const t = T();
    const { x, y } = RENDER.boardToScreen(bx, by);
    const r = RENDER.cellSize * 0.42 * (scale || 1);
    const colors = player === 1 ? t.blackPiece : t.whitePiece;

    // 阴影
    g.save();
    g.globalAlpha = (alpha || 1) * 0.4;
    g.fillStyle = t.shadow;
    g.beginPath(); g.ellipse(x + 2, y + 3, r * 0.9, r * 0.4, 0, 0, Math.PI * 2); g.fill();
    g.restore();

    // 棋子主体（径向渐变模拟3D）
    g.save();
    g.globalAlpha = alpha || 1;
    const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(0.6, colors[1]);
    grad.addColorStop(1, colors[2]);
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();

    // 高光
    g.fillStyle = "rgba(255,255,255,0.25)";
    g.beginPath(); g.ellipse(x - r * 0.2, y - r * 0.3, r * 0.3, r * 0.15, -0.3, 0, Math.PI * 2); g.fill();
    g.restore();

    // 最后落子标记
    if (isLast) {
      g.save();
      g.strokeStyle = "#ff4040"; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, r + 3, 0, Math.PI * 2); g.stroke();
      g.restore();
    }
  }

  /* ---------------- 绘制悬停预览 ---------------- */
  function drawHover(g, board) {
    if (!RENDER.hoverPos) return;
    const { x, y } = RENDER.hoverPos;
    if (board[y] && board[y][x] !== 0) return;
    const t = T();
    const { x: sx, y: sy } = RENDER.boardToScreen(x, y);
    const r = RENDER.cellSize * 0.42;
    g.save();
    g.globalAlpha = 0.35;
    const grad = g.createRadialGradient(sx - r * 0.3, sy - r * 0.3, r * 0.1, sx, sy, r);
    const colors = RENDER.hoverPlayer === 1 ? t.blackPiece : t.whitePiece;
    grad.addColorStop(0, colors[0]); grad.addColorStop(1, colors[2]);
    g.fillStyle = grad;
    g.beginPath(); g.arc(sx, sy, r, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  /* ---------------- 绘制禁手标记 ---------------- */
  function drawForbidden(g) {
    if (!RENDER.forbiddenPos) return;
    const { x, y } = RENDER.forbiddenPos;
    const { x: sx, y: sy } = RENDER.boardToScreen(x, y);
    const r = RENDER.cellSize * 0.35;
    g.save();
    g.strokeStyle = "#ff2020"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(sx - r, sy - r); g.lineTo(sx + r, sy + r); g.stroke();
    g.beginPath(); g.moveTo(sx + r, sy - r); g.lineTo(sx - r, sy + r); g.stroke();
    g.restore();
  }

  /* ---------------- 绘制五连高亮 ---------------- */
  function drawWinLine(g, line) {
    if (!line || line.length === 0) return;
    const t = T();
    g.save();
    g.strokeStyle = t.winLine; g.lineWidth = 4; g.lineCap = "round";
    const first = RENDER.boardToScreen(line[0].x, line[0].y);
    const last = RENDER.boardToScreen(line[line.length - 1].x, line[line.length - 1].y);
    g.beginPath(); g.moveTo(first.x, first.y); g.lineTo(last.x, last.y); g.stroke();
    // 闪光效果
    if (RENDER.winFlash > 0) {
      const alpha = 0.3 + 0.2 * Math.sin(RENDER.winFlash * 0.3);
      g.globalAlpha = alpha;
      g.strokeStyle = "#ffffff"; g.lineWidth = 6;
      g.beginPath(); g.moveTo(first.x, first.y); g.lineTo(last.x, last.y); g.stroke();
    }
    g.restore();
  }

  /* ---------------- 手数编号 ---------------- */
  function drawMoveNumbers(g, board, moves) {
    if (!RENDER.showMoveNum) return;
    g.save();
    g.font = "9px monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      const { x, y } = RENDER.boardToScreen(m.x, m.y);
      g.fillStyle = m.player === 1 ? "#fff" : "#333";
      g.fillText(String(i + 1), x, y);
    }
    g.restore();
  }

  /* ---------------- 主绘制函数 ---------------- */
  RENDER.draw = function (board, moves, winLine, lastMove) {
    const g = RENDER.ctx;
    const px = RENDER.boardPad * 2 + RENDER.cellSize * (SIZE - 1);

    // 震屏
    if (RENDER.shakeT > 0) {
      const dx = (Math.random() - 0.5) * 4, dy = (Math.random() - 0.5) * 4;
      g.setTransform(1, 0, 0, 1, dx, dy);
      RENDER.shakeT--;
    } else {
      g.setTransform(1, 0, 0, 1, 0, 0);
    }

    g.clearRect(0, 0, px, px);
    drawBoard(g);

    // 悬停预览
    drawHover(g, board);

    // 棋子
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (board[y][x] !== 0) {
          const isLast = lastMove && lastMove.x === x && lastMove.y === y;
          drawStone(g, x, y, board[y][x], 1, 1, isLast);
        }
      }
    }

    // 落子动画（弹落效果）
    for (let i = RENDER.placingStones.length - 1; i >= 0; i--) {
      const s = RENDER.placingStones[i];
      s.t++;
      const progress = Math.min(1, s.t / 12);
      const scale = 1 + (1 - progress) * 0.5;
      const alpha = progress;
      drawStone(g, s.x, s.y, s.player, alpha, scale, false);
      if (progress >= 1) RENDER.placingStones.splice(i, 1);
    }

    // 五连高亮
    if (winLine) drawWinLine(g, winLine);

    // 禁手标记
    drawForbidden(g);

    // 手数编号
    drawMoveNumbers(g, board, moves);

    // 胜利闪烁
    if (RENDER.winFlash > 0) RENDER.winFlash--;
  };

  /* ---------------- 特效触发 ---------------- */
  RENDER.playPlace = function (x, y, player) {
    RENDER.placingStones.push({ x, y, player, t: 0 });
  };
  RENDER.playWin = function () {
    RENDER.winFlash = 60;
    RENDER.shakeT = 20;
  };
  RENDER.playForbidden = function (x, y) {
    RENDER.forbiddenPos = { x, y };
    RENDER.shakeT = 10;
    setTimeout(() => { RENDER.forbiddenPos = null; }, 2000);
  };
  RENDER.shake = function () { RENDER.shakeT = 10; };

  window.RENDER = RENDER;
})();
