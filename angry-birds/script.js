const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const levelLabelEl = document.querySelector("#levelLabel");
const scoreEl = document.querySelector("#score");
const birdsLeftEl = document.querySelector("#birdsLeft");
const pigsLeftEl = document.querySelector("#pigsLeft");
const statusEl = document.querySelector("#status");
const resetBtn = document.querySelector("#resetBtn");
const resultDialog = document.querySelector("#resultDialog");
const resultMetaEl = document.querySelector("#resultMeta");
const resultTitleEl = document.querySelector("#resultTitle");
const resultTextEl = document.querySelector("#resultText");
const resultActionEl = document.querySelector("#resultAction");

const { Engine, World, Bodies, Body, Composite, Events } = Matter;

const engine = Engine.create();
engine.gravity.y = 1.05;

const sling = { x: 185, y: 435 };
const birdRadius = 23;
const maxPull = 120;
const launchPower = 0.18;
const birdColors = ["#e9493f", "#f3c860", "#4aa3f0", "#2f2f34", "#e96da6", "#ff7f50"];

const text = {
  ready: "\u62c9\u5f39\u5f13",
  aiming: "\u84c4\u529b\u4e2d",
  flying: "\u98de\u884c\u4e2d",
  waiting: "\u7b49\u5f85\u7ed3\u7b97",
  win: "\u80dc\u5229",
  lose: "\u8fd8\u5dee\u4e00\u70b9",
  complete: "\u5168\u90e8\u901a\u5173",
  next: "\u4e0b\u4e00\u5173",
  retry: "\u91cd\u73a9\u672c\u5173",
  restart: "\u518d\u73a9\u4e00\u8f6e",
};

