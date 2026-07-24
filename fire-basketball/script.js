const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const tip = document.querySelector("#tip");
const resultDialog = document.querySelector("#resultDialog");
const resultScoreEl = document.querySelector("#resultScore");
const resultMetaEl = document.querySelector("#resultMeta");

const W = 430;
const H = 760;
const GAME_KEY = "fire-basketball-v2";
const BEST_KEY = "fire-basketball-best-v2";
const ROUND_SECONDS = 60;

const state = {
  score: 0,
  best: Number(localStorage.getItem(BEST_KEY) || 0),
  combo: 0,
  maxCombo: 0,
  timeLeft: ROUND_SECONDS,
  ended: false,
  side: "left",
  hoopY: 390,
  fire: 0,
  shake: 0,
  netSwing: 0,
  netSide: "left",
  message: "",
  messageLife: 0,
  ball: null,
  trails: [],
  particles: [],
  ripples: [],
  stuckFrames: 0,
  blackGoldMode: 0, // 0=普通, 1=5连黑金, 2=10连黑金
  last: 0,
};

let lastSavedScore = 0;

function setBestScore(value) {
  const score = Math.max(0, Math.floor(Number(value) || 0));
  if (score <= state.best) return;
  state.best = score;
  localStorage.setItem(BEST_KEY, String(state.best));
}

async function syncCloudBestScore() {
  if (!window.FreeGamesScores) return;
  const record = await window.FreeGamesScores.getBestScore(GAME_KEY);
  if (record) setBestScore(record.score);
}

async function saveFireBasketballScore(scoreValue) {
  const finalScore = Math.max(0, Math.floor(Number(scoreValue) || 0));
  if (!window.FreeGamesScores || finalScore <= 0 || finalScore <= lastSavedScore) return;
  const saved = await window.FreeGamesScores.saveScore({
    game_key: GAME_KEY,
    score: finalScore,
    won: true,
    level: 1,
    time_used: ROUND_SECONDS,
    remaining: Math.ceil(state.timeLeft),
    best_combo: state.maxCombo,
    detail: {
      combo: state.combo,
      maxCombo: state.maxCombo,
      side: state.side,
      fire: Number(state.fire.toFixed(2)),
    },
  });
  if (saved) lastSavedScore = finalScore;
}

function reset() {
  if (resultDialog?.open) resultDialog.close("reset");
  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.timeLeft = ROUND_SECONDS;
  state.ended = false;
  state.side = "left";
  state.hoopY = 395;
  state.fire = 0;
  state.shake = 0;
  state.netSwing = 0;
  state.netSide = "left";
  state.message = "";
  state.messageLife = 0;
  state.trails = [];
  state.particles = [];
  state.ripples = [];
  state.stuckFrames = 0;
  state.blackGoldMode = 0;
  spawnBall();
  tip.textContent = "60 秒挑战，点一下起跳";
}

function difficulty() {
  const elapsed = ROUND_SECONDS - state.timeLeft;
  return clamp(1 + state.score * 0.035 + elapsed * 0.006, 1, 1.7);
}

function spawnBall() {
  state.stuckFrames = 0;
  const dir = state.side === "left" ? -1 : 1;
  const level = difficulty();
  state.ball = {
    x: W / 2,
    y: H * 0.64,
    px: W / 2,
    py: H * 0.64,
    vx: dir * 2.65 * level,
    vy: -3.2,
    r: 18,
    spin: 0,
    scored: false,
    dead: false,
  };
}

function targetHoop() {
  return {
    x: state.side === "left" ? 36 : W - 36,
    y: state.hoopY,
    side: state.side,
  };
}

function hoopRimX(hoop) {
  const dir = hoop.side === "left" ? 1 : -1;
  const poleX = hoop.side === "left" ? 0 : W;
  return poleX + dir * 34;
}

