const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const speedEl = document.querySelector("#speed");
const nitroTextEl = document.querySelector("#nitroText");
const bestEl = document.querySelector("#best");
const restartBtn = document.querySelector("#restartBtn");
const resultDialog = document.querySelector("#resultDialog");
const resultTextEl = document.querySelector("#resultText");

const keys = new Set();
const touch = { left: false, right: false, brake: false, nitro: false };
const gameKey = "speed-fury";
const bestKey = "speed-fury-best";
const carColors = ["#5dc8ff", "#f3c760", "#f15d4e", "#8fd66f", "#c780ff"];

let best = Number(localStorage.getItem(bestKey) || 0);
let game;
let lastTime = 0;
let lastSavedScore = 0;

bestEl.textContent = best;

function setBestScore(value) {
  const score = Math.max(0, Math.floor(Number(value) || 0));
  if (score <= best) return;
  best = score;
  localStorage.setItem(bestKey, String(best));
  bestEl.textContent = best;
}

async function syncCloudBestScore() {
  if (!window.FreeGamesScores) return;
  const record = await window.FreeGamesScores.getBestScore(gameKey);
  if (record) setBestScore(record.score);
}

async function saveSpeedFuryScore(scoreValue) {
  const finalScore = Math.max(0, Math.floor(Number(scoreValue) || 0));
  if (!window.FreeGamesScores || finalScore <= 0 || finalScore <= lastSavedScore) return;
  const saved = await window.FreeGamesScores.saveScore({
    game_key: gameKey,
    score: finalScore,
    won: false,
    level: 1,
    time_used: null,
    best_combo: null,
    detail: {
      speed: Math.floor(game.speed),
      nitro: Math.floor(game.nitro),
      traffic: game.traffic.length,
    },
  });
  if (saved) lastSavedScore = finalScore;
}

function createGame() {
  return {
    state: "ready",
    score: 0,
    speed: 210,
    targetSpeed: 250,
    nitro: 100,
    roadOffset: 0,
    cityOffset: 0,
    spawnTimer: 0,
    shake: 0,
    player: { x: 0.5, y: 0.82, width: 50, height: 88 },
    traffic: [],
    sparks: [],
  };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvas.w = rect.width;
  canvas.h = rect.height;
}

function w() { return canvas.w || canvas.clientWidth || 720; }
function h() { return canvas.h || canvas.clientHeight || 760; }
function roadWidth() { return Math.min(w() * 0.72, 520); }
function roadLeft() { return (w() - roadWidth()) / 2; }
function laneX(xRatio) { return roadLeft() + roadWidth() * xRatio; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function down(action) { return touch[action] || keys.has(action); }

function restart() {
  if (resultDialog.open) resultDialog.close();
  game = createGame();
  updateHud();
}

function start() {
  if (game.state === "ready") game.state = "playing";
  if (game.state === "crashed") restart();
}

function spawnTraffic() {
  const lane = [0.18, 0.34, 0.5, 0.66, 0.82][Math.floor(Math.random() * 5)];
  game.traffic.push({
    x: lane,
    y: -0.12,
    width: 48,
    height: 86,
    speed: 145 + Math.random() * 170,
    color: carColors[Math.floor(Math.random() * carColors.length)],
    passed: false,
  });
}

function crash() {
  if (game.state !== "playing") return;
  game.state = "crashed";
  game.shake = 20;
  const finalScore = Math.floor(game.score);
  setBestScore(finalScore);
  burst(laneX(game.player.x), h() * game.player.y, "#f3c760", 36);
  burst(laneX(game.player.x), h() * game.player.y, "#f15d4e", 28);
  resultTextEl.textContent = `得分 ${finalScore}，最高 ${best}`;
  if (!resultDialog.open) resultDialog.showModal();
  saveSpeedFuryScore(finalScore);
}

function burst(x, y, color, amount) {
  for (let i = 0; i < amount; i += 1) {
    game.sparks.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 360,
      vy: (Math.random() - 0.8) * 300,
      life: 0.35 + Math.random() * 0.55,
      color,
    });
  }
}

function overlap(a, b) {
  const ax = laneX(a.x) - a.width / 2;
  const ay = h() * a.y - a.height / 2;
  const bx = laneX(b.x) - b.width / 2;
  const by = h() * b.y - b.height / 2;
  return ax < bx + b.width && ax + a.width > bx && ay < by + b.height && ay + a.height > by;
}