const levels = [
  {
    name: "\u6728\u68da\u7ec3\u4e60",
    birds: 4,
    blocks: [
      [730, 542, 28, 126, "wood"], [820, 542, 28, 126, "wood"], [775, 474, 132, 24, "wood"],
      [775, 590, 150, 20, "stone"],
    ],
    pigs: [[775, 432, 23]],
  },
  {
    name: "\u53cc\u5854",
    birds: 4,
    blocks: [
      [710, 548, 26, 118, "wood"], [790, 548, 26, 118, "wood"], [750, 488, 118, 22, "wood"],
      [910, 548, 26, 118, "wood"], [990, 548, 26, 118, "wood"], [950, 488, 118, 22, "wood"],
      [850, 590, 360, 20, "stone"],
    ],
    pigs: [[750, 452, 22], [950, 452, 22]],
  },
  {
    name: "\u51b0\u6881",
    birds: 4,
    blocks: [
      [720, 548, 24, 120, "ice"], [810, 548, 24, 120, "ice"], [765, 482, 130, 22, "ice"],
      [900, 540, 30, 136, "wood"], [985, 540, 30, 136, "wood"], [942, 468, 118, 24, "wood"],
      [850, 590, 360, 20, "stone"],
    ],
    pigs: [[765, 446, 22], [942, 432, 22]],
  },
  {
    name: "\u77f3\u95e8",
    birds: 5,
    blocks: [
      [720, 536, 30, 148, "stone"], [830, 536, 30, 148, "stone"], [775, 456, 146, 24, "wood"],
      [775, 374, 116, 22, "wood"], [944, 550, 30, 110, "wood"], [1014, 550, 30, 110, "wood"],
      [979, 492, 110, 22, "ice"], [850, 590, 420, 20, "stone"],
    ],
    pigs: [[775, 420, 24], [775, 338, 21], [979, 456, 21]],
  },
  {
    name: "\u9ad8\u53f0",
    birds: 5,
    blocks: [
      [710, 560, 28, 92, "wood"], [780, 560, 28, 92, "wood"], [745, 510, 118, 22, "wood"],
      [860, 520, 28, 170, "stone"], [950, 520, 28, 170, "stone"], [905, 430, 132, 24, "wood"],
      [905, 348, 100, 22, "ice"], [818, 590, 390, 20, "stone"],
    ],
    pigs: [[745, 474, 22], [905, 394, 23], [905, 312, 20]],
  },
  {
    name: "\u4e09\u5c0f\u5c4b",
    birds: 5,
    blocks: [
      [660, 550, 24, 112, "wood"], [730, 550, 24, 112, "wood"], [695, 490, 104, 22, "wood"],
      [820, 550, 24, 112, "ice"], [890, 550, 24, 112, "ice"], [855, 490, 104, 22, "ice"],
      [980, 550, 24, 112, "wood"], [1050, 550, 24, 112, "wood"], [1015, 490, 104, 22, "wood"],
      [855, 592, 470, 18, "stone"],
    ],
    pigs: [[695, 454, 21], [855, 454, 21], [1015, 454, 21]],
  },
  {
    name: "\u659c\u5761\u57ce",
    birds: 5,
    blocks: [
      [700, 552, 28, 128, "wood"], [790, 540, 28, 152, "wood"], [745, 466, 130, 22, "wood"],
      [870, 522, 28, 188, "stone"], [960, 522, 28, 188, "stone"], [915, 424, 138, 24, "wood"],
      [828, 342, 26, 120, "ice"], [1000, 342, 26, 120, "ice"], [914, 280, 190, 22, "ice"],
      [850, 590, 450, 20, "stone"],
    ],
    pigs: [[745, 430, 22], [915, 388, 22], [914, 244, 21]],
  },
  {
    name: "\u77f3\u5934\u9635",
    birds: 6,
    blocks: [
      [690, 550, 34, 120, "stone"], [780, 550, 34, 120, "stone"], [735, 488, 134, 22, "wood"],
      [860, 550, 34, 120, "stone"], [950, 550, 34, 120, "stone"], [905, 488, 134, 22, "wood"],
      [820, 416, 32, 120, "wood"], [905, 416, 32, 120, "wood"], [862, 352, 132, 22, "ice"],
      [830, 592, 470, 18, "stone"],
    ],
    pigs: [[735, 452, 22], [905, 452, 22], [862, 316, 22]],
  },
  {
    name: "\u957f\u6865",
    birds: 6,
    blocks: [
      [640, 560, 24, 96, "wood"], [720, 560, 24, 96, "wood"], [680, 508, 128, 20, "ice"],
      [800, 560, 24, 96, "wood"], [880, 560, 24, 96, "wood"], [840, 508, 128, 20, "ice"],
      [960, 560, 24, 96, "wood"], [1040, 560, 24, 96, "wood"], [1000, 508, 128, 20, "ice"],
      [760, 438, 28, 104, "stone"], [920, 438, 28, 104, "stone"], [840, 380, 190, 22, "wood"],
      [850, 592, 520, 18, "stone"],
    ],
    pigs: [[680, 472, 20], [840, 472, 20], [1000, 472, 20], [840, 344, 22]],
  },
  {
    name: "\u738b\u51a0\u5821",
    birds: 6,
    blocks: [
      [675, 548, 28, 134, "wood"], [760, 548, 28, 134, "wood"], [718, 478, 126, 22, "wood"],
      [845, 540, 32, 150, "stone"], [940, 540, 32, 150, "stone"], [892, 462, 144, 24, "wood"],
      [1020, 548, 28, 134, "wood"], [1080, 548, 28, 134, "wood"], [1050, 478, 98, 22, "wood"],
      [810, 380, 28, 124, "ice"], [970, 380, 28, 124, "ice"], [890, 316, 190, 24, "stone"],
      [880, 592, 560, 20, "stone"],
    ],
    pigs: [[718, 442, 22], [892, 426, 24], [1050, 442, 21], [890, 280, 23]],
  },
];

let scale = 1;
let worldWidth = 1100;
let worldHeight = 640;
let currentLevel = 0;
let bird = null;
let dragging = false;
let launched = false;
let birdsLeft = 0;
let score = 0;
let statusText = text.ready;
let pigs = [];
let breakables = [];
let particles = [];
let settleTimer = 0;
let ended = false;
let damageEnabled = false;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  scale = Math.min(rect.width / worldWidth, rect.height / worldHeight);
  ctx.imageSmoothingEnabled = true;
}

function resetLevel() {
  World.clear(engine.world, false);
  Engine.clear(engine);
  engine.gravity.y = 1.05;
  pigs = [];
  breakables = [];
  particles = [];
  birdsLeft = levels[currentLevel].birds;
  score = 0;
  settleTimer = 0;
  ended = false;
  damageEnabled = false;
  dragging = false;
  launched = false;
  statusText = text.ready;
  if (resultDialog.open) resultDialog.close();
  buildLevel(levels[currentLevel]);
  spawnBird();
  updateHud();
}

function buildLevel(level) {
  const ground = Bodies.rectangle(550, 626, 1200, 54, { isStatic: true, label: "ground" });
  const leftWall = Bodies.rectangle(-25, 320, 50, 700, { isStatic: true });
  const rightWall = Bodies.rectangle(1125, 320, 50, 700, { isStatic: true });
  World.add(engine.world, [ground, leftWall, rightWall]);
  for (const block of level.blocks) addBlock(...block);
  for (const pig of level.pigs) addPig(...pig);
}

