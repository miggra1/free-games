const views = [
  { canvas: document.querySelector("#p1View"), focus: "p1", label: "红车视角" },
  { canvas: document.querySelector("#p2View"), focus: "p2", label: "蓝车视角" },
];

for (const view of views) {
  view.ctx = view.canvas.getContext("2d");
}

const p1ScoreEl = document.querySelector("#p1Score");
const p2ScoreEl = document.querySelector("#p2Score");
const p1NitroEl = document.querySelector("#p1Nitro");
const p2NitroEl = document.querySelector("#p2Nitro");
const raceStateEl = document.querySelector("#raceState");
const raceTimerEl = document.querySelector("#raceTimer");
const resultsDialog = document.querySelector("#results");
const resultTitleEl = document.querySelector("#resultTitle");
const resultP1El = document.querySelector("#resultP1");
const resultP2El = document.querySelector("#resultP2");
const resultP1HitsEl = document.querySelector("#resultP1Hits");
const resultP2HitsEl = document.querySelector("#resultP2Hits");
const restartBtn = document.querySelector("#restartBtn");

const keys = new Set();
const touch = {};

const gearSpeed = [0, 120, 185, 255, 335, 430];
const lanes = [-0.34, -0.16, 0, 0.17, 0.34];
const obstacleTypes = ["barrier", "cone", "barrel", "truck", "pothole", "oil", "rocks"];
const raceSeconds = 90;

let game;
let lastTime = 0;

function createDriver(id, name, color, laneX, controls) {
  return {
    id,
    name,
    color,
    laneX,
    width: 44,
    height: 74,
    gear: 1,
    speed: 0,
    distance: 0,
    nitro: 100,
    damage: 0,
    shiftCooldown: 0,
    hitCooldown: 0,
    crashCount: 0,
    laneKick: 0,
    usingNitro: false,
    controls,
  };
}

function createGame() {
  return {
    state: "ready",
    timeLeft: raceSeconds,
    roadOffset: 0,
    spawnTimer: 0.25,
    shake: 0,
    winner: "",
    obstacles: [],
    scenery: [],
    particles: [],
    collisionCooldown: 0,
    drivers: [
      createDriver("p1", "红车", "#e84f3d", -0.14, {
        left: ["a", "A"],
        right: ["d", "D"],
        up: ["e", "E"],
        down: ["q", "Q"],
        throttle: ["w", "W"],
        brake: ["s", "S"],
        nitro: ["f", "F"],
      }),
      createDriver("p2", "蓝车", "#43a5ef", 0.14, {
        left: ["ArrowLeft"],
        right: ["ArrowRight"],
        up: [".", ">"],
        down: [",", "<"],
        throttle: ["ArrowUp"],
        brake: ["ArrowDown"],
        nitro: ["Enter", "Shift"],
      }),
    ],
  };
}

function resizeCanvases() {
  for (const view of views) {
    const rect = view.canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    view.canvas.width = Math.round(rect.width * scale);
    view.canvas.height = Math.round(rect.height * scale);
    view.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    view.width = rect.width;
    view.height = rect.height;
  }
}

function viewWidth(view) {
  return view.width || view.canvas.clientWidth || 560;
}

function viewHeight(view) {
  return view.height || view.canvas.clientHeight || 620;
}

function roadWidth(view) {
  return Math.min(viewWidth(view) * 0.72, 430);
}

function roadLeft(view) {
  return (viewWidth(view) - roadWidth(view)) / 2;
}

function laneToX(view, laneX) {
  return roadLeft(view) + roadWidth(view) * (0.5 + laneX);
}