function flap() {
  if (state.ended) return;
  if (!state.ball || state.ball.dead) spawnBall();
  const b = state.ball;
  b.vy = -6.15;
  b.vx += (state.side === "left" ? -0.18 : 0.18);
  const maxSpeed = 4.2 + (difficulty() - 1) * 1.15;
  b.vx = clamp(b.vx, -maxSpeed, maxSpeed);
  state.ripples.push({ x: b.x, y: b.y, r: 10, life: 0.18 });
  tip.textContent = "控高度，抢时间，穿过篮筐";
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  flap();
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    flap();
  }
  if (event.code === "KeyR") {
    saveFireBasketballScore(state.score);
    reset();
  }
});

resultDialog?.addEventListener("close", () => {
  if (resultDialog.returnValue === "restart") reset();
});

function update(delta) {
  state.shake = Math.max(0, state.shake - delta * 4);
  state.netSwing = Math.max(0, state.netSwing - delta * 2.8);
  state.fire = state.blackGoldMode ? 1 : Math.max(0, state.fire - delta * 0.18);
  state.messageLife = Math.max(0, state.messageLife - delta);

  if (state.ended) {
    updateEffects(delta);
    return;
  }

  state.timeLeft = Math.max(0, state.timeLeft - delta);
  if (state.timeLeft <= 0) {
    endRound();
    updateEffects(delta);
    return;
  }

  const b = state.ball;
  if (!b) return;

  const dir = state.side === "left" ? -1 : 1;
  const level = difficulty();
  b.px = b.x;
  b.py = b.y;
  b.vx += (dir * 2.85 * level - b.vx) * 0.015;
  b.vy += 0.23 + (level - 1) * 0.045;
  b.x += b.vx;
  b.y += b.vy;
  b.spin += b.vx * 0.045;

  state.trails.push({ x: b.x, y: b.y, life: state.fire > 0 ? 0.62 : 0.3, fire: state.fire > 0, blackGoldMode: state.blackGoldMode });

  // 卡死检测：本帧位移过小就累加，连续多帧位移过小就强制 miss
  const movedX = b.x - b.px;
  const movedY = b.y - b.py;
  const moved = Math.hypot(movedX, movedY);
  if (moved < 0.45) {
    state.stuckFrames += 1;
  } else {
    state.stuckFrames = Math.max(0, state.stuckFrames - 2);
  }
  if (state.stuckFrames > 90) {
    state.stuckFrames = 0;
    miss();
    updateEffects(delta);
    return;
  }

  if (b.y < 108) {
    b.y = 108;
    b.vy = Math.abs(b.vy) * 0.68;
  }
  if (b.y > H - 68) {
    miss();
    updateEffects(delta);
    return;
  }

  checkScore();
  if (!collideRim()) {
    collideBackboard();
  }
  if (b.x < -28 || b.x > W + 28) {
    miss();
    updateEffects(delta);
    return;
  }
  updateEffects(delta);
}

function miss() {
  if (state.ended) return;
  state.combo = 0;
  state.fire = 0;
  state.blackGoldMode = 0;
  state.shake = Math.max(state.shake, 0.25);
  showMessage("失误", 0.55);
  tip.textContent = "60 秒挑战，点一下起跳";
  spawnBall();
}

