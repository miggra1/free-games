const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const tip = document.querySelector("#tip");

const W = 430;
const H = 760;

const state = {
  score: 0,
  best: Number(localStorage.getItem("fire-basketball-best") || 0),
  combo: 0,
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
  last: 0,
};

function reset() {
  state.score = 0;
  state.combo = 0;
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
  spawnBall();
  tip.textContent = "点一下，篮球往上跳";
}

function spawnBall() {
  const dir = state.side === "left" ? -1 : 1;
  state.ball = {
    x: W / 2,
    y: H * 0.64,
    px: W / 2,
    py: H * 0.64,
    vx: dir * 2.65,
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
  if (!state.ball || state.ball.dead) spawnBall();
  const b = state.ball;
  b.vy = -6.15;
  b.vx += (state.side === "left" ? -0.18 : 0.18);
  b.vx = clamp(b.vx, -4.2, 4.2);
  state.ripples.push({ x: b.x, y: b.y, r: 10, life: 0.18 });
  tip.textContent = "连续点击控高度，穿过篮筐";
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
  if (event.code === "KeyR") reset();
});

function update(delta) {
  state.shake = Math.max(0, state.shake - delta * 4);
  state.netSwing = Math.max(0, state.netSwing - delta * 2.8);
  state.fire = Math.max(0, state.fire - delta * 0.18);
  state.messageLife = Math.max(0, state.messageLife - delta);

  const b = state.ball;
  if (!b) return;

  const dir = state.side === "left" ? -1 : 1;
  b.px = b.x;
  b.py = b.y;
  b.vx += (dir * 2.85 - b.vx) * 0.015;
  b.vy += 0.23;
  b.x += b.vx;
  b.y += b.vy;
  b.spin += b.vx * 0.045;

  state.trails.push({ x: b.x, y: b.y, life: state.fire > 0 ? 0.62 : 0.3, fire: state.fire > 0 });

  if (b.y < 108) {
    b.y = 108;
    b.vy = Math.abs(b.vy) * 0.68;
  }
  if (b.y > H - 68) {
    miss();
  }
  if (b.x < -28 || b.x > W + 28) {
    miss();
  }

  checkScore();
  collideBackboard();
  updateEffects(delta);
}

function miss() {
  state.combo = 0;
  state.fire = 0;
  state.shake = Math.max(state.shake, 0.25);
  showMessage("失误", 0.55);
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
  state.best = Math.max(state.best, state.score);
  localStorage.setItem("fire-basketball-best", String(state.best));
  state.combo += 1;
  state.fire = Math.min(1, state.fire + (perfect ? 0.5 : 0.27));
  state.shake = perfect ? 0.65 : 0.36;
  showMessage(perfect ? `完美 x${Math.max(2, state.combo)}` : `命中 +1`, 1.05);
  burst(rimX, rimY, perfect ? 36 : 20, perfect);
  state.netSide = state.side;
  state.netSwing = 1;

  b.scored = true;
  state.side = state.side === "left" ? "right" : "left";
  state.hoopY = 210 + Math.random() * 390;
  b.vx = state.side === "left" ? -2.9 : 2.9;
  b.vy = -4.4;
  b.x = clamp(b.x, 70, W - 70);
}

function collideBackboard() {
  const b = state.ball;
  if (!b || b.scored) return;

  const hoop = targetHoop();
  const dir = hoop.side === "left" ? 1 : -1;
  const boardTop = hoop.y - 74;
  const boardBottom = hoop.y + 52;
  const boardInnerX = hoop.side === "left" ? 14 : W - 14;
  const yOnBoard = b.y + b.r > boardTop && b.y - b.r < boardBottom;
  if (!yOnBoard) return;

  const hitLeftBoard = hoop.side === "left" && b.vx < 0 && b.px - b.r > boardInnerX && b.x - b.r <= boardInnerX;
  const hitRightBoard = hoop.side === "right" && b.vx > 0 && b.px + b.r < boardInnerX && b.x + b.r >= boardInnerX;
  if (!hitLeftBoard && !hitRightBoard) return;

  b.x = boardInnerX + dir * b.r;
  b.vx = Math.abs(b.vx) * dir * 0.72;
  b.vy *= 0.86;
  b.spin += dir * 0.55;
  state.shake = Math.max(state.shake, 0.16);
  state.netSide = hoop.side;
  state.netSwing = Math.max(state.netSwing, 0.18);
  state.ripples.push({ x: boardInnerX, y: clamp(b.y, boardTop + 10, boardBottom - 10), r: 8, life: 0.14 });
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
  const rimMouthMin = rimX - 34;
  const rimMouthMax = rimX + 34;
  const verticalHit = crossedDownThroughRim && xAtRim >= rimMouthMin && xAtRim <= rimMouthMax;

  const hit = horizontalHit || verticalHit;
  const nearCenter = horizontalHit ? Math.abs(yAtRim - rimY) : Math.abs(xAtRim - rimX);
  return {
    hit,
    perfect: hit && nearCenter < 10 && Math.abs(ball.vy) < 7.4,
    yAtRim,
    xAtRim,
    horizontalHit,
    verticalHit,
  };
}

if (typeof window !== "undefined") {
  window.__fireBasketballHitTest = scoreHitTest;
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

function burst(x, y, count, hot) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = 1 + Math.random() * (hot ? 6 : 3);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      r: hot ? 2 + Math.random() * 4 : 1 + Math.random() * 2,
      life: hot ? 0.8 : 0.45,
      color: hot ? (Math.random() > 0.4 ? "#ff6a22" : "#ffd15c") : "#ffffff",
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
  ctx.fillStyle = "#ffd15c";
  ctx.font = "900 15px Microsoft YaHei";
  ctx.fillText(`x${state.combo}`, W / 2, 40);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 12px Microsoft YaHei";
  ctx.fillText("烈火篮球", W / 2, 61);
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
    const grad = ctx.createRadialGradient(t.x, t.y, 2, t.x, t.y, t.fire ? 38 : 20);
    grad.addColorStop(0, t.fire ? `rgba(255,225,82,${alpha})` : `rgba(255,255,255,${alpha * .35})`);
    grad.addColorStop(0.45, t.fire ? `rgba(255,95,24,${alpha * .75})` : `rgba(255,132,42,${alpha * .25})`);
    grad.addColorStop(1, "rgba(255,80,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.fire ? 36 : 20, 0, Math.PI * 2);
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
  if (state.fire > 0) {
    const flame = ctx.createRadialGradient(0, 0, 8, 0, 0, 42);
    flame.addColorStop(0, "rgba(255,238,96,.9)");
    flame.addColorStop(0.5, "rgba(255,87,22,.5)");
    flame.addColorStop(1, "rgba(255,50,0,0)");
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#f36b21";
  ctx.beginPath();
  ctx.arc(0, 0, b.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#7b2d12";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, b.r, 0, Math.PI * 2);
  ctx.moveTo(-b.r, 0);
  ctx.lineTo(b.r, 0);
  ctx.moveTo(0, -b.r);
  ctx.lineTo(0, b.r);
  ctx.arc(-b.r * .55, 0, b.r * .65, -Math.PI / 2, Math.PI / 2);
  ctx.arc(b.r * .55, 0, b.r * .65, Math.PI / 2, Math.PI * 1.5);
  ctx.stroke();
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
requestAnimationFrame(frame);