function driverY(view) {
  return viewHeight(view) * 0.84;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function inputDown(driver, action) {
  return driver.controls[action].some((key) => keys.has(key)) || touch[`${driver.id}-${action}`];
}

function restart() {
  if (resultsDialog.open) resultsDialog.close();
  game = createGame();
  raceStateEl.textContent = "准备发车";
  resizeCanvases();
  seedScenery();
  updateHud();
}

function startRace() {
  if (game.state === "finished") {
    restart();
    return;
  }
  if (game.state === "ready") {
    game.state = "racing";
    raceStateEl.textContent = "比赛中";
  }
}

function shift(driver, dir) {
  if (!driver || driver.shiftCooldown > 0 || game.state !== "racing") return;
  driver.gear = clamp(driver.gear + dir, 1, 5);
  driver.shiftCooldown = 0.2;
  burst(driver.laneX, 0.82, dir > 0 ? "#ffd166" : "#9bd7ff", 8);
}

function seedScenery() {
  game.scenery = [];
  for (let i = 0; i < 30; i += 1) {
    game.scenery.push(makeScenery(i * 74, i % 2 === 0 ? -1 : 1));
  }
}

function makeScenery(y, side) {
  const roll = Math.random();
  const kind = roll > 0.76 ? "house" : roll > 0.48 ? "tree" : roll > 0.24 ? "sign" : "rocks";
  return {
    kind,
    side,
    y,
    xOffset: 18 + Math.random() * 58,
    scale: 0.72 + Math.random() * 0.72,
  };
}

function spawnObstacle() {
  const amount = Math.random() > 0.72 ? 3 : Math.random() > 0.42 ? 2 : 1;
  const used = new Set();

  for (let i = 0; i < amount; i += 1) {
    const available = lanes.filter((lane) => !used.has(lane));
    const laneX = available[Math.floor(Math.random() * available.length)];
    used.add(laneX);
    const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    const sizes = {
      cone: [30, 34],
      barrel: [36, 44],
      barrier: [78, 38],
      truck: [58, 96],
      pothole: [64, 34],
      oil: [62, 38],
      rocks: [54, 40],
    };
    const [width, height] = sizes[type];
    game.obstacles.push({
      type,
      laneX,
      y: -height - 42 - i * 54,
      width,
      height,
      hitBy: new Set(),
    });
  }
}

function hitObstacle(driver, obstacle) {
  if (obstacle.hitBy.has(driver.id) || driver.hitCooldown > 0) return;
  obstacle.hitBy.add(driver.id);
  driver.hitCooldown = obstacle.type === "oil" ? 1 : 0.62;
  driver.damage = 0.7;
  driver.crashCount += 1;
  driver.speed *= obstacle.type === "truck" || obstacle.type === "barrier" ? 0.38 : 0.55;
  driver.gear = Math.max(1, driver.gear - 1);
  driver.laneKick = (driver.laneX < obstacle.laneX ? -1 : 1) * (obstacle.type === "oil" ? 0.38 : 0.22);
  game.shake = Math.max(game.shake, 12);
  burst(driver.laneX, 0.82, "#ffdf6e", 26);
  burst(driver.laneX, 0.82, driver.color, 14);
}

function hitCar(a, b) {
  if (game.collisionCooldown > 0) return;
  const laneGap = Math.abs(a.laneX - b.laneX);
  if (laneGap > 0.096) return;

  game.collisionCooldown = 0.55;
  game.shake = 16;
  a.crashCount += 1;
  b.crashCount += 1;
  a.damage = 0.62;
  b.damage = 0.62;
  const aWasLeft = a.laneX < b.laneX;
  a.laneKick = aWasLeft ? -0.42 : 0.42;
  b.laneKick = aWasLeft ? 0.42 : -0.42;
  const avg = (a.speed + b.speed) * 0.5;
  a.speed = Math.max(45, avg * 0.72);
  b.speed = Math.max(45, avg * 0.72);
  burst((a.laneX + b.laneX) / 2, 0.82, "#ffffff", 34);
  burst(a.laneX, 0.82, a.color, 14);
  burst(b.laneX, 0.82, b.color, 14);
}

function burst(laneX, screenRatioY, color, amount) {
  for (let i = 0; i < amount; i += 1) {
    game.particles.push({
      laneX,
      screenRatioY,
      xJitter: (Math.random() - 0.5) * 44,
      yJitter: (Math.random() - 0.5) * 36,
      vx: (Math.random() - 0.5) * 180,
      vy: (Math.random() - 0.8) * 190,
      life: 0.35 + Math.random() * 0.5,
      color,
    });
  }
}

function finishRace() {
  if (game.state !== "racing") return;
  game.state = "finished";
  const [p1, p2] = game.drivers;
  if (Math.floor(p1.distance) === Math.floor(p2.distance)) {
    game.winner = "平局";
  } else {
    game.winner = p1.distance > p2.distance ? "红车获胜" : "蓝车获胜";
  }
  raceStateEl.textContent = game.winner;
  showResults();
}

function showResults() {
  const [p1, p2] = game.drivers;
  resultTitleEl.textContent = game.winner;
  resultP1El.textContent = `${Math.floor(p1.distance)} m`;
  resultP2El.textContent = `${Math.floor(p2.distance)} m`;
  resultP1HitsEl.textContent = `${p1.crashCount} 次`;
  resultP2HitsEl.textContent = `${p2.crashCount} 次`;
  if (!resultsDialog.open) resultsDialog.showModal();
}

function update(delta) {
  if (!game) return;

  if (game.state === "racing") {
    game.timeLeft -= delta;
    if (game.timeLeft <= 0) {
      game.timeLeft = 0;
      finishRace();
    }

    const avgSpeed = game.drivers.reduce((sum, driver) => sum + driver.speed, 0) / game.drivers.length;
    game.roadOffset = (game.roadOffset + (avgSpeed + 190) * delta) % 92;
    game.spawnTimer -= delta;

    if (game.spawnTimer <= 0) {
      spawnObstacle();
      game.spawnTimer = clamp(0.86 - Math.max(...game.drivers.map((driver) => driver.distance)) / 7800, 0.28, 0.86);
    }

    for (const driver of game.drivers) updateDriver(driver, delta);
    hitCar(game.drivers[0], game.drivers[1]);

    const scroll = (avgSpeed + 225) * delta;
    for (const obstacle of game.obstacles) {
      obstacle.y += scroll;
      for (const driver of game.drivers) {
        if (Math.abs(driver.laneX - obstacle.laneX) < obstacle.width / 520 && Math.abs(obstacle.y - 0.84 * maxViewHeight()) < obstacle.height * 0.72) {
          hitObstacle(driver, obstacle);
        }
      }
    }
    game.obstacles = game.obstacles.filter((obstacle) => obstacle.y < maxViewHeight() + 120);

    for (const item of game.scenery) {
      item.y += scroll * 0.82;
      if (item.y > maxViewHeight() + 90) Object.assign(item, makeScenery(-90 - Math.random() * 110, item.side));
    }
  }

  game.collisionCooldown = Math.max(0, game.collisionCooldown - delta);
  game.shake = Math.max(0, game.shake - delta * 34);
  for (const particle of game.particles) {
    particle.life -= delta;
    particle.xJitter += particle.vx * delta;
    particle.yJitter += particle.vy * delta;
    particle.vy += 330 * delta;
  }
  game.particles = game.particles.filter((particle) => particle.life > 0);
  updateHud();
}

function updateDriver(driver, delta) {
  const steering = (inputDown(driver, "right") ? 1 : 0) - (inputDown(driver, "left") ? 1 : 0);
  const throttle = inputDown(driver, "throttle");
  const brake = inputDown(driver, "brake") ? 175 : 0;
  const wantsNitro = inputDown(driver, "nitro") && driver.nitro > 0 && throttle;
  const nitroBoost = wantsNitro ? 1.34 : 1;
  const target = gearSpeed[driver.gear] * (throttle ? 1 : 0.68) * nitroBoost;
  const accel = driver.speed < target ? 150 + driver.gear * 25 + (wantsNitro ? 115 : 0) : 220;

  driver.usingNitro = wantsNitro;
  driver.speed += Math.sign(target - driver.speed) * Math.min(Math.abs(target - driver.speed), accel * delta);
  driver.speed = Math.max(0, driver.speed - brake * delta);
  driver.shiftCooldown = Math.max(0, driver.shiftCooldown - delta);
  driver.hitCooldown = Math.max(0, driver.hitCooldown - delta);
  driver.damage = Math.max(0, driver.damage - delta);
  driver.distance += driver.speed * delta * 0.18;
  driver.laneX += (steering * (0.34 + driver.speed * 0.00045) + driver.laneKick) * delta;
  driver.laneKick *= Math.max(0, 1 - delta * 5.4);
  driver.laneX = clamp(driver.laneX, -0.42, 0.42);

  if (wantsNitro) {
    driver.nitro = Math.max(0, driver.nitro - 33 * delta);
    if (Math.random() > 0.62) burst(driver.laneX, 0.91, "#74d7ff", 2);
  } else {
    driver.nitro = Math.min(100, driver.nitro + (driver.speed > 220 ? 8 : 15) * delta);
  }
}

function maxViewHeight() {
  return Math.max(...views.map((view) => viewHeight(view)));
}

function updateHud() {
  const [p1, p2] = game.drivers;
  p1ScoreEl.textContent = `${Math.floor(p1.distance)} m · ${p1.gear}挡`;
  p2ScoreEl.textContent = `${Math.floor(p2.distance)} m · ${p2.gear}挡`;
  p1NitroEl.style.transform = `scaleX(${p1.nitro / 100})`;
  p2NitroEl.style.transform = `scaleX(${p2.nitro / 100})`;
  raceTimerEl.textContent = Math.ceil(game.timeLeft);
}

function draw() {
  for (const view of views) drawView(view);
}

function drawView(view) {
  const ctx = view.ctx;
  const width = viewWidth(view);
  const height = viewHeight(view);

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  if (game.shake > 0) {
    ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
  }
  drawScene(ctx, view);
  for (const obstacle of game.obstacles) drawObstacle(ctx, view, obstacle);
  for (const driver of game.drivers) drawCar(ctx, view, driver, driver.id === view.focus);
  drawParticles(ctx, view);
  ctx.restore();
  drawOverlay(ctx, view);
}

function drawScene(ctx, view) {
  const width = viewWidth(view);
  const height = viewHeight(view);
  const horizon = height * 0.25;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon + 70);
  sky.addColorStop(0, "#79b7d7");
  sky.addColorStop(1, "#d7e4d2");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  drawMountains(ctx, width, horizon);
  ctx.fillStyle = "#4d7e46";
  ctx.fillRect(0, horizon, width, height - horizon);
  for (const item of game.scenery) drawScenery(ctx, view, item, horizon);
  drawRoad(ctx, view);
}