function checkScore() {
  const b = state.ball;
  if (!b || b.scored) return;
  const hoop = targetHoop();
  const rimX = hoopRimX(hoop);
  const rimY = hoop.y - 8;
  const result = scoreHitTest(b, rimX, rimY, hoop.side);
  if (!result.hit) return;

  const perfect = result.perfect;
  const add = 1;
  state.score += add;
  setBestScore(state.score);
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  saveFireBasketballScore(state.score);
  state.fire = Math.min(1, state.fire + (perfect ? 0.5 : 0.27));
  state.shake = perfect ? 0.65 : 0.36;

  // 黑金模式触发
  const oldMode = state.blackGoldMode;
  if (state.combo >= 10) state.blackGoldMode = 2;
  else if (state.combo >= 5) state.blackGoldMode = 1;
  if (state.blackGoldMode > oldMode) {
    const isTen = state.blackGoldMode === 2;
    state.shake = Math.max(state.shake, isTen ? 1.0 : 0.75);
    state.fire = 1;
    showMessage(isTen ? "⚫ 黑金 x10 ⚫" : "⚡ 黑金 x5 ⚡", isTen ? 1.8 : 1.5);
    burst(rimX, rimY, isTen ? 80 : 50, true, isTen ? "blackGold10" : "blackGold5");
    tip.textContent = isTen ? "黑金神话！全力输出！" : "黑金觉醒！继续连击！";
  } else {
    showMessage(perfect ? `完美 x${Math.max(2, state.combo)}` : `命中 +1`, 1.05);
    burst(rimX, rimY, perfect ? 36 : 20, perfect, state.blackGoldMode ? (state.blackGoldMode === 2 ? "blackGold10" : "blackGold5") : "");
  }

  state.netSide = state.side;
  state.netSwing = 1;

  b.scored = true;
  state.side = state.side === "left" ? "right" : "left";
  state.hoopY = 210 + Math.random() * 390;
  const level = difficulty();
  b.vx = (state.side === "left" ? -2.9 : 2.9) * level;
  b.vy = -4.4 - Math.min(0.7, (level - 1) * 0.5);
  b.x = clamp(b.x, 70, W - 70);
  b.px = b.x;
  b.py = b.y;
  b.scored = false;
}

function endRound() {
  if (state.ended) return;
  state.ended = true;
  state.combo = 0;
  state.fire = 0;
  state.blackGoldMode = 0;
  state.shake = Math.max(state.shake, 0.45);
  showMessage("时间到", 1);
  saveFireBasketballScore(state.score);
  resultScoreEl.textContent = String(state.score);
  resultMetaEl.textContent = `最高 ${state.best} · 最高连击 ${state.maxCombo}`;
  if (resultDialog && !resultDialog.open) resultDialog.showModal();
}

function collideBackboard() {
  const b = state.ball;
  if (!b || b.scored) return false;

  const hoop = targetHoop();
  const hit = backboardHitTest(b, hoop);
  if (!hit.hit) return false;

  const dir = hoop.side === "left" ? 1 : -1;
  const rimY = hoop.y - 8;
  const boardTop = hoop.y - 74;
  const boardBottom = hoop.y + 52;

  b.x = hit.planeX;
  b.vx = Math.max(1.65, Math.abs(b.vx)) * dir * 0.9;
  b.vy *= b.y < rimY - 18 ? 0.9 : 0.76;
  b.spin += dir * 0.8;
  state.shake = Math.max(state.shake, 0.2);
  state.netSide = hoop.side;
  state.netSwing = Math.max(state.netSwing, 0.1);
  state.ripples.push({ x: hit.boardInnerX, y: clamp(hit.y, boardTop + 10, boardBottom - 10), r: 13, life: 0.18 });
  return true;
}