function update(delta) {
  if (game.state === "playing") {
    const steering = (down("right") ? 1 : 0) - (down("left") ? 1 : 0);
    const usingNitro = down("nitro") && game.nitro > 0;
    const brake = down("brake");

    game.targetSpeed = brake ? 180 : usingNitro ? 560 : 340;
    game.speed += (game.targetSpeed - game.speed) * Math.min(1, delta * 2.8);
    game.player.x = clamp(game.player.x + steering * (0.42 + game.speed / 900) * delta, 0.1, 0.9);
    game.score += delta * game.speed * (usingNitro ? 0.22 : 0.16);
    game.roadOffset = (game.roadOffset + game.speed * delta) % 90;
    game.cityOffset = (game.cityOffset + game.speed * delta * 0.24) % 260;
    game.spawnTimer -= delta;

    if (usingNitro) {
      game.nitro = Math.max(0, game.nitro - 36 * delta);
      if (Math.random() > 0.58) burst(laneX(game.player.x), h() * game.player.y + 44, "#5dc8ff", 2);
    } else {
      game.nitro = Math.min(100, game.nitro + 12 * delta);
    }

    if (game.spawnTimer <= 0) {
      spawnTraffic();
      game.spawnTimer = clamp(0.86 - game.score / 8000, 0.32, 0.86);
    }

    for (const car of game.traffic) {
      car.y += ((game.speed * 0.62 + car.speed) * delta) / h();
      if (!car.passed && car.y > game.player.y + 0.1) {
        car.passed = true;
        game.score += 90;
        game.nitro = Math.min(100, game.nitro + 8);
      }
      if (overlap(game.player, car)) crash();
    }
    game.traffic = game.traffic.filter((car) => car.y < 1.18);
  }

  game.shake = Math.max(0, game.shake - delta * 42);
  for (const spark of game.sparks) {
    spark.life -= delta;
    spark.x += spark.vx * delta;
    spark.y += spark.vy * delta;
    spark.vy += 500 * delta;
  }
  game.sparks = game.sparks.filter((spark) => spark.life > 0);
  updateHud();
}

function updateHud() {
  scoreEl.textContent = Math.floor(game.score);
  speedEl.textContent = Math.floor(game.speed);
  nitroTextEl.textContent = `${Math.floor(game.nitro)}%`;
}

function draw() {
  ctx.clearRect(0, 0, w(), h());
  ctx.save();
  if (game.shake > 0) ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
  drawCity();
  drawRoad();
  for (const car of game.traffic) drawCar(car, false);
  drawCar(game.player, true);
  drawSparks();
  ctx.restore();
  drawOverlay();
}

function drawCity() {
  const sky = ctx.createLinearGradient(0, 0, 0, h());
  sky.addColorStop(0, "#1c2c42");
  sky.addColorStop(0.48, "#35465b");
  sky.addColorStop(1, "#161a20");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w(), h());

  for (let i = -2; i < 8; i += 1) {
    const x = i * 150 - game.cityOffset;
    const bh = 120 + ((i * 47) % 90);
    ctx.fillStyle = i % 2 ? "#1a2430" : "#243142";
    ctx.fillRect(x, h() * 0.2 - bh * 0.2, 105, bh);
    ctx.fillStyle = "rgba(243,199,96,0.38)";
    for (let wy = h() * 0.22; wy < h() * 0.44; wy += 24) {
      ctx.fillRect(x + 16, wy, 10, 10);
      ctx.fillRect(x + 48, wy, 10, 10);
      ctx.fillRect(x + 80, wy, 10, 10);
    }
  }
}