function drawMountains(ctx, width, horizon) {
  ctx.fillStyle = "#57765f";
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= width; x += 84) {
    ctx.lineTo(x + 42, horizon - 65 - Math.sin(x * 0.018) * 24);
    ctx.lineTo(x + 84, horizon);
  }
  ctx.lineTo(width, horizon + 50);
  ctx.lineTo(0, horizon + 50);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  for (let x = 36; x < width; x += 168) {
    ctx.beginPath();
    ctx.moveTo(x, horizon - 68);
    ctx.lineTo(x + 20, horizon - 32);
    ctx.lineTo(x - 23, horizon - 34);
    ctx.closePath();
    ctx.fill();
  }
}

function drawRoad(ctx, view) {
  const left = roadLeft(view);
  const width = roadWidth(view);
  const right = left + width;
  const height = viewHeight(view);

  ctx.fillStyle = "#24292f";
  ctx.beginPath();
  ctx.moveTo(left + width * 0.09, 0);
  ctx.lineTo(right - width * 0.09, 0);
  ctx.lineTo(right, height);
  ctx.lineTo(left, height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#30363c";
  ctx.fillRect(left, 0, width, height);

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(left + 10, 0, 5, height);
  ctx.fillRect(right - 15, 0, 5, height);

  ctx.strokeStyle = "#f2d25f";
  ctx.lineWidth = 5;
  ctx.setLineDash([42, 50]);
  ctx.lineDashOffset = -game.roadOffset;
  ctx.beginPath();
  for (const split of [0.25, 0.5, 0.75]) {
    ctx.moveTo(left + width * split, -90);
    ctx.lineTo(left + width * split, height + 90);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#cfd3d0";
  for (let y = -40 + (game.roadOffset % 46); y < height; y += 46) {
    ctx.fillRect(left - 14, y, 12, 18);
    ctx.fillRect(right + 2, y, 12, 18);
  }
}

function drawScenery(ctx, view, item, horizon) {
  const sideX = item.side < 0 ? roadLeft(view) - item.xOffset : roadLeft(view) + roadWidth(view) + item.xOffset;
  const y = item.y + horizon * 0.25;
  const scale = item.scale;
  ctx.save();
  ctx.translate(sideX, y);
  ctx.scale(item.side, 1);

  if (item.kind === "tree") {
    ctx.fillStyle = "#5b3b24";
    ctx.fillRect(-5 * scale, -22 * scale, 10 * scale, 38 * scale);
    ctx.fillStyle = "#1f6f45";
    ctx.beginPath();
    ctx.arc(0, -34 * scale, 23 * scale, 0, Math.PI * 2);
    ctx.arc(-15 * scale, -23 * scale, 17 * scale, 0, Math.PI * 2);
    ctx.arc(16 * scale, -20 * scale, 17 * scale, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.kind === "house") {
    ctx.fillStyle = "#d8d0bb";
    ctx.fillRect(-28 * scale, -35 * scale, 56 * scale, 40 * scale);
    ctx.fillStyle = "#a64232";
    ctx.beginPath();
    ctx.moveTo(-34 * scale, -35 * scale);
    ctx.lineTo(0, -62 * scale);
    ctx.lineTo(34 * scale, -35 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#36566f";
    ctx.fillRect(-16 * scale, -22 * scale, 12 * scale, 12 * scale);
    ctx.fillRect(8 * scale, -22 * scale, 12 * scale, 12 * scale);
  } else if (item.kind === "rocks") {
    ctx.fillStyle = "#717a71";
    ctx.beginPath();
    ctx.ellipse(-10 * scale, -5 * scale, 18 * scale, 9 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(12 * scale, -3 * scale, 14 * scale, 8 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#dee5e5";
    ctx.fillRect(-3 * scale, -42 * scale, 6 * scale, 48 * scale);
    ctx.fillStyle = "#f0c94b";
    roundRect(ctx, -24 * scale, -62 * scale, 48 * scale, 22 * scale, 4 * scale);
    ctx.fill();
  }

  ctx.restore();
}

function drawCar(ctx, view, driver, focused) {
  const x = laneToX(view, driver.laneX);
  const y = driverY(view);
  const wobble = driver.damage > 0 ? Math.sin(performance.now() * 0.04) * 3 : 0;
  const scale = focused ? 1.05 : 0.92;

  ctx.save();
  ctx.translate(x + wobble, y);
  ctx.scale(scale, scale);

  ctx.fillStyle = "rgba(0,0,0,0.28)";
  roundRect(ctx, -driver.width / 2 + 5, -driver.height / 2 + 8, driver.width, driver.height, 8);
  ctx.fill();
  ctx.fillStyle = driver.color;
  roundRect(ctx, -driver.width / 2, -driver.height / 2, driver.width, driver.height, 8);
  ctx.fill();

  ctx.fillStyle = "#151a1e";
  roundRect(ctx, -driver.width * 0.31, -driver.height * 0.28, driver.width * 0.62, driver.height * 0.24, 5);
  ctx.fill();
  roundRect(ctx, -driver.width * 0.31, driver.height * 0.07, driver.width * 0.62, driver.height * 0.25, 5);
  ctx.fill();

  ctx.fillStyle = "#101214";
  ctx.fillRect(-driver.width / 2 - 3, -driver.height * 0.3, 6, 18);
  ctx.fillRect(driver.width / 2 - 3, -driver.height * 0.3, 6, 18);
  ctx.fillRect(-driver.width / 2 - 3, driver.height * 0.2, 6, 18);
  ctx.fillRect(driver.width / 2 - 3, driver.height * 0.2, 6, 18);

  ctx.fillStyle = driver.usingNitro ? "#8ee8ff" : "#fff1aa";
  ctx.fillRect(-driver.width * 0.34, -driver.height / 2 - 2, driver.width * 0.18, 5);
  ctx.fillRect(driver.width * 0.16, -driver.height / 2 - 2, driver.width * 0.18, 5);

  if (driver.usingNitro) {
    ctx.fillStyle = "rgba(83, 217, 255, 0.55)";
    ctx.beginPath();
    ctx.moveTo(-driver.width * 0.24, driver.height / 2);
    ctx.lineTo(0, driver.height / 2 + 42 + Math.random() * 18);
    ctx.lineTo(driver.width * 0.24, driver.height / 2);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 12px Microsoft YaHei, Arial";
  ctx.textAlign = "center";
  ctx.fillText(`${driver.gear}挡`, 0, 5);
  ctx.restore();
}

function drawObstacle(ctx, view, obstacle) {
  const x = laneToX(view, obstacle.laneX);
  const y = obstacle.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = obstacle.hitBy.size ? 0.52 : 1;

  if (obstacle.type === "cone") {
    ctx.fillStyle = "#ef713b";
    ctx.beginPath();
    ctx.moveTo(0, -obstacle.height / 2);
    ctx.lineTo(obstacle.width / 2, obstacle.height / 2);
    ctx.lineTo(-obstacle.width / 2, obstacle.height / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff3d2";
    ctx.fillRect(-obstacle.width * 0.32, 4, obstacle.width * 0.64, 5);
  } else if (obstacle.type === "barrel") {
    ctx.fillStyle = "#d64a32";
    roundRect(ctx, -obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height, 7);
    ctx.fill();
    ctx.fillStyle = "#ffd86b";
    ctx.fillRect(-obstacle.width / 2, -8, obstacle.width, 6);
    ctx.fillRect(-obstacle.width / 2, 10, obstacle.width, 6);
  } else if (obstacle.type === "truck") {
    ctx.fillStyle = "#b8c0c4";
    roundRect(ctx, -obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height, 6);
    ctx.fill();
    ctx.fillStyle = "#50606d";
    ctx.fillRect(-obstacle.width * 0.32, -obstacle.height * 0.38, obstacle.width * 0.64, 22);
  } else if (obstacle.type === "pothole") {
    ctx.fillStyle = "#15181a";
    ctx.beginPath();
    ctx.ellipse(0, 0, obstacle.width / 2, obstacle.height / 2, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#454b4d";
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (obstacle.type === "oil") {
    ctx.fillStyle = "rgba(16, 19, 22, 0.86)";
    ctx.beginPath();
    ctx.ellipse(0, 0, obstacle.width / 2, obstacle.height / 2, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(95, 170, 255, 0.32)";
    ctx.beginPath();
    ctx.ellipse(8, -4, obstacle.width / 4, obstacle.height / 5, -0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (obstacle.type === "rocks") {
    ctx.fillStyle = "#7d8178";
    ctx.beginPath();
    ctx.ellipse(-12, 5, 18, 12, -0.2, 0, Math.PI * 2);
    ctx.ellipse(11, -3, 20, 14, 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#f2ca55";
    roundRect(ctx, -obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height, 5);
    ctx.fill();
    ctx.strokeStyle = "#262a2d";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-obstacle.width * 0.35, obstacle.height * 0.25);
    ctx.lineTo(obstacle.width * 0.35, -obstacle.height * 0.25);
    ctx.stroke();
  }

  ctx.restore();
}

function drawParticles(ctx, view) {
  for (const particle of game.particles) {
    const x = laneToX(view, particle.laneX) + particle.xJitter;
    const y = viewHeight(view) * particle.screenRatioY + particle.yJitter;
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.fillStyle = particle.color;
    ctx.fillRect(x - 3, y - 3, 6, 6);
  }
  ctx.globalAlpha = 1;
}

function drawOverlay(ctx, view) {
  if (game.state === "racing") return;
  const width = viewWidth(view);
  const height = viewHeight(view);
  ctx.fillStyle = "rgba(10,13,16,0.62)";
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fffaf0";
  ctx.font = `700 ${width < 480 ? 22 : 30}px Microsoft YaHei, Arial`;
  ctx.fillText(game.state === "finished" ? game.winner : "双人分屏赛车", width / 2, height * (width < 480 ? 0.38 : 0.42));
  ctx.font = `${width < 480 ? 13 : 15}px Microsoft YaHei, Arial`;
  ctx.fillStyle = "#dce7e2";
  const lines = game.state === "finished" ? ["查看结算页，按空格再来一局"] : ["红车 F 氮气，蓝车 Enter 氮气", "撞车会弹开，障碍会掉速"];
  const lineHeight = width < 480 ? 20 : 23;
  const startY = height * (width < 480 ? 0.52 : 0.5) - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => ctx.fillText(line, width / 2, startY + index * lineHeight));
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function frame(now) {
  const delta = Math.min(0.035, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

function bindTouch(id, key) {
  const button = document.querySelector(id);
  const [driverId, action] = key.split("-");
  const set = (value) => {
    touch[key] = value;
    if (value) {
      startRace();
      if (action === "up" || action === "down") {
        const driver = game.drivers.find((item) => item.id === driverId);
        shift(driver, action === "up" ? 1 : -1);
      }
    }
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

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    if (game.state === "finished") restart();
    else startRace();
    return;
  }

  for (const driver of game.drivers) {
    if (driver.controls.up.includes(event.key)) {
      event.preventDefault();
      startRace();
      shift(driver, 1);
      return;
    }
    if (driver.controls.down.includes(event.key)) {
      event.preventDefault();
      startRace();
      shift(driver, -1);
      return;
    }
  }

  const allKeys = game.drivers.flatMap((driver) => [
    ...driver.controls.left,
    ...driver.controls.right,
    ...driver.controls.throttle,
    ...driver.controls.brake,
    ...driver.controls.nitro,
  ]);

  if (allKeys.includes(event.key)) {
    event.preventDefault();
    startRace();
    keys.add(event.key);
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

for (const view of views) {
  view.canvas.addEventListener("pointerdown", () => {
    if (game.state === "finished") restart();
    else startRace();
  });
}

resultsDialog.addEventListener("close", () => {
  if (resultsDialog.returnValue === "restart") restart();
});

restartBtn.addEventListener("click", () => {
  resultsDialog.returnValue = "restart";
});

window.addEventListener("resize", resizeCanvases);

bindTouch("#p1Left", "p1-left");
bindTouch("#p1Right", "p1-right");
bindTouch("#p1Up", "p1-up");
bindTouch("#p1Down", "p1-down");
bindTouch("#p1NitroBtn", "p1-nitro");
bindTouch("#p2Left", "p2-left");
bindTouch("#p2Right", "p2-right");
bindTouch("#p2Up", "p2-up");
bindTouch("#p2Down", "p2-down");
bindTouch("#p2NitroBtn", "p2-nitro");

restart();
requestAnimationFrame(frame);