function backboardHitTest(ball, hoop) {
  const dir = hoop.side === "left" ? 1 : -1;
  const edgePad = 9;
  const boardTop = hoop.y - 74 - edgePad;
  const boardBottom = hoop.y + 52 + edgePad;
  const boardInnerX = hoop.side === "left" ? 14 : W - 14;
  const planeX = boardInnerX + dir * ball.r;
  const movingIntoBoard = hoop.side === "left" ? ball.vx < -0.12 : ball.vx > 0.12;
  if (!movingIntoBoard) return { hit: false };

  const crossedPlane = hoop.side === "left"
    ? ball.px > planeX && ball.x <= planeX
    : ball.px < planeX && ball.x >= planeX;
  const t = Math.abs(ball.x - ball.px) < 0.001 ? 1 : clamp((planeX - ball.px) / (ball.x - ball.px), 0, 1);
  const yAtPlane = ball.py + (ball.y - ball.py) * t;
  const sweptYOnBoard = yAtPlane + ball.r >= boardTop && yAtPlane - ball.r <= boardBottom;

  const penetratingFace = hoop.side === "left"
    ? ball.x <= planeX && ball.x >= -ball.r
    : ball.x >= planeX && ball.x <= W + ball.r;
  const currentYOnBoard = ball.y + ball.r >= boardTop && ball.y - ball.r <= boardBottom;
  const overlapHit = penetratingFace && currentYOnBoard;

  const topEdgeHit = sweptPointHit(ball, boardInnerX, boardTop + edgePad, ball.r + 4);
  const bottomEdgeHit = sweptPointHit(ball, boardInnerX, boardBottom - edgePad, ball.r + 4);
  const edgeHit = movingIntoBoard && (topEdgeHit.hit || bottomEdgeHit.hit);

  if ((crossedPlane && sweptYOnBoard) || overlapHit || edgeHit) {
    const edge = topEdgeHit.hit ? topEdgeHit : bottomEdgeHit;
    return {
      hit: true,
      planeX,
      boardInnerX,
      y: edgeHit ? edge.cy : (crossedPlane && sweptYOnBoard ? yAtPlane : ball.y),
    };
  }

  return { hit: false };
}

function collideRim() {
  const b = state.ball;
  if (!b || b.scored) return false;

  const hoop = targetHoop();
  const rimX = hoopRimX(hoop);
  const rimY = hoop.y - 8;
  const rimPoints = [
    { x: rimX - 31, y: rimY },
    { x: rimX - 16, y: rimY + 3 },
    { x: rimX, y: rimY + 4 },
    { x: rimX + 16, y: rimY + 3 },
    { x: rimX + 31, y: rimY },
  ];
  let contact = null;
  const minDist = b.r + 6;

  for (const point of rimPoints) {
    const hit = sweptPointHit(b, point.x, point.y, minDist);
    if (!hit.hit) continue;
    if (!contact || hit.t < contact.t) contact = { ...point, ...hit };
  }
  if (!contact) return false;

  const prevDx = b.px - contact.x;
  const prevDy = b.py - contact.y;
  const wasClear = prevDx * prevDx + prevDy * prevDy >= (minDist - 2) * (minDist - 2);
  if (!wasClear && Math.abs(b.vy) < 2.2) return false;

  const dist = Math.max(0.001, Math.sqrt(contact.distSq));
  const nx = contact.dx / dist || (hoop.side === "left" ? 1 : -1);
  const ny = contact.dy / dist || -1;
  const speedIntoRim = b.vx * nx + b.vy * ny;
  if (speedIntoRim >= 0.4) return false;

  b.x = contact.x + nx * minDist;
  b.y = contact.y + ny * minDist;
  b.vx = (b.vx - 1.25 * speedIntoRim * nx) * 0.62;
  b.vy = (b.vy - 1.25 * speedIntoRim * ny) * 0.58;
  // 防止反弹后球速过小卡在篮筐附近：给一个最小的逃逸速度
  if (Math.abs(b.vx) < 0.6) b.vx += nx * 1.4;
  if (Math.abs(b.vy) < 0.6) b.vy += ny * 1.4 - 0.8; // 略向上逃逸
  b.spin += nx * 0.45;
  state.shake = Math.max(state.shake, 0.12);
  state.netSide = hoop.side;
  state.netSwing = Math.max(state.netSwing, 0.2);
  state.ripples.push({ x: contact.x, y: contact.y, r: 7, life: 0.13 });
  return true;
}

function sweptPointHit(ball, x, y, radius) {
  const vx = ball.x - ball.px;
  const vy = ball.y - ball.py;
  const lenSq = vx * vx + vy * vy;
  const t = lenSq < 0.0001
    ? 1
    : clamp(((x - ball.px) * vx + (y - ball.py) * vy) / lenSq, 0, 1);
  const cx = ball.px + vx * t;
  const cy = ball.py + vy * t;
  const dx = cx - x;
  const dy = cy - y;
  const distSq = dx * dx + dy * dy;
  return {
    hit: distSq <= radius * radius,
    t,
    cx,
    cy,
    dx,
    dy,
    distSq,
  };
}