function addBlock(x, y, width, height, material) {
  const options = {
    label: "block",
    friction: 0.82,
    restitution: 0.08,
    density: material === "stone" ? 0.0044 : material === "ice" ? 0.0012 : 0.0023,
    plugin: { material, hp: material === "stone" ? 4 : material === "ice" ? 2 : 3 },
  };
  const body = Bodies.rectangle(x, y, width, height, options);
  body.renderData = { width, height, material };
  breakables.push(body);
  World.add(engine.world, body);
}

function addPig(x, y, radius) {
  const hp = radius >= 24 ? 3 : 2;
  const body = Bodies.circle(x, y, radius, {
    label: "pig",
    friction: 0.78,
    restitution: 0.18,
    density: 0.00145,
    plugin: { hp, maxHp: hp, alive: true, fallTimer: 0 },
  });
  pigs.push(body);
  World.add(engine.world, body);
}

function spawnBird() {
  if (birdsLeft <= 0) {
    statusText = text.waiting;
    return;
  }
  birdsLeft -= 1;
  launched = false;
  dragging = false;
  bird = Bodies.circle(sling.x, sling.y, birdRadius, {
    label: "bird",
    frictionAir: 0.012,
    restitution: 0.36,
    density: 0.004,
  });
  bird.color = birdColors[(levels[currentLevel].birds - birdsLeft - 1) % birdColors.length];
  Body.setStatic(bird, true);
  World.add(engine.world, bird);
  statusText = text.ready;
}

function updateHud() {
  levelLabelEl.textContent = `${currentLevel + 1} / ${levels.length}`;
  scoreEl.textContent = score;
  birdsLeftEl.textContent = birdsLeft + (bird && !launched ? 1 : 0);
  pigsLeftEl.textContent = pigs.filter((pig) => pig.plugin.alive).length;
  statusEl.textContent = statusText;
}

function screenToWorld(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / scale,
    y: (event.clientY - rect.top) / scale,
  };
}

function pointerDown(event) {
  if (!bird || launched || ended) return;
  const point = screenToWorld(event);
  const dx = point.x - bird.position.x;
  const dy = point.y - bird.position.y;
  if (Math.hypot(dx, dy) <= birdRadius * 1.9) {
    dragging = true;
    statusText = text.aiming;
    canvas.setPointerCapture(event.pointerId);
  }
}