function drawRoad() {
  const left = roadLeft();
  const rw = roadWidth();
  const right = left + rw;
  ctx.fillStyle = "#171b20";
  ctx.fillRect(left, 0, rw, h());
  ctx.fillStyle = "#242a31";
  ctx.fillRect(left + 10, 0, rw - 20, h());

  ctx.fillStyle = "#e9edf0";
  ctx.fillRect(left + 10, 0, 5, h());
  ctx.fillRect(right - 15, 0, 5, h());

  ctx.strokeStyle = "#f3c760";
  ctx.lineWidth = 5;
  ctx.setLineDash([42, 48]);
  ctx.lineDashOffset = -game.roadOffset;
  ctx.beginPath();
  for (const split of [0.2, 0.4, 0.6, 0.8]) {
    ctx.moveTo(left + rw * split, -90);
    ctx.lineTo(left + rw * split, h() + 90);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawCar(car, player) {
  const x = laneX(car.x);
  const y = h() * car.y;
  const width = car.width;
  const height = car.height;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  roundRect(-width / 2 + 5, -height / 2 + 9, width, height, 8);
  ctx.fill();
  ctx.fillStyle = player ? "#f15d4e" : car.color;
  roundRect(-width / 2, -height / 2, width, height, 8);
  ctx.fill();
  ctx.fillStyle = "#101419";
  roundRect(-width * 0.31, -height * 0.28, width * 0.62, height * 0.23, 5);
  ctx.fill();
  roundRect(-width * 0.31, height * 0.08, width * 0.62, height * 0.24, 5);
  ctx.fill();
  ctx.fillStyle = "#090b0e";
  ctx.fillRect(-width / 2 - 3, -height * 0.3, 6, 18);
  ctx.fillRect(width / 2 - 3, -height * 0.3, 6, 18);
  ctx.fillRect(-width / 2 - 3, height * 0.2, 6, 18);
  ctx.fillRect(width / 2 - 3, height * 0.2, 6, 18);
  ctx.fillStyle = player && down("nitro") ? "#7de2ff" : "#fff1aa";
  ctx.fillRect(-width * 0.34, -height / 2 - 2, width * 0.2, 5);
  ctx.fillRect(width * 0.14, -height / 2 - 2, width * 0.2, 5);
  ctx.restore();
}

function drawSparks() {
  for (const spark of game.sparks) {
    ctx.globalAlpha = Math.max(0, spark.life);
    ctx.fillStyle = spark.color;
    ctx.fillRect(spark.x - 3, spark.y - 3, 6, 6);
  }
  ctx.globalAlpha = 1;
}

function drawOverlay() {
  if (game.state === "playing") return;
  ctx.fillStyle = "rgba(8,10,13,0.6)";
  ctx.fillRect(0, 0, w(), h());
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff6e7";
  ctx.font = `800 ${w() < 520 ? 28 : 42}px Microsoft YaHei, Arial`;
  ctx.fillText(game.state === "crashed" ? "撞车了" : "速度与激情", w() / 2, h() * 0.42);
  ctx.font = "16px Microsoft YaHei, Arial";
  ctx.fillStyle = "#dce7ef";
  ctx.fillText("方向键或 A/D 转向，空格/上键氮气，下键刹车", w() / 2, h() * 0.5);
}

function roundRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function bindButton(id, action) {
  const button = document.querySelector(id);
  const set = (value) => {
    touch[action] = value;
    if (value) start();
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    set(true);
  });
  button.addEventListener("pointerup", () => set(false));
  button.addEventListener("pointercancel", () => set(false));
  button.addEventListener("pointerleave", () => set(false));
}

function frame(now) {
  const delta = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  const map = {
    ArrowLeft: "left",
    a: "left",
    A: "left",
    ArrowRight: "right",
    d: "right",
    D: "right",
    ArrowDown: "brake",
    s: "brake",
    S: "brake",
    ArrowUp: "nitro",
    " ": "nitro",
    w: "nitro",
    W: "nitro",
  };
  if (map[event.key]) {
    event.preventDefault();
    keys.add(map[event.key]);
    start();
  }
});

window.addEventListener("keyup", (event) => {
  const values = {
    ArrowLeft: "left", a: "left", A: "left",
    ArrowRight: "right", d: "right", D: "right",
    ArrowDown: "brake", s: "brake", S: "brake",
    ArrowUp: "nitro", " ": "nitro", w: "nitro", W: "nitro",
  };
  if (values[event.key]) keys.delete(values[event.key]);
});

canvas.addEventListener("pointerdown", start);
restartBtn.addEventListener("click", restart);
resultDialog.addEventListener("close", () => {
  if (resultDialog.returnValue === "restart") restart();
});
window.addEventListener("resize", resizeCanvas);

bindButton("#leftBtn", "left");
bindButton("#rightBtn", "right");
bindButton("#brakeBtn", "brake");
bindButton("#nitroBtn", "nitro");

resizeCanvas();
restart();
syncCloudBestScore();
requestAnimationFrame(frame);