function scoreHitTest(ball, rimX, rimY, side) {
  const dir = side === "left" ? -1 : 1;
  const crossedRimLine = dir < 0
    ? ball.px >= rimX - 26 && ball.x <= rimX + 28
    : ball.px <= rimX + 26 && ball.x >= rimX - 28;
  const t = Math.abs(ball.x - ball.px) < 0.001 ? 1 : clamp((rimX - ball.px) / (ball.x - ball.px), 0, 1);
  const yAtRim = ball.py + (ball.y - ball.py) * t;
  const widthWindow = Math.abs((ball.x + ball.px) / 2 - rimX) < 60;
  const heightOk = yAtRim > rimY - 30 && yAtRim < rimY + 35;
  const movingIn = dir < 0 ? ball.vx < -0.35 : ball.vx > 0.35;
  const notDrillingUp = ball.vy > -0.15 || ball.py < rimY - 6;
  const notFromBelow = !(ball.py > rimY + 18 && ball.y <= rimY + 18);
  const horizontalHit = crossedRimLine && widthWindow && movingIn && heightOk && notDrillingUp && notFromBelow;

  const crossedDownThroughRim = ball.py <= rimY - 16 && ball.y >= rimY - 2 && ball.vy > 0.35;
  const verticalT = Math.abs(ball.y - ball.py) < 0.001 ? 1 : clamp((rimY - ball.py) / (ball.y - ball.py), 0, 1);
  const xAtRim = ball.px + (ball.x - ball.px) * verticalT;
  const rimMouthMin = rimX - 43;
  const rimMouthMax = rimX + 43;
  const verticalHit = crossedDownThroughRim && xAtRim >= rimMouthMin && xAtRim <= rimMouthMax;

  const netGateY = rimY + 18;
  const crossedNetGate = ball.py <= netGateY && ball.y >= netGateY && ball.vy > 0.35;
  const netT = Math.abs(ball.y - ball.py) < 0.001 ? 1 : clamp((netGateY - ball.py) / (ball.y - ball.py), 0, 1);
  const xAtNet = ball.px + (ball.x - ball.px) * netT;
  const enteredFromAbove = ball.py < rimY + 12;
  const netGateHit = crossedNetGate && enteredFromAbove && xAtNet >= rimX - 42 && xAtNet <= rimX + 42;

  const settledInNet = ball.vy > 0.25
    && ball.y > ball.py
    && ball.py < rimY + 36
    && ball.y > rimY + 6
    && ball.y < rimY + 62
    && Math.abs(ball.x - rimX) < 39
    && !(ball.py > rimY + 28 && ball.y <= rimY + 28);

  const hit = horizontalHit || verticalHit || netGateHit || settledInNet;
  const nearCenter = horizontalHit
    ? Math.abs(yAtRim - rimY)
    : Math.min(Math.abs(xAtRim - rimX), Math.abs(xAtNet - rimX), Math.abs(ball.x - rimX));
  return {
    hit,
    perfect: hit && nearCenter < 12 && Math.abs(ball.vy) < 7.4,
    yAtRim,
    xAtRim,
    xAtNet,
    horizontalHit,
    verticalHit,
    netGateHit,
    settledInNet,
  };
}

if (typeof window !== "undefined") {
  window.__fireBasketballHitTest = scoreHitTest;
  window.__fireBasketballBackboardHitTest = backboardHitTest;
}

function showMessage(text, life) {
  state.message = text;
  state.messageLife = life;
}