function pointerMove(event) {
  if (!dragging || !bird) return;
  const point = screenToWorld(event);
  const dx = point.x - sling.x;
  const dy = point.y - sling.y;
  const distance = Math.min(maxPull, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  Body.setPosition(bird, {
    x: sling.x + Math.cos(angle) * distance,
    y: sling.y + Math.sin(angle) * distance,
  });
}

function pointerUp() {
  if (!dragging || !bird) return;
  dragging = false;
  launched = true;
  damageEnabled = true;
  Body.setStatic(bird, false);
  const { vx, vy } = getLaunchVelocity();
  Body.setVelocity(bird, { x: vx, y: vy });
  Body.setAngularVelocity(bird, vx * 0.015);
  statusText = text.flying;
}

function update(delta) {
  Engine.update(engine, delta * 1000);

  for (const particle of particles) {
    particle.life -= delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vy += 380 * delta;
  }
  particles = particles.filter((particle) => particle.life > 0);

  for (const pig of pigs) {
    if (!pig.plugin.alive || !damageEnabled) continue;
    if (pig.position.y > worldHeight + 190) pig.plugin.fallTimer += delta;
    else pig.plugin.fallTimer = 0;
    if (pig.plugin.fallTimer > 0.75 || pig.plugin.hp <= 0) knockPig(pig);
  }

  for (const block of breakables) {
    if (!block.isRemoved && block.plugin.hp <= 0) {
      block.isRemoved = true;
      burst(block.position.x, block.position.y, materialColor(block.renderData.material), 18);
      World.remove(engine.world, block);
      score += 80;
    }
  }

  if (launched && bird) {
    const slow = Math.hypot(bird.velocity.x, bird.velocity.y) < 0.2;
    const out = bird.position.x > worldWidth + 90 || bird.position.y > worldHeight + 110 || bird.position.x < -90;
    if (slow || out) settleTimer += delta;
    else settleTimer = 0;

    if (settleTimer > 1.05) {
      World.remove(engine.world, bird);
      bird = null;
      settleTimer = 0;
      if (pigs.every((pig) => !pig.plugin.alive)) endGame(true);
      else if (birdsLeft > 0) spawnBird();
      else endGame(false);
    }
  }

  if (!ended && pigs.every((pig) => !pig.plugin.alive)) endGame(true);
  updateHud();
}

function knockPig(pig) {
  pig.plugin.alive = false;
  score += 1000;
  burst(pig.position.x, pig.position.y, "#75cf72", 26);
  World.remove(engine.world, pig);
}

function endGame(won) {
  ended = true;
  statusText = won ? text.win : text.lose;
  score += won ? birdsLeft * 500 : 0;
  const last = currentLevel === levels.length - 1;
  resultMetaEl.textContent = `${currentLevel + 1} / ${levels.length} - ${levels[currentLevel].name}`;
  resultTitleEl.textContent = won ? (last ? text.complete : text.win) : text.lose;
  resultTextEl.textContent = won
    ? `\u5f97\u5206 ${score}\uff0c\u5269\u4f59\u5c0f\u9e1f ${birdsLeft}\u3002${last ? "\u5df2\u6253\u5b8c\u5168\u90e8\u5173\u5361\u3002" : "\u51c6\u5907\u8fdb\u5165\u4e0b\u4e00\u5173\u3002"}`
    : `\u5f97\u5206 ${score}\uff0c\u5269\u4f59\u76ee\u6807 ${pigs.filter((pig) => pig.plugin.alive).length}\u3002\u8c03\u6574\u89d2\u5ea6\u548c\u529b\u5ea6\u518d\u8bd5\u3002`;
  resultActionEl.value = won ? (last ? "restart" : "next") : "retry";
  resultActionEl.textContent = won ? (last ? text.restart : text.next) : text.retry;
  if (!resultDialog.open) resultDialog.showModal();
}

function burst(x, y, color, amount) {
  for (let i = 0; i < amount; i += 1) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 260,
      vy: (Math.random() - 0.75) * 240,
      life: 0.35 + Math.random() * 0.55,
      color,
    });
  }
}

Events.on(engine, "collisionStart", (event) => {
  if (!damageEnabled) return;
  for (const pair of event.pairs) {
    const bodies = [pair.bodyA, pair.bodyB];
    const speed = pair.bodyA.speed + pair.bodyB.speed;
    const birdHit = bodies.some((body) => body.label === "bird");
    for (const body of bodies) {
      if (body.label === "pig" && body.plugin.alive && speed > 3.35) {
        const damage = birdHit && speed > 5.4 ? 2 : speed > 6.8 ? 2 : 1;
        body.plugin.hp -= damage;
        burst(body.position.x, body.position.y, "#b9f28a", 7);
      }
      if (body.label === "block" && speed > 4.4) {
        body.plugin.hp -= speed > 7.4 ? 2 : 1;
      }
    }
  }
});

function draw() {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.save();
  ctx.scale(scale, scale);
  drawBackground();
  drawLevelName();
  drawSling();
  drawBodies();
  drawParticles();
  drawAim();
  ctx.restore();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, worldHeight);
  sky.addColorStop(0, "#86c7e3");
  sky.addColorStop(0.6, "#cfe7cc");
  sky.addColorStop(1, "#7fb95e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, worldWidth, worldHeight);

  ctx.fillStyle = "#5f8b59";
  ctx.beginPath();
  ctx.moveTo(0, 510);
  for (let x = 0; x <= worldWidth; x += 120) {
    ctx.lineTo(x + 60, 420 + Math.sin(x * 0.02) * 24);
    ctx.lineTo(x + 120, 510);
  }
  ctx.lineTo(worldWidth, worldHeight);
  ctx.lineTo(0, worldHeight);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#4a7a46";
  ctx.fillRect(0, 602, worldWidth, 38);
}

function drawLevelName() {
  ctx.fillStyle = "rgba(20, 35, 45, 0.35)";
  roundRect(18, 18, 250, 44, 8);
  ctx.fill();
  ctx.fillStyle = "#fff4df";
  ctx.font = "700 22px Microsoft YaHei, Arial";
  ctx.fillText(`${currentLevel + 1}. ${levels[currentLevel].name}`, 34, 48);
}

function drawSling() {
  ctx.lineWidth = 11;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#6b3b21";
  ctx.beginPath();
  ctx.moveTo(sling.x - 18, sling.y + 82);
  ctx.lineTo(sling.x - 7, sling.y - 6);
  ctx.moveTo(sling.x + 18, sling.y + 82);
  ctx.lineTo(sling.x + 9, sling.y - 4);
  ctx.stroke();

  if (bird && !launched) {
    ctx.strokeStyle = "#3d2a20";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(sling.x - 8, sling.y);
    ctx.lineTo(bird.position.x, bird.position.y);
    ctx.lineTo(sling.x + 10, sling.y);
    ctx.stroke();
  }
}

function drawAim() {
  if (!bird || !dragging) return;
  let { vx, vy } = getLaunchVelocity();
  let x = bird.position.x;
  let y = bird.position.y;
  const gravityPerTick = engine.gravity.y * engine.gravity.scale * (1000 / 60) ** 2;
  const air = 1 - bird.frictionAir;
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  for (let i = 1; i <= 18; i += 1) {
    for (let step = 0; step < 5; step += 1) {
      vx *= air;
      vy = vy * air + gravityPerTick;
      x += vx;
      y += vy;
    }
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, 5 - i * 0.16), 0, Math.PI * 2);
    ctx.fill();
  }
}

function getLaunchVelocity() {
  return {
    vx: (sling.x - bird.position.x) * launchPower,
    vy: (sling.y - bird.position.y) * launchPower,
  };
}

function drawBodies() {
  for (const body of Composite.allBodies(engine.world)) {
    if (body.label === "ground" || (body.isStatic && body.position.x < 0)) continue;
    if (body.label === "bird") drawBird(body);
    else if (body.label === "pig") drawPig(body);
    else if (body.label === "block") drawBlock(body);
  }
}

function drawBird(body) {
  const r = birdRadius;
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);
  ctx.fillStyle = body.color || "#e9493f";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff4df";
  ctx.beginPath();
  ctx.arc(6, -7, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#151515";
  ctx.beginPath();
  ctx.arc(8, -7, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f3c860";
  ctx.beginPath();
  ctx.moveTo(r - 2, 0);
  ctx.lineTo(r + 18, 7);
  ctx.lineTo(r - 2, 13);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#51211d";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-12, -17);
  ctx.lineTo(-2, -25);
  ctx.moveTo(-4, -18);
  ctx.lineTo(8, -25);
  ctx.stroke();
  ctx.restore();
}

function drawPig(body) {
  const r = body.circleRadius || 23;
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);
  ctx.fillStyle = "#75cf72";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#9ee694";
  ctx.beginPath();
  ctx.arc(0, 4, r * 0.44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#24321f";
  ctx.beginPath();
  ctx.arc(-8, -6, 3, 0, Math.PI * 2);
  ctx.arc(8, -6, 3, 0, Math.PI * 2);
  ctx.arc(-5, 4, 2, 0, Math.PI * 2);
  ctx.arc(5, 4, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBlock(body) {
  const { width, height, material } = body.renderData;
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);
  ctx.fillStyle = materialColor(material);
  roundRect(-width / 2, -height / 2, width, height, 5);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.24)";
  ctx.lineWidth = 3;
  ctx.stroke();
  if (material === "wood") {
    ctx.strokeStyle = "rgba(80, 45, 20, 0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-width / 2 + 6, 0);
    ctx.lineTo(width / 2 - 6, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles() {
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x - 3, particle.y - 3, 6, 6);
  }
  ctx.globalAlpha = 1;
}

function materialColor(material) {
  if (material === "stone") return "#8f9699";
  if (material === "ice") return "#9edaf2";
  return "#b9793f";
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

let lastTime = 0;
function frame(now) {
  const delta = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

canvas.addEventListener("pointerdown", pointerDown);
canvas.addEventListener("pointermove", pointerMove);
canvas.addEventListener("pointerup", pointerUp);
canvas.addEventListener("pointercancel", pointerUp);
resetBtn.addEventListener("click", resetLevel);
resultDialog.addEventListener("close", () => {
  const action = resultDialog.returnValue;
  if (action === "next") currentLevel = Math.min(currentLevel + 1, levels.length - 1);
  if (action === "restart") currentLevel = 0;
  resetLevel();
});
window.addEventListener("resize", resizeCanvas);

const requestedLevel = Number(new URLSearchParams(window.location.search).get("level"));
if (Number.isInteger(requestedLevel) && requestedLevel >= 1 && requestedLevel <= levels.length) {
  currentLevel = requestedLevel - 1;
}

resizeCanvas();
resetLevel();
requestAnimationFrame(frame);