function updateEffects(delta) {
  for (const t of state.trails) t.life -= delta;
  state.trails = state.trails.filter((t) => t.life > 0);
  for (const r of state.ripples) {
    r.life -= delta;
    r.r += delta * 120;
  }
  state.ripples = state.ripples.filter((r) => r.life > 0);
  for (const p of state.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08;
    p.life -= delta;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
}

function burst(x, y, count, hot, theme = "") {
  const isBlackGold5 = theme === "blackGold5";
  const isBlackGold10 = theme === "blackGold10";
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = isBlackGold10 ? 2 + Math.random() * 8 : isBlackGold5 ? 1.5 + Math.random() * 6 : 1 + Math.random() * (hot ? 6 : 3);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      r: isBlackGold10 ? 3 + Math.random() * 5 : isBlackGold5 ? 2 + Math.random() * 4 : hot ? 2 + Math.random() * 4 : 1 + Math.random() * 2,
      life: isBlackGold10 ? 1.2 : isBlackGold5 ? 0.95 : hot ? 0.8 : 0.45,
      color: isBlackGold10
        ? (Math.random() > 0.5 ? "#000000" : (Math.random() > 0.3 ? "#ffd15c" : "#ffffff"))
        : isBlackGold5
        ? (Math.random() > 0.5 ? "#111111" : "#ffd15c")
        : hot
        ? (Math.random() > 0.4 ? "#ff6a22" : "#ffd15c")
        : "#ffffff",
    });
  }
}

function draw() {
  const sx = (Math.random() - 0.5) * state.shake * 10;
  const sy = (Math.random() - 0.5) * state.shake * 8;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(sx, sy);
  drawCourt();
  drawHoop(targetHoop());
  drawTrails();
  drawRipples();
  drawBall();
  drawParticles();
  drawHud();
  drawComboBadge();
  drawTextFx();
  ctx.restore();
}

function drawCourt() {
  const bg = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 390);
  bg.addColorStop(0, "#61666f");
  bg.addColorStop(0.7, "#333942");
  bg.addColorStop(1, "#20252e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fillRect(0, 86, W, 3);
  ctx.fillRect(0, H - 78, W, 3);
  ctx.strokeStyle = "rgba(255,255,255,.08)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 72, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHud() {
  ctx.fillStyle = "rgba(10,12,18,.78)";
  roundRect(42, 14, W - 84, 62, 16, true);
  drawAvatar(76, 45, "#ff4c58", "火");
  ctx.fillStyle = "#ff4c58";
  roundRect(105, 27, 92, 28, 14, true);
  ctx.fillStyle = "#42a5ff";
  roundRect(W - 190, 27, 112, 28, 14, true);
  ctx.fillStyle = "#fff";
  ctx.font = "900 18px Microsoft YaHei";
  ctx.textAlign = "center";
  ctx.fillText(state.score, 151, 47);
  ctx.fillText(`最高 ${state.best}`, W - 134, 47);
  ctx.fillStyle = state.blackGoldMode ? "#ffdf5a" : "#ffd15c";
  ctx.font = `900 ${state.blackGoldMode ? 17 : 15}px Microsoft YaHei`;
  ctx.fillText(`x${state.combo}`, W / 2, 40);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 12px Microsoft YaHei";
  ctx.fillText("烈火篮球", W / 2, 61);

  const seconds = Math.ceil(state.timeLeft);
  ctx.fillStyle = seconds <= 10 ? "#ff4c58" : "#ffc247";
  roundRect(W / 2 - 42, 82, 84, 30, 15, true);
  ctx.fillStyle = seconds <= 10 ? "#fff" : "#18120a";
  ctx.font = "900 16px Microsoft YaHei";
  ctx.fillText(`${seconds}s`, W / 2, 102);
}

function drawComboBadge() {
  if (state.blackGoldMode === 2) {
    ctx.fillStyle = "rgba(255,215,80,0.16)";
    ctx.strokeStyle = "rgba(255,215,80,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, 40, 34 + Math.sin(Date.now() / 140) * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (state.blackGoldMode === 1) {
    ctx.strokeStyle = "rgba(255,215,80,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, 40, 30, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawAvatar(x, y, color, text) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "900 16px Microsoft YaHei";
  ctx.fillText(text, x, y + 6);
}

function drawHoop(hoop) {
  const dir = hoop.side === "left" ? 1 : -1;
  const poleX = hoop.side === "left" ? 0 : W;
  const rimX = hoopRimX(hoop);
  const rimY = hoop.y - 8;
  const active = state.netSide === hoop.side ? state.netSwing : 0;
  const drop = Math.sin(active * Math.PI) * 22;
  const sway = Math.sin((1 - active) * Math.PI * 5) * active * 10 * dir;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.fillStyle = "rgba(220,246,255,.24)";
  ctx.strokeStyle = "#d8f3ff";
  ctx.lineWidth = 4;
  const boardX = poleX + dir * 2;
  ctx.beginPath();
  ctx.rect(boardX - (dir < 0 ? 8 : 0), hoop.y - 74, dir * 10, 126);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(poleX + dir * 6, hoop.y - 46);
  ctx.lineTo(poleX + dir * 6, hoop.y + 33);
  ctx.stroke();

  ctx.strokeStyle = "#ff433f";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(poleX + dir * 4, rimY);
  ctx.lineTo(rimX + dir * 28, rimY);
  ctx.stroke();

  ctx.strokeStyle = "rgba(120,20,20,.75)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(rimX, rimY + 1, 31, 9, 0, 0, Math.PI * 2);
  ctx.stroke();

  const top = [];
  const bottom = [];
  for (let i = 0; i < 6; i += 1) {
    const t = i / 5;
    top.push({
      x: rimX - dir * 27 + dir * 54 * t,
      y: rimY + Math.sin(t * Math.PI) * 3,
    });
    bottom.push({
      x: rimX - dir * 20 + dir * 40 * t + sway * Math.sin(t * Math.PI),
      y: rimY + 48 + drop * Math.sin(t * Math.PI),
    });
  }

  ctx.strokeStyle = "rgba(255,255,255,.92)";
  ctx.lineWidth = 3;
  for (let i = 0; i < top.length; i += 1) {
    ctx.beginPath();
    ctx.moveTo(top[i].x, top[i].y);
    ctx.quadraticCurveTo(
      (top[i].x + bottom[i].x) / 2 + sway * 0.35,
      rimY + 24 + drop * 0.4,
      bottom[i].x,
      bottom[i].y,
    );
    ctx.stroke();
  }
  for (let i = 0; i < top.length - 1; i += 1) {
    ctx.beginPath();
    ctx.moveTo(top[i].x, top[i].y + 12);
    ctx.lineTo(bottom[i + 1].x, bottom[i + 1].y - 10);
    ctx.moveTo(top[i + 1].x, top[i + 1].y + 12);
    ctx.lineTo(bottom[i].x, bottom[i].y - 10);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,.75)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bottom[0].x, bottom[0].y);
  for (let i = 1; i < bottom.length; i += 1) ctx.lineTo(bottom[i].x, bottom[i].y);
  ctx.stroke();

  ctx.strokeStyle = "#ff433f";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(rimX, rimY - 1, 31, 9, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawTrails() {
  for (const t of state.trails) {
    const alpha = Math.max(0, t.life / (t.fire ? 0.62 : 0.3));
    const radius = t.blackGoldMode === 2 ? 52 : t.blackGoldMode === 1 ? 44 : (t.fire ? 38 : 20);
    const grad = ctx.createRadialGradient(t.x, t.y, 2, t.x, t.y, radius);
    if (t.blackGoldMode === 2) {
      grad.addColorStop(0, `rgba(255,215,80,${alpha})`);
      grad.addColorStop(0.25, `rgba(0,0,0,${alpha * .9})`);
      grad.addColorStop(0.6, `rgba(255,215,80,${alpha * .75})`);
      grad.addColorStop(1, "rgba(255,215,80,0)");
    } else if (t.blackGoldMode === 1) {
      grad.addColorStop(0, `rgba(255,215,80,${alpha})`);
      grad.addColorStop(0.4, `rgba(15,15,20,${alpha * .85})`);
      grad.addColorStop(1, "rgba(255,215,80,0)");
    } else {
      grad.addColorStop(0, t.fire ? `rgba(255,225,82,${alpha})` : `rgba(255,255,255,${alpha * .35})`);
      grad.addColorStop(0.45, t.fire ? `rgba(255,95,24,${alpha * .75})` : `rgba(255,132,42,${alpha * .25})`);
      grad.addColorStop(1, "rgba(255,80,0,0)");
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRipples() {
  for (const r of state.ripples) {
    ctx.globalAlpha = Math.max(0, r.life / 0.18);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawBall() {
  const b = state.ball;
  if (!b) return;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.spin);
  const bgMode = state.blackGoldMode;
  if (state.fire > 0) {
    const flame = ctx.createRadialGradient(0, 0, 8, 0, 0, bgMode === 2 ? 54 : bgMode === 1 ? 48 : 42);
    if (bgMode === 2) {
      flame.addColorStop(0, "rgba(255,215,80,.95)");
      flame.addColorStop(0.28, "rgba(0,0,0,.85)");
      flame.addColorStop(0.55, "rgba(255,215,80,.55)");
      flame.addColorStop(1, "rgba(255,215,80,0)");
    } else if (bgMode === 1) {
      flame.addColorStop(0, "rgba(255,215,80,.9)");
      flame.addColorStop(0.5, "rgba(30,30,30,.5)");
      flame.addColorStop(1, "rgba(255,215,80,0)");
    } else {
      flame.addColorStop(0, "rgba(255,238,96,.9)");
      flame.addColorStop(0.5, "rgba(255,87,22,.5)");
      flame.addColorStop(1, "rgba(255,50,0,0)");
    }
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.arc(0, 0, bgMode === 2 ? 54 : bgMode === 1 ? 48 : 44, 0, Math.PI * 2);
    ctx.fill();
  }
  // 10连额外脉冲环
  if (bgMode === 2) {
    ctx.strokeStyle = "rgba(255,215,80,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 62 + Math.sin(Date.now() / 120) * 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = bgMode ? "#121214" : "#f36b21";
  ctx.beginPath();
  ctx.arc(0, 0, b.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = bgMode ? "#ffd15c" : "#7b2d12";
  ctx.lineWidth = bgMode ? 3.5 : 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, b.r, 0, Math.PI * 2);
  ctx.moveTo(-b.r, 0);
  ctx.lineTo(b.r, 0);
  ctx.moveTo(0, -b.r);
  ctx.lineTo(0, b.r);
  ctx.arc(-b.r * .55, 0, b.r * .65, -Math.PI / 2, Math.PI / 2);
  ctx.arc(b.r * .55, 0, b.r * .65, Math.PI / 2, Math.PI * 1.5);
  ctx.stroke();
  // 黑金版高光
  if (bgMode) {
    ctx.fillStyle = "rgba(255,215,80,0.22)";
    ctx.beginPath();
    ctx.arc(-b.r * 0.4, -b.r * 0.4, b.r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / 0.8);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTextFx() {
  if (state.messageLife <= 0) return;
  const a = Math.min(1, state.messageLife);
  ctx.globalAlpha = a;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#3b1610";
  ctx.lineWidth = 8;
  ctx.font = "900 42px Microsoft YaHei";
  ctx.textAlign = "center";
  ctx.strokeText(state.message, W / 2, H * 0.38);
  ctx.fillText(state.message, W / 2, H * 0.38);
  ctx.globalAlpha = 1;
}

function roundRect(x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  if (fill) ctx.fill();
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function frame(now) {
  const delta = Math.min(0.033, (now - state.last) / 1000 || 0);
  state.last = now;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

reset();
syncCloudBestScore();
requestAnimationFrame(frame);
