const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const hud = {
  p1Name: document.querySelector("#p1Name"),
  p2Name: document.querySelector("#p2Name"),
  timer: document.querySelector("#timer"),
  message: document.querySelector("#message"),
  p1Hp: document.querySelector("#p1Hp"),
  p2Hp: document.querySelector("#p2Hp"),
  p1Energy: document.querySelector("#p1Energy"),
  p2Energy: document.querySelector("#p2Energy"),
  p1Wins: document.querySelector("#p1Wins"),
  p2Wins: document.querySelector("#p2Wins"),
  restart: document.querySelector("#restartBtn"),
  selectScreen: document.querySelector("#selectScreen"),
  start: document.querySelector("#startBtn"),
};

const keys = new Set();
const keyTap = new Map();
const gravity = 2050;
const groundPad = 92;
const maxHp = 420;
const maxEnergy = 100;
const roundLength = 99;
const burstCost = 45;
const runAcceleration = 5600;
const airAcceleration = 3900;
const maxRunSpeed = 560;
const maxAirSpeed = 450;
const jumpVelocity = -820;

let game;
let lastTime = 0;
let selectedTypes = {
  p1: "warrior",
  p2: "mage",
};
const selectableTypes = ["warrior", "mage", "assassin", "guardian"];

const characterTypes = {
  warrior: {
    label: "战士",
    p1Name: "赤焰骑士",
    p2Name: "苍雷武士",
    maxHp,
    startEnergy: 35,
    palette: {
      main: "#d94a43",
      dark: "#632526",
      armor: "#c8ced6",
      trim: "#f0c86a",
      cape: "#8c252b",
      energy: "#ff8d47",
      hair: "#f1c15a",
      skin: "#f2c7a0",
      eye: "#ffd26a",
      cloth: "#1f2028",
      blade: "#fff0b8",
    },
  },
  mage: {
    label: "法师",
    p1Name: "绯星法师",
    p2Name: "霜月术士",
    maxHp: 330,
    startEnergy: 30,
    palette: {
      main: "#6957df",
      dark: "#26305b",
      armor: "#b8c7e6",
      trim: "#9df0ff",
      cape: "#3b2d72",
      energy: "#78e7ff",
      hair: "#f4f6ff",
      skin: "#efd0b0",
      eye: "#85fff1",
      cloth: "#17182a",
      blade: "#d9f8ff",
    },
  },
  assassin: {
    label: "刺客",
    p1Name: "影刃游侠",
    p2Name: "夜鸦忍者",
    maxHp: 350,
    startEnergy: 38,
    palette: {
      main: "#2fd3a6",
      dark: "#182a2d",
      armor: "#9fb8ba",
      trim: "#c4ff6a",
      cape: "#133c37",
      energy: "#7cffc8",
      hair: "#1b2028",
      skin: "#e8c3a4",
      eye: "#c4ff6a",
      cloth: "#101719",
      blade: "#e7fff4",
    },
  },
  guardian: {
    label: "守卫",
    p1Name: "玄铁守卫",
    p2Name: "金狮卫士",
    maxHp: 500,
    startEnergy: 24,
    palette: {
      main: "#8a6a3a",
      dark: "#2a2520",
      armor: "#d0c6aa",
      trim: "#f0c86a",
      cape: "#4d3525",
      energy: "#ffd36b",
      hair: "#463728",
      skin: "#e6bd93",
      eye: "#ffe79a",
      cloth: "#24201c",
      blade: "#fff1bd",
    },
  },
};

function w() {
  return canvas.w || canvas.clientWidth || 1100;
}

function h() {
  return canvas.h || canvas.clientHeight || 620;
}

function groundY() {
  return h() - groundPad;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  canvas.w = rect.width;
  canvas.h = rect.height;
  if (game) {
    for (const fighter of [game.p1, game.p2]) {
      fighter.y = Math.min(fighter.y, groundY());
      fighter.x = clamp(fighter.x, 42, w() - 42);
    }
  }
}

function createFighter(id, x, type, controls) {
  const data = characterTypes[type];
  const palette = {
    ...data.palette,
    ...(id === 2 && type === "warrior" ? {
      main: "#377cda",
      dark: "#1d345f",
      trim: "#7dd8ff",
      cape: "#203d73",
      energy: "#65d7ff",
      hair: "#dcecff",
      eye: "#70e7ff",
      cloth: "#171f34",
      blade: "#d9f8ff",
    } : {}),
    ...(id === 2 && type === "mage" ? {
      main: "#3f7df0",
      dark: "#1c315c",
      trim: "#a5ffcf",
      cape: "#183a68",
      energy: "#94ffc8",
      hair: "#bde9ff",
      eye: "#b7ff9c",
    } : {}),
    ...(id === 2 && type === "assassin" ? {
      main: "#9b6cff",
      dark: "#211b35",
      trim: "#ff7ad9",
      cape: "#2d214d",
      energy: "#ff8be8",
      hair: "#ede1ff",
      eye: "#ffb1ec",
      blade: "#fff0fb",
    } : {}),
    ...(id === 2 && type === "guardian" ? {
      main: "#6e88a8",
      dark: "#1f2730",
      trim: "#9de0ff",
      cape: "#253a50",
      energy: "#9de0ff",
      hair: "#cbd6e2",
      eye: "#b8efff",
      blade: "#e9fbff",
    } : {}),
  };

  return {
    id,
    type,
    name: id === 1 ? data.p1Name : data.p2Name,
    x,
    y: groundY(),
    vx: 0,
    vy: 0,
    width: 56,
    height: 132,
    facing: id === 1 ? 1 : -1,
    maxHp: data.maxHp,
    hp: data.maxHp,
    energy: data.startEnergy,
    wins: 0,
    comboStep: 0,
    comboTimer: 0,
    action: "idle",
    actionTime: 0,
    actionDuration: 0,
    hitDone: false,
    hitStun: 0,
    blockTime: 0,
    dashTime: 0,
    burstTime: 0,
    invincible: 0,
    airJumps: 1,
    attackQueue: null,
    skillQueue: null,
    lastHitAt: -10,
    comboCount: 0,
    receivedCombo: 0,
    palette,
    controls,
  };
}

function newMatch(keepWins = false) {
  const oldP1Wins = keepWins && game ? game.p1.wins : 0;
  const oldP2Wins = keepWins && game ? game.p2.wins : 0;
  game = {
    state: "ready",
    time: 0,
    roundTime: roundLength,
    flash: 0,
    shake: 0,
    winner: null,
    projectiles: [],
    slashes: [],
    sparks: [],
    p1: createFighter(1, w() * 0.24, selectedTypes.p1, {
      left: "KeyA",
      right: "KeyD",
      up: "KeyW",
      down: "KeyS",
      light: "KeyJ",
      heavy: "KeyK",
      skill: "KeyL",
      dash: "KeyU",
      ultimate: "KeyI",
    }),
    p2: createFighter(2, w() * 0.76, selectedTypes.p2, {
      left: "ArrowLeft",
      right: "ArrowRight",
      up: "ArrowUp",
      down: "ArrowDown",
      light: "Numpad1",
      heavy: "Numpad2",
      skill: "Numpad3",
      dash: "Numpad4",
      ultimate: "Numpad5",
      altLight: "Digit1",
      altHeavy: "Digit2",
      altSkill: "Digit3",
      altDash: "Digit4",
      altUltimate: "Digit5",
    }),
  };
  game.p1.wins = oldP1Wins;
  game.p2.wins = oldP2Wins;
  faceEachOther();
  updateHud();
}

function faceEachOther() {
  game.p1.facing = game.p1.x <= game.p2.x ? 1 : -1;
  game.p2.facing = game.p2.x <= game.p1.x ? 1 : -1;
}

function tapPressed(code, altCode) {
  return keyTap.get(code) || (altCode && keyTap.get(altCode));
}

function held(code, altCode) {
  return keys.has(code) || (altCode && keys.has(altCode));
}

function canCancel(fighter) {
  if (["idle", "run", "jump", "fall"].includes(fighter.action)) return true;
  if (fighter.action === "dash") return fighter.actionTime > 0.05;
  if (fighter.action === "attack") return fighter.hitDone && fighter.actionTime > 0.08;
  if (fighter.action === "skill") return fighter.hitDone && fighter.actionTime > 0.16;
  return false;
}

function startAction(fighter, action, duration) {
  fighter.action = action;
  fighter.actionTime = 0;
  fighter.actionDuration = duration;
  fighter.hitDone = false;
}

function queueInputs(fighter) {
  const c = fighter.controls;
  if (tapPressed(c.light, c.altLight)) fighter.attackQueue = "light";
  if (tapPressed(c.heavy, c.altHeavy)) fighter.attackQueue = "heavy";
  if (tapPressed(c.skill, c.altSkill)) fighter.skillQueue = "skill";
  if (tapPressed(c.ultimate, c.altUltimate)) fighter.skillQueue = "ultimate";
}

function handleActions(fighter, opponent) {
  const c = fighter.controls;
  const grounded = fighter.y >= groundY() - 0.1;

  if (fighter.hitStun > 0 && tapPressed(c.dash, c.altDash) && fighter.energy >= burstCost) {
    burstEscape(fighter, opponent);
    return;
  }

  if (fighter.hitStun > 0 || game.state !== "playing") return;

  if (held(c.down)) {
    if (!["attack", "skill", "ultimate", "dash"].includes(fighter.action)) {
      fighter.action = "block";
      fighter.blockTime = 0.1;
    }
  } else if (fighter.action === "block") {
    fighter.action = grounded ? "idle" : "fall";
  }

  if (tapPressed(c.up) && (grounded || fighter.airJumps > 0)) {
    if (!grounded) fighter.airJumps -= 1;
    fighter.vy = jumpVelocity;
    fighter.action = "jump";
  }

  if (tapPressed(c.dash, c.altDash) && fighter.energy >= 8 && fighter.dashTime <= 0) {
    fighter.energy -= 8;
    fighter.dashTime = 0.14;
    fighter.invincible = 0.12;
    startAction(fighter, "dash", 0.16);
    addSlash(fighter.x - fighter.facing * 18, fighter.y - 64, fighter.facing, fighter.palette.energy, 0.18, 80);
  }

  if (fighter.skillQueue === "ultimate" && fighter.energy >= 100 && canCancel(fighter)) {
    fighter.energy = 0;
    fighter.skillQueue = null;
    fighter.attackQueue = null;
    startAction(fighter, "ultimate", 0.58);
    fighter.vx *= 0.2;
    return;
  }

  if (fighter.skillQueue === "skill" && fighter.energy >= 28 && canCancel(fighter)) {
    fighter.energy -= 28;
    fighter.skillQueue = null;
    fighter.attackQueue = null;
    startAction(fighter, "skill", 0.34);
    fighter.vx = fighter.facing * 390;
    return;
  }

  if (fighter.attackQueue && canCancel(fighter)) {
    const type = fighter.attackQueue;
    fighter.attackQueue = null;
    if (fighter.comboTimer > 0 && type === "light") {
      fighter.comboStep = Math.min(3, fighter.comboStep + 1);
    } else if (type === "heavy") {
      fighter.comboStep = 4;
    } else {
      fighter.comboStep = 1;
    }
    fighter.comboTimer = 0.92;
    let attackDurations = { 1: 0.22, 2: 0.24, 3: 0.28, 4: 0.34 };
    if (fighter.type === "assassin") attackDurations = { 1: 0.18, 2: 0.2, 3: 0.23, 4: 0.28 };
    if (fighter.type === "guardian") attackDurations = { 1: 0.3, 2: 0.34, 3: 0.38, 4: 0.46 };
    startAction(fighter, "attack", attackDurations[fighter.comboStep]);
    const lungeScale = fighter.type === "assassin" ? 1.25 : fighter.type === "guardian" ? 0.72 : 1;
    fighter.vx = fighter.facing * (fighter.comboStep === 4 ? 360 : 220 + fighter.comboStep * 70) * lungeScale;
  }

  if (fighter.action === "attack") performAttack(fighter, opponent);
  if (fighter.action === "skill") performSkill(fighter, opponent);
  if (fighter.action === "ultimate") performUltimate(fighter, opponent);
}

function burstEscape(fighter, opponent) {
  fighter.energy -= burstCost;
  fighter.hitStun = 0;
  fighter.invincible = 0.52;
  fighter.burstTime = 0.34;
  fighter.action = "dash";
  fighter.actionTime = 0;
  fighter.actionDuration = 0.24;
  fighter.attackQueue = null;
  fighter.skillQueue = null;
  fighter.receivedCombo = 0;
  fighter.vx = -fighter.facing * 760;
  fighter.vy = -310;

  opponent.vx = fighter.facing * 520;
  opponent.vy = Math.min(opponent.vy, -180);
  opponent.hitStun = Math.max(opponent.hitStun, 0.16);
  opponent.comboCount = 0;
  game.shake = 12;
  game.flash = 0.12;
  addSlash(fighter.x, fighter.y - 74, -fighter.facing, fighter.palette.energy, 0.28, 120);
  addSparks(fighter.x, fighter.y - 76, fighter.palette.energy, 34);
}

function performAttack(fighter, opponent) {
  if (fighter.type === "assassin") {
    performAssassinAttack(fighter, opponent);
    return;
  }

  if (fighter.type === "guardian") {
    performGuardianAttack(fighter, opponent);
    return;
  }

  if (fighter.type === "mage") {
    performMageAttack(fighter, opponent);
    return;
  }

  const step = fighter.comboStep;
  const hitFrame = step === 4 ? 0.14 : 0.055 + step * 0.018;
  if (fighter.hitDone || fighter.actionTime < hitFrame) return;
  fighter.hitDone = true;

  const range = step === 4 ? 150 : 100 + step * 18;
  const height = step === 3 ? 118 : 92;
  const damage = step === 4 ? 28 : 12 + step * 5;
  const knock = step === 4 ? 460 : 150 + step * 48;
  const lift = step === 1 ? -80 : step === 2 ? -150 : step === 3 ? -360 : -210;

  addSlash(fighter.x + fighter.facing * (range * 0.48), fighter.y - 70, fighter.facing, fighter.palette.trim, 0.18, range);
  tryHit(fighter, opponent, {
    x: fighter.x + fighter.facing * (range * 0.5),
    y: fighter.y - 72,
    width: range,
    height,
    damage,
    knock,
    lift,
    stun: 0.22 + step * 0.04,
    type: "strike",
  });
}

function performSkill(fighter, opponent) {
  if (fighter.type === "assassin") {
    performAssassinSkill(fighter, opponent);
    return;
  }

  if (fighter.type === "guardian") {
    performGuardianSkill(fighter, opponent);
    return;
  }

  if (fighter.type === "mage") {
    performMageSkill(fighter, opponent);
    return;
  }

  if (fighter.hitDone || fighter.actionTime < 0.12) return;
  fighter.hitDone = true;
  addSlash(fighter.x + fighter.facing * 74, fighter.y - 78, fighter.facing, fighter.palette.energy, 0.32, 150);
  game.projectiles.push({
    owner: fighter.id,
    x: fighter.x + fighter.facing * 72,
    y: fighter.y - 78,
    vx: fighter.facing * 860,
    radius: 18,
    life: 0.78,
    color: fighter.palette.energy,
    damage: 28,
  });
  tryHit(fighter, opponent, {
    x: fighter.x + fighter.facing * 72,
    y: fighter.y - 78,
    width: 130,
    height: 86,
    damage: 24,
    knock: 470,
    lift: -220,
    stun: 0.34,
    type: "skill",
  });
}

function performUltimate(fighter, opponent) {
  if (fighter.type === "assassin") {
    performAssassinUltimate(fighter, opponent);
    return;
  }

  if (fighter.type === "guardian") {
    performGuardianUltimate(fighter, opponent);
    return;
  }

  if (fighter.type === "mage") {
    performMageUltimate(fighter, opponent);
    return;
  }

  if (fighter.actionTime > 0.05 && fighter.actionTime < 0.52 && Math.floor(fighter.actionTime * 34) % 2 === 0) {
    addSlash(
      fighter.x + fighter.facing * (80 + Math.random() * 110),
      fighter.y - 58 - Math.random() * 86,
      fighter.facing,
      fighter.palette.energy,
      0.2,
      170
    );
  }

  if (fighter.hitDone || fighter.actionTime < 0.27) return;
  fighter.hitDone = true;
  game.flash = 0.22;
  game.shake = 16;
  tryHit(fighter, opponent, {
    x: fighter.x + fighter.facing * 150,
    y: fighter.y - 86,
    width: 310,
    height: 170,
    damage: 72,
    knock: 720,
    lift: -420,
    stun: 0.52,
    type: "ultimate",
  });
}

function performMageAttack(fighter, opponent) {
  const step = fighter.comboStep;
  const hitFrame = step === 4 ? 0.2 : 0.08 + step * 0.025;
  if (fighter.hitDone || fighter.actionTime < hitFrame) return;
  fighter.hitDone = true;

  if (step === 1) {
    addSlash(fighter.x + fighter.facing * 58, fighter.y - 84, fighter.facing, fighter.palette.energy, 0.16, 78);
    tryHit(fighter, opponent, {
      x: fighter.x + fighter.facing * 58,
      y: fighter.y - 82,
      width: 74,
      height: 74,
      damage: 9,
      knock: 85,
      lift: -45,
      stun: 0.16,
      type: "magic",
    });
    return;
  }

  if (step === 2) {
    spawnMagicBolt(fighter, 520, 0.58, 10, 150, -70, 0.18, 11);
    addSlash(fighter.x + fighter.facing * 40, fighter.y - 92, fighter.facing, fighter.palette.energy, 0.18, 90);
    return;
  }

  if (step === 3) {
    const sigilX = fighter.x + fighter.facing * 145;
    addMagicCircle(sigilX, groundY() - 28, fighter.palette.energy, 0.3, 58);
    tryHit(fighter, opponent, {
      x: sigilX,
      y: groundY() - 74,
      width: 86,
      height: 108,
      damage: 14,
      knock: 120,
      lift: -210,
      stun: 0.22,
      type: "magic",
    });
    return;
  }

  addMagicCircle(fighter.x + fighter.facing * 165, opponent.y - 70, fighter.palette.energy, 0.36, 82);
  tryHit(fighter, opponent, {
    x: fighter.x + fighter.facing * 165,
    y: opponent.y - 76,
    width: 112,
    height: 122,
    damage: 22,
    knock: 240,
    lift: -150,
    stun: 0.26,
    type: "magic",
  });
}

function performMageSkill(fighter, opponent) {
  if (fighter.hitDone || fighter.actionTime < 0.18) return;
  fighter.hitDone = true;
  fighter.vx = -fighter.facing * 80;
  for (let i = 0; i < 2; i += 1) {
    game.projectiles.push({
      owner: fighter.id,
      x: fighter.x + fighter.facing * (42 + i * 8),
      y: fighter.y - 112 + i * 22,
      vx: fighter.facing * (430 + i * 70),
      vy: (i - 0.5) * 28,
      radius: 10,
      life: 0.68,
      color: fighter.palette.energy,
      damage: 9,
      knock: 160,
      lift: -80,
      stun: 0.18,
      type: "magic",
    });
  }
  addMagicCircle(fighter.x + fighter.facing * 54, fighter.y - 90, fighter.palette.energy, 0.24, 58);
}

function performMageUltimate(fighter, opponent) {
  if (fighter.actionTime > 0.05 && fighter.actionTime < 0.5 && Math.floor(fighter.actionTime * 16) % 2 === 0) {
    addMagicCircle(opponent.x + (Math.random() - 0.5) * 130, opponent.y - 70 + (Math.random() - 0.5) * 80, fighter.palette.energy, 0.18, 54);
  }

  if (fighter.hitDone || fighter.actionTime < 0.38) return;
  fighter.hitDone = true;
  game.flash = 0.18;
  game.shake = 13;
  addMagicCircle(opponent.x, opponent.y - 82, fighter.palette.energy, 0.48, 145);
  tryHit(fighter, opponent, {
    x: opponent.x,
    y: opponent.y - 82,
    width: 190,
    height: 190,
    damage: 48,
    knock: 390,
    lift: -260,
    stun: 0.38,
    type: "ultimate",
  });
}

function spawnMagicBolt(fighter, speed, life, damage, knock, lift, stun, radius) {
  game.projectiles.push({
    owner: fighter.id,
    x: fighter.x + fighter.facing * 62,
    y: fighter.y - 92,
    vx: fighter.facing * speed,
    vy: -18,
    radius,
    life,
    color: fighter.palette.energy,
    damage,
    knock,
    lift,
    stun,
    type: "magic",
  });
}

function performAssassinAttack(fighter, opponent) {
  const step = fighter.comboStep;
  const hitFrame = step === 4 ? 0.12 : 0.045 + step * 0.015;
  if (fighter.hitDone || fighter.actionTime < hitFrame) return;
  fighter.hitDone = true;

  const backstab = Math.sign(opponent.x - fighter.x) !== opponent.facing;
  const range = step === 4 ? 122 : 82 + step * 18;
  const damage = (step === 4 ? 30 : 10 + step * 5) + (backstab ? 6 : 0);
  const knock = step === 4 ? 520 : 170 + step * 58;
  const lift = step === 3 ? -310 : step === 4 ? -170 : -70;
  fighter.vx = fighter.facing * (step === 4 ? 440 : 300);

  addSlash(fighter.x + fighter.facing * (range * 0.46), fighter.y - 78, fighter.facing, fighter.palette.energy, 0.14, range);
  tryHit(fighter, opponent, {
    x: fighter.x + fighter.facing * (range * 0.5),
    y: fighter.y - 78,
    width: range,
    height: 88,
    damage,
    knock,
    lift,
    stun: 0.19 + step * 0.035,
    type: "strike",
  });
}

function performAssassinSkill(fighter, opponent) {
  if (fighter.hitDone || fighter.actionTime < 0.08) return;
  fighter.hitDone = true;
  fighter.invincible = Math.max(fighter.invincible, 0.16);
  fighter.x = clamp(fighter.x + fighter.facing * 92, 42, w() - 42);
  fighter.vx = fighter.facing * 620;
  addSlash(fighter.x + fighter.facing * 55, fighter.y - 78, fighter.facing, fighter.palette.energy, 0.18, 132);
  tryHit(fighter, opponent, {
    x: fighter.x + fighter.facing * 68,
    y: fighter.y - 78,
    width: 142,
    height: 96,
    damage: 24,
    knock: 360,
    lift: -160,
    stun: 0.28,
    type: "skill",
  });
}

function performAssassinUltimate(fighter, opponent) {
  if (fighter.actionTime > 0.05 && fighter.actionTime < 0.48 && Math.floor(fighter.actionTime * 32) % 2 === 0) {
    addSlash(opponent.x + (Math.random() - 0.5) * 120, opponent.y - 70 + (Math.random() - 0.5) * 80, fighter.facing, fighter.palette.energy, 0.13, 92);
  }
  if (fighter.hitDone || fighter.actionTime < 0.24) return;
  fighter.hitDone = true;
  fighter.x = clamp(opponent.x - fighter.facing * 70, 42, w() - 42);
  game.shake = 13;
  game.flash = 0.13;
  tryHit(fighter, opponent, {
    x: opponent.x,
    y: opponent.y - 78,
    width: 178,
    height: 150,
    damage: 56,
    knock: 650,
    lift: -310,
    stun: 0.46,
    type: "ultimate",
  });
}

function performGuardianAttack(fighter, opponent) {
  const step = fighter.comboStep;
  const hitFrame = step === 4 ? 0.22 : 0.1 + step * 0.03;
  if (fighter.hitDone || fighter.actionTime < hitFrame) return;
  fighter.hitDone = true;

  const range = step === 4 ? 150 : 92 + step * 14;
  const damage = step === 4 ? 38 : 16 + step * 5;
  const knock = step === 4 ? 680 : 250 + step * 72;
  const lift = step === 3 ? -230 : step === 4 ? -120 : -40;
  addSlash(fighter.x + fighter.facing * (range * 0.5), fighter.y - 66, fighter.facing, fighter.palette.trim, 0.22, range);
  tryHit(fighter, opponent, {
    x: fighter.x + fighter.facing * (range * 0.48),
    y: fighter.y - 68,
    width: range,
    height: 104,
    damage,
    knock,
    lift,
    stun: 0.24 + step * 0.04,
    type: "strike",
  });
}

function performGuardianSkill(fighter, opponent) {
  if (fighter.hitDone || fighter.actionTime < 0.18) return;
  fighter.hitDone = true;
  fighter.invincible = Math.max(fighter.invincible, 0.2);
  fighter.vx = fighter.facing * 520;
  addMagicCircle(fighter.x + fighter.facing * 80, groundY() - 22, fighter.palette.energy, 0.28, 86);
  tryHit(fighter, opponent, {
    x: fighter.x + fighter.facing * 82,
    y: groundY() - 68,
    width: 150,
    height: 126,
    damage: 26,
    knock: 540,
    lift: -120,
    stun: 0.31,
    type: "skill",
  });
}

function performGuardianUltimate(fighter, opponent) {
  if (fighter.actionTime > 0.08 && fighter.actionTime < 0.58 && Math.floor(fighter.actionTime * 18) % 2 === 0) {
    addMagicCircle(fighter.x + fighter.facing * (80 + Math.random() * 90), groundY() - 24, fighter.palette.energy, 0.18, 76);
  }
  if (fighter.hitDone || fighter.actionTime < 0.42) return;
  fighter.hitDone = true;
  game.flash = 0.18;
  game.shake = 18;
  addMagicCircle(fighter.x + fighter.facing * 140, groundY() - 28, fighter.palette.energy, 0.5, 170);
  tryHit(fighter, opponent, {
    x: fighter.x + fighter.facing * 140,
    y: groundY() - 86,
    width: 260,
    height: 170,
    damage: 68,
    knock: 820,
    lift: -260,
    stun: 0.48,
    type: "ultimate",
  });
}

function hitBoxOverlapsFighter(box, fighter) {
  const left = fighter.x - fighter.width / 2;
  const top = fighter.y - fighter.height;
  return box.x - box.width / 2 < left + fighter.width &&
    box.x + box.width / 2 > left &&
    box.y - box.height / 2 < top + fighter.height &&
    box.y + box.height / 2 > top;
}

function isBlocking(target, attacker) {
  return target.action === "block" && target.facing === -attacker.facing;
}

function tryHit(attacker, target, hit) {
  if (!hitBoxOverlapsFighter(hit, target) || target.invincible > 0) return false;

  const blocked = isBlocking(target, attacker);
  const comboScale = blocked ? 1 : Math.max(0.55, 1 - target.receivedCombo * 0.08);
  const damage = blocked ? Math.ceil(hit.damage * 0.18) : Math.ceil(hit.damage * comboScale);
  target.hp = Math.max(0, target.hp - damage);
  target.receivedCombo = blocked ? 0 : target.receivedCombo + 1;
  target.hitStun = blocked ? 0.1 : Math.max(0.14, hit.stun - target.receivedCombo * 0.018);
  target.vx = attacker.facing * (blocked ? hit.knock * 0.15 : hit.knock * Math.max(0.7, comboScale));
  target.vy = blocked ? Math.min(target.vy, -70) : hit.lift * Math.max(0.72, comboScale);
  target.action = blocked ? "block" : "hit";
  target.invincible = 0.05;

  attacker.energy = clamp(attacker.energy + (blocked ? 2 : 5), 0, maxEnergy);
  target.energy = clamp(target.energy + (blocked ? 4 : 8), 0, maxEnergy);
  if (!blocked) {
    attacker.vx = attacker.facing * Math.max(Math.abs(attacker.vx), 170);
    if (target.y < groundY() - 4) attacker.vy = Math.min(attacker.vy, -170);
  }
  registerCombo(attacker);
  game.shake = hit.type === "ultimate" ? 18 : blocked ? 4 : 8;
  addSparks(target.x, target.y - 76, blocked ? "#d8e2ef" : attacker.palette.energy, blocked ? 12 : 24);

  if (target.hp <= 0) finishRound(attacker);
  return true;
}

function registerCombo(attacker) {
  if (game.time - attacker.lastHitAt < 1.1) {
    attacker.comboCount += 1;
  } else {
    attacker.comboCount = 1;
  }
  attacker.lastHitAt = game.time;
}

function finishRound(winner) {
  if (game.state !== "playing") return;
  winner.wins += 1;
  game.winner = winner;
  game.state = winner.wins >= 2 ? "matchOver" : "roundOver";
  game.endTimer = game.state === "matchOver" ? 999 : 1.65;
  game.flash = 0.28;
}

function updateFighter(fighter, opponent, delta) {
  queueInputs(fighter);
  fighter.comboTimer = Math.max(0, fighter.comboTimer - delta);
  fighter.hitStun = Math.max(0, fighter.hitStun - delta);
  fighter.invincible = Math.max(0, fighter.invincible - delta);
  fighter.dashTime = Math.max(0, fighter.dashTime - delta);
  fighter.burstTime = Math.max(0, fighter.burstTime - delta);
  fighter.blockTime = Math.max(0, fighter.blockTime - delta);
  fighter.actionTime += delta;

  const grounded = fighter.y >= groundY() - 0.1;
  const c = fighter.controls;
  const left = held(c.left);
  const right = held(c.right);
  const move = (right ? 1 : 0) - (left ? 1 : 0);

  if (game.state === "playing" && fighter.hitStun <= 0) {
    if (!["attack", "skill", "ultimate", "dash", "block"].includes(fighter.action)) {
      fighter.vx += move * (grounded ? runAcceleration : airAcceleration) * delta;
      fighter.vx = clamp(fighter.vx, -(grounded ? maxRunSpeed : maxAirSpeed), grounded ? maxRunSpeed : maxAirSpeed);
      if (move !== 0) fighter.facing = move;
      fighter.action = grounded ? (move ? "run" : "idle") : fighter.vy < 0 ? "jump" : "fall";
    }
    if (fighter.dashTime > 0) {
      fighter.vx = fighter.facing * 1020;
    }
  }

  handleActions(fighter, opponent);

  if (fighter.actionDuration && fighter.actionTime >= fighter.actionDuration) {
    fighter.actionDuration = 0;
    fighter.hitDone = false;
    fighter.action = grounded ? "idle" : "fall";
  }

  fighter.vy += gravity * delta;
  fighter.x += fighter.vx * delta;
  fighter.y += fighter.vy * delta;
  fighter.vx *= grounded ? 0.86 : 0.97;

  if (fighter.y >= groundY()) {
    fighter.y = groundY();
    fighter.vy = 0;
    fighter.airJumps = 1;
    if (fighter.hitStun <= 0 && fighter.action !== "hit") fighter.receivedCombo = 0;
  }

  fighter.x = clamp(fighter.x, 42, w() - 42);
  if (game.state === "playing" && Math.abs(fighter.x - opponent.x) < 52 && Math.abs(fighter.y - opponent.y) < 90) {
    const push = fighter.x < opponent.x ? -1 : 1;
    fighter.x += push * 26 * delta;
  }
}

function updateProjectiles(delta) {
  for (const projectile of game.projectiles) {
    projectile.x += projectile.vx * delta;
    projectile.y += (projectile.vy || 0) * delta;
    projectile.life -= delta;
    const target = projectile.owner === 1 ? game.p2 : game.p1;
    const owner = projectile.owner === 1 ? game.p1 : game.p2;
    const box = {
      x: projectile.x,
      y: projectile.y,
      width: projectile.radius * 2.4,
      height: projectile.radius * 2.4,
      damage: projectile.damage,
      knock: projectile.knock || 360,
      lift: projectile.lift || -180,
      stun: projectile.stun || 0.28,
      type: projectile.type || "skill",
    };
    if (tryHit(owner, target, box)) projectile.life = 0;
    if (projectile.x < -80 || projectile.x > w() + 80) projectile.life = 0;
  }
  game.projectiles = game.projectiles.filter((projectile) => projectile.life > 0);
}

function updateEffects(delta) {
  for (const slash of game.slashes) slash.life -= delta;
  game.slashes = game.slashes.filter((slash) => slash.life > 0);

  for (const spark of game.sparks) {
    spark.life -= delta;
    spark.x += spark.vx * delta;
    spark.y += spark.vy * delta;
    spark.vy += 580 * delta;
    spark.vx *= 0.94;
  }
  game.sparks = game.sparks.filter((spark) => spark.life > 0);
  game.shake = Math.max(0, game.shake - delta * 46);
  game.flash = Math.max(0, game.flash - delta);
}

function update(delta) {
  if (game.state === "ready" && keys.size > 0) {
    game.state = "playing";
  }

  if (game.state === "playing") {
    game.time += delta;
    game.roundTime = Math.max(0, game.roundTime - delta);
    if (game.roundTime <= 0) {
      finishRound(game.p1.hp >= game.p2.hp ? game.p1 : game.p2);
    }
  } else if (game.state === "roundOver") {
    game.endTimer -= delta;
    if (game.endTimer <= 0) newMatch(true);
  }

  if (game.state !== "matchOver") {
    updateFighter(game.p1, game.p2, delta);
    updateFighter(game.p2, game.p1, delta);
    if (!["attack", "skill", "ultimate", "dash", "hit"].includes(game.p1.action) && !["attack", "skill", "ultimate", "dash", "hit"].includes(game.p2.action)) {
      faceEachOther();
    }
    updateProjectiles(delta);
  }

  updateEffects(delta);
  updateHud();
  keyTap.clear();
}

function updateHud() {
  hud.timer.textContent = Math.ceil(game.roundTime);
  hud.p1Name.textContent = game.p1.name;
  hud.p2Name.textContent = game.p2.name;
  hud.p1Hp.style.width = `${(game.p1.hp / game.p1.maxHp) * 100}%`;
  hud.p2Hp.style.width = `${(game.p2.hp / game.p2.maxHp) * 100}%`;
  hud.p1Energy.style.width = `${game.p1.energy}%`;
  hud.p2Energy.style.width = `${game.p2.energy}%`;
  hud.p1Wins.textContent = game.p1.wins;
  hud.p2Wins.textContent = game.p2.wins;

  if (game.state === "ready") hud.message.textContent = "按任意操作开始";
  else if (game.state === "roundOver") hud.message.textContent = `${game.winner.name} 胜`;
  else if (game.state === "matchOver") hud.message.textContent = `${game.winner.name} 获胜`;
  else {
    const combo = Math.max(game.p1.comboCount, game.p2.comboCount);
    hud.message.textContent = combo >= 2 ? `${combo} 连击` : "先赢 2 回合";
  }
}

function addSlash(x, y, facing, color, life, size) {
  game.slashes.push({ x, y, facing, color, life, maxLife: life, size });
}

function addMagicCircle(x, y, color, life, size) {
  game.slashes.push({ x, y, facing: 1, color, life, maxLife: life, size, circle: true });
}

function addSparks(x, y, color, amount) {
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 320;
    game.sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 80,
      life: 0.28 + Math.random() * 0.42,
      color,
    });
  }
}

function drawBackground() {
  const width = w();
  const height = h();
  const gy = groundY();
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#24314a");
  sky.addColorStop(0.45, "#1f2635");
  sky.addColorStop(1, "#12151d");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255,228,152,0.16)";
  ctx.beginPath();
  ctx.arc(width * 0.5, 105, 96, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i += 1) {
    const y = 80 + i * 38;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(width * 0.5, y + Math.sin(game.time + i) * 16, width, y - 12);
    ctx.stroke();
  }

  for (let i = 0; i < 7; i += 1) {
    const x = ((i * 210 + game.time * 12) % (width + 260)) - 130;
    const top = gy - 190 - (i % 3) * 30;
    ctx.fillStyle = i % 2 ? "#202737" : "#1a2130";
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x, top + 28);
    ctx.lineTo(x + 26, top);
    ctx.lineTo(x + 86, top + 8);
    ctx.lineTo(x + 116, top + 42);
    ctx.lineTo(x + 116, gy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(240,200,106,0.18)";
    for (let y = gy - 158; y < gy - 20; y += 34) {
      ctx.fillRect(x + 16, y, 14, 9);
      ctx.fillRect(x + 64, y + 8, 14, 9);
    }
  }

  const floor = ctx.createLinearGradient(0, gy, 0, height);
  floor.addColorStop(0, "#3a424d");
  floor.addColorStop(1, "#1b1f26");
  ctx.fillStyle = floor;
  ctx.fillRect(0, gy, width, height - gy);
  ctx.fillStyle = "#59616c";
  ctx.fillRect(0, gy, width, 9);
  ctx.fillStyle = "rgba(240,200,106,0.18)";
  ctx.fillRect(0, gy + 10, width, 3);

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let x = -80; x < width + 80; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, gy + 40);
    ctx.lineTo(x + 48, height);
    ctx.stroke();
  }
}

function drawFighter(fighter) {
  if (fighter.type === "assassin") {
    drawAssassinFighter(fighter);
    return;
  }

  if (fighter.type === "guardian") {
    drawGuardianFighter(fighter);
    return;
  }

  if (fighter.type === "mage") {
    drawMageFighter(fighter);
    return;
  }

  const p = fighter.palette;
  const bob = fighter.action === "run" ? Math.sin(game.time * 20) * 3 : 0;
  const hurtLean = fighter.action === "hit" ? -fighter.facing * 0.16 : 0;
  const attackReach = fighter.action === "attack" || fighter.action === "skill" || fighter.action === "ultimate" ? 30 : 0;
  const blockPose = fighter.action === "block";
  const runSwing = fighter.action === "run" ? Math.sin(game.time * 24) * 8 : 0;
  const airLean = fighter.y < groundY() - 6 ? -0.08 : 0;

  ctx.save();
  ctx.translate(fighter.x, fighter.y + bob);
  ctx.scale(fighter.facing, 1);
  ctx.rotate(hurtLean + airLean);

  ctx.fillStyle = "rgba(0,0,0,0.26)";
  ctx.beginPath();
  ctx.ellipse(0, 9, 54, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  if (fighter.action === "dash" || fighter.dashTime > 0) {
    const dashGradient = ctx.createLinearGradient(-92, -76, 12, -76);
    dashGradient.addColorStop(0, "rgba(255,255,255,0)");
    dashGradient.addColorStop(0.55, p.energy);
    dashGradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = dashGradient;
    ctx.beginPath();
    ctx.moveTo(-90, -112);
    ctx.lineTo(14, -92);
    ctx.lineTo(8, -38);
    ctx.lineTo(-102, -20);
    ctx.closePath();
    ctx.fill();
  }

  if (fighter.burstTime > 0) {
    ctx.strokeStyle = p.energy;
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.35 + fighter.burstTime;
    ctx.beginPath();
    ctx.arc(0, -76, 72 - fighter.burstTime * 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = p.cape;
  ctx.beginPath();
  ctx.moveTo(-18, -116);
  ctx.quadraticCurveTo(-64 - runSwing, -82, -48, -15);
  ctx.quadraticCurveTo(-24, -2, -6, -12);
  ctx.lineTo(13, -104);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();

  drawArmoredLimb(-18, -78, -42, -42 + runSwing * 0.2, 15, p);
  drawArmoredLimb(20, -80, 34 + attackReach, -45 - runSwing * 0.15, 15, p);
  drawArmoredLimb(-15, -32, -31 - runSwing * 0.3, -3, 17, p, true);
  drawArmoredLimb(16, -32, 31 + runSwing * 0.3, -3, 17, p, true);

  ctx.fillStyle = p.dark;
  roundRect(-24, -46, 48, 22, 8);
  ctx.fill();
  ctx.fillStyle = p.trim;
  ctx.fillRect(-26, -45, 52, 5);

  ctx.fillStyle = p.armor;
  roundRect(-36, -107, 28, 24, 10);
  ctx.fill();
  roundRect(8, -107, 36, 24, 10);
  ctx.fill();
  ctx.strokeStyle = p.trim;
  ctx.lineWidth = 2;
  ctx.stroke();

  const chestGradient = ctx.createLinearGradient(0, -108, 0, -28);
  chestGradient.addColorStop(0, "#ffffff");
  chestGradient.addColorStop(0.15, p.armor);
  chestGradient.addColorStop(0.62, p.main);
  chestGradient.addColorStop(1, p.dark);
  ctx.fillStyle = chestGradient;
  roundRect(-31, -105, 62, 80, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(10,12,16,0.72)";
  ctx.lineWidth = 3;
  ctx.stroke();
  
  ctx.fillStyle = p.armor;
  roundRect(-24, -99, 48, 20, 8);
  ctx.fill();
  ctx.strokeStyle = p.trim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-25, -75);
  ctx.lineTo(25, -75);
  ctx.moveTo(-18, -57);
  ctx.lineTo(18, -57);
  ctx.moveTo(0, -102);
  ctx.lineTo(0, -29);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.2)";
  roundRect(-17, -93, 13, 47, 6);
  ctx.fill();

  ctx.fillStyle = p.skin;
  roundRect(-17, -145, 34, 35, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(45,32,29,0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = p.eye;
  ctx.fillRect(4, -133, 9, 3);
  ctx.fillStyle = "#20222a";
  ctx.fillRect(7, -133, 4, 3);
  ctx.strokeStyle = "#20222a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(3, -136);
  ctx.lineTo(15, -135);
  ctx.stroke();

  ctx.fillStyle = p.hair;
  drawHair(fighter.id);

  ctx.fillStyle = p.armor;
  ctx.beginPath();
  ctx.arc(0, -135, 24, Math.PI * 1.05, Math.PI * 1.95);
  ctx.lineTo(22, -122);
  ctx.quadraticCurveTo(0, -110, -22, -122);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = p.trim;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "rgba(18,20,26,0.9)";
  roundRect(-18, -139, 38, 10, 4);
  ctx.fill();
  ctx.fillStyle = p.trim;
  ctx.beginPath();
  ctx.moveTo(-7, -158);
  ctx.lineTo(0, -181);
  ctx.lineTo(7, -158);
  ctx.closePath();
  ctx.fill();

  if (blockPose) {
    const shieldGradient = ctx.createLinearGradient(24, -126, 48, -42);
    shieldGradient.addColorStop(0, "#ffffff");
    shieldGradient.addColorStop(0.45, p.armor);
    shieldGradient.addColorStop(1, p.main);
    ctx.fillStyle = shieldGradient;
    roundRect(20, -124, 28, 82, 10);
    ctx.fill();
    ctx.strokeStyle = p.trim;
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    drawWeapon(24 + attackReach, -57, 78 + attackReach * 1.25, -102, p, fighter.id);
  }

  if (fighter.invincible > 0) {
    ctx.strokeStyle = p.energy;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -78, 58, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawMageFighter(fighter) {
  const p = fighter.palette;
  const bob = Math.sin(game.time * 7 + fighter.id) * 4 + (fighter.action === "run" ? Math.sin(game.time * 22) * 2 : 0);
  const castPose = fighter.action === "attack" || fighter.action === "skill" || fighter.action === "ultimate";
  const hurtLean = fighter.action === "hit" ? -fighter.facing * 0.12 : 0;

  ctx.save();
  ctx.translate(fighter.x, fighter.y + bob);
  ctx.scale(fighter.facing, 1);
  ctx.rotate(hurtLean);

  ctx.fillStyle = "rgba(0,0,0,0.24)";
  ctx.beginPath();
  ctx.ellipse(0, 10, 50, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  if (fighter.burstTime > 0 || fighter.invincible > 0) {
    ctx.strokeStyle = p.energy;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(0, -78, 68, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = p.cape;
  ctx.beginPath();
  ctx.moveTo(-22, -118);
  ctx.quadraticCurveTo(-62, -80, -42, -4);
  ctx.quadraticCurveTo(-6, 13, 28, -5);
  ctx.lineTo(18, -106);
  ctx.closePath();
  ctx.fill();

  const robeGradient = ctx.createLinearGradient(0, -112, 0, 6);
  robeGradient.addColorStop(0, p.armor);
  robeGradient.addColorStop(0.24, p.main);
  robeGradient.addColorStop(1, p.dark);
  ctx.fillStyle = robeGradient;
  ctx.beginPath();
  ctx.moveTo(-30, -108);
  ctx.quadraticCurveTo(0, -126, 30, -108);
  ctx.lineTo(42, -2);
  ctx.quadraticCurveTo(0, 12, -42, -2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(12,14,20,0.72)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.strokeStyle = p.trim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -106);
  ctx.lineTo(0, -8);
  ctx.moveTo(-24, -74);
  ctx.lineTo(24, -74);
  ctx.stroke();

  drawArmoredLimb(-22, -82, -48, -48, 13, p);
  drawArmoredLimb(22, -82, castPose ? 50 : 34, castPose ? -90 : -46, 13, p);

  ctx.strokeStyle = p.blade;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(castPose ? 48 : 34, castPose ? -94 : -50);
  ctx.lineTo(castPose ? 78 : 58, castPose ? -174 : -134);
  ctx.stroke();
  ctx.fillStyle = p.energy;
  ctx.beginPath();
  ctx.arc(castPose ? 80 : 60, castPose ? -178 : -138, 11, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.skin;
  roundRect(-17, -145, 34, 36, 12);
  ctx.fill();
  ctx.fillStyle = p.eye;
  ctx.fillRect(5, -133, 10, 3);
  ctx.fillStyle = "#20222a";
  ctx.fillRect(9, -133, 4, 3);

  ctx.fillStyle = p.hair;
  ctx.beginPath();
  ctx.moveTo(-24, -143);
  ctx.lineTo(-12, -170);
  ctx.lineTo(-3, -147);
  ctx.lineTo(10, -174);
  ctx.lineTo(15, -146);
  ctx.lineTo(28, -158);
  ctx.lineTo(19, -119);
  ctx.quadraticCurveTo(0, -110, -20, -121);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = p.dark;
  ctx.beginPath();
  ctx.moveTo(-30, -142);
  ctx.quadraticCurveTo(0, -178, 31, -142);
  ctx.lineTo(21, -126);
  ctx.quadraticCurveTo(0, -140, -22, -126);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = p.trim;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = p.energy;
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i += 1) {
    const angle = game.time * 1.8 + i * 2.1;
    const rx = Math.cos(angle) * 38;
    const ry = -82 + Math.sin(angle) * 16;
    ctx.beginPath();
    ctx.arc(rx, ry, 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAssassinFighter(fighter) {
  const p = fighter.palette;
  const bob = fighter.action === "run" ? Math.sin(game.time * 28) * 5 : Math.sin(game.time * 8) * 2;
  const attackReach = fighter.action === "attack" || fighter.action === "skill" || fighter.action === "ultimate" ? 34 : 0;

  ctx.save();
  ctx.translate(fighter.x, fighter.y + bob);
  ctx.scale(fighter.facing, 1);
  ctx.rotate(fighter.action === "hit" ? -fighter.facing * 0.18 : -0.08);

  ctx.fillStyle = "rgba(0,0,0,0.24)";
  ctx.beginPath();
  ctx.ellipse(0, 9, 46, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.cape;
  ctx.beginPath();
  ctx.moveTo(-12, -108);
  ctx.quadraticCurveTo(-70, -82, -50, -26);
  ctx.lineTo(-4, -12);
  ctx.lineTo(13, -98);
  ctx.closePath();
  ctx.fill();

  drawArmoredLimb(-17, -75, -44, -42, 11, p);
  drawArmoredLimb(18, -76, 42 + attackReach, -50, 11, p);
  drawArmoredLimb(-12, -30, -32, -3, 13, p, true);
  drawArmoredLimb(14, -30, 34, -3, 13, p, true);

  const suit = ctx.createLinearGradient(0, -105, 0, -22);
  suit.addColorStop(0, p.armor);
  suit.addColorStop(0.25, p.main);
  suit.addColorStop(1, p.dark);
  ctx.fillStyle = suit;
  roundRect(-25, -102, 50, 78, 15);
  ctx.fill();
  ctx.strokeStyle = p.trim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-18, -74);
  ctx.lineTo(20, -54);
  ctx.moveTo(18, -76);
  ctx.lineTo(-18, -54);
  ctx.stroke();

  ctx.fillStyle = p.skin;
  roundRect(-15, -142, 30, 31, 11);
  ctx.fill();
  ctx.fillStyle = p.dark;
  roundRect(-23, -146, 46, 20, 8);
  ctx.fill();
  ctx.fillStyle = p.eye;
  ctx.fillRect(5, -133, 10, 3);
  ctx.fillStyle = p.hair;
  ctx.beginPath();
  ctx.moveTo(-20, -145);
  ctx.lineTo(-4, -168);
  ctx.lineTo(2, -147);
  ctx.lineTo(18, -160);
  ctx.lineTo(15, -120);
  ctx.quadraticCurveTo(-2, -110, -20, -122);
  ctx.closePath();
  ctx.fill();

  drawWeapon(20 + attackReach, -58, 70 + attackReach * 1.1, -92, p, 1);
  drawWeapon(-24, -58, -66, -86, p, 1);

  if (fighter.burstTime > 0 || fighter.invincible > 0) {
    ctx.strokeStyle = p.energy;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -76, 55, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGuardianFighter(fighter) {
  const p = fighter.palette;
  const bob = fighter.action === "run" ? Math.sin(game.time * 14) * 2 : 0;
  const attackReach = fighter.action === "attack" || fighter.action === "skill" || fighter.action === "ultimate" ? 18 : 0;
  const blockPose = fighter.action === "block";

  ctx.save();
  ctx.translate(fighter.x, fighter.y + bob);
  ctx.scale(fighter.facing, 1);
  ctx.rotate(fighter.action === "hit" ? -fighter.facing * 0.1 : 0);

  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(0, 9, 62, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.cape;
  ctx.beginPath();
  ctx.moveTo(-26, -114);
  ctx.quadraticCurveTo(-58, -70, -38, -4);
  ctx.quadraticCurveTo(0, 14, 34, -6);
  ctx.lineTo(23, -104);
  ctx.closePath();
  ctx.fill();

  drawArmoredLimb(-24, -80, -52, -42, 18, p);
  drawArmoredLimb(25, -80, 38 + attackReach, -43, 18, p);
  drawArmoredLimb(-18, -34, -34, -2, 20, p, true);
  drawArmoredLimb(20, -34, 38, -2, 20, p, true);

  const plate = ctx.createLinearGradient(0, -112, 0, -20);
  plate.addColorStop(0, "#fff3cf");
  plate.addColorStop(0.18, p.armor);
  plate.addColorStop(0.72, p.main);
  plate.addColorStop(1, p.dark);
  ctx.fillStyle = plate;
  roundRect(-38, -110, 76, 88, 18);
  ctx.fill();
  ctx.strokeStyle = p.trim;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-30, -76);
  ctx.lineTo(30, -76);
  ctx.moveTo(0, -108);
  ctx.lineTo(0, -24);
  ctx.stroke();

  ctx.fillStyle = p.skin;
  roundRect(-17, -145, 34, 34, 12);
  ctx.fill();
  ctx.fillStyle = p.armor;
  ctx.beginPath();
  ctx.arc(0, -137, 28, Math.PI, Math.PI * 2);
  ctx.lineTo(24, -122);
  ctx.quadraticCurveTo(0, -108, -24, -122);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.eye;
  ctx.fillRect(5, -133, 11, 3);

  ctx.fillStyle = "rgba(220,230,240,0.92)";
  roundRect(blockPose ? 12 : 30, -122, 34, 86, 12);
  ctx.fill();
  ctx.strokeStyle = p.trim;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.strokeStyle = p.blade;
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(30 + attackReach, -50);
  ctx.lineTo(82 + attackReach, -88);
  ctx.stroke();

  if (fighter.burstTime > 0 || fighter.invincible > 0) {
    ctx.strokeStyle = p.energy;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, -76, 68, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLimb(x1, y1, x2, y2, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawArmoredLimb(x1, y1, x2, y2, width, palette, leg = false) {
  drawLimb(x1, y1, x2, y2, width + 5, "rgba(12,14,18,0.75)");
  drawLimb(x1, y1, x2, y2, width, leg ? palette.dark : palette.armor);
  ctx.fillStyle = palette.armor;
  ctx.beginPath();
  ctx.arc(x1, y1, width * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.trim;
  ctx.beginPath();
  ctx.arc(x2, y2, width * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1 + 2, y1 - 5);
  ctx.lineTo(x2 + 2, y2 - 5);
  ctx.stroke();
}

function drawHair(id) {
  if (id === 1) {
    ctx.beginPath();
    ctx.moveTo(-23, -145);
    ctx.lineTo(-8, -166);
    ctx.lineTo(-1, -148);
    ctx.lineTo(10, -169);
    ctx.lineTo(15, -146);
    ctx.lineTo(27, -155);
    ctx.lineTo(18, -123);
    ctx.quadraticCurveTo(2, -113, -19, -122);
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(-24, -144);
  ctx.lineTo(-14, -166);
  ctx.lineTo(-5, -147);
  ctx.lineTo(7, -171);
  ctx.lineTo(12, -146);
  ctx.lineTo(26, -161);
  ctx.lineTo(20, -124);
  ctx.quadraticCurveTo(0, -111, -20, -122);
  ctx.closePath();
  ctx.fill();
}

function drawWeapon(x1, y1, x2, y2, palette, id) {
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1 - 1, y1 + 2);
  ctx.lineTo(x2 - 1, y2 + 2);
  ctx.stroke();

  ctx.strokeStyle = palette.blade;
  ctx.lineWidth = id === 1 ? 7 : 6;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.strokeStyle = palette.energy;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1 + 3, y1 - 2);
  ctx.lineTo(x2 + 3, y2 - 2);
  ctx.stroke();

  ctx.fillStyle = palette.trim;
  ctx.beginPath();
  ctx.arc(x1, y1, 7, 0, Math.PI * 2);
  ctx.fill();

  if (id === 2) {
    ctx.strokeStyle = palette.energy;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x2 - 12, y2 + 8);
    ctx.lineTo(x2, y2 - 10);
    ctx.lineTo(x2 + 12, y2 + 6);
    ctx.stroke();
  }
  ctx.restore();
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

function drawProjectiles() {
  for (const projectile of game.projectiles) {
    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.rotate(game.time * 9);
    const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.28, projectile.color);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = projectile.color;
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 42, 14, (Math.PI / 3) * i, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawSlashes() {
  for (const slash of game.slashes) {
    const t = slash.life / slash.maxLife;
    ctx.save();
    ctx.globalAlpha = clamp(t, 0, 1);
    ctx.translate(slash.x, slash.y);
    if (slash.circle) {
      ctx.rotate(game.time * 2);
      ctx.strokeStyle = slash.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, slash.size * (1.05 - t * 0.2), 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, slash.size * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI * 2 * i) / 6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * slash.size * 0.28, Math.sin(angle) * slash.size * 0.28);
        ctx.lineTo(Math.cos(angle) * slash.size * 0.92, Math.sin(angle) * slash.size * 0.92);
        ctx.stroke();
      }
      ctx.fillStyle = slash.color;
      ctx.globalAlpha = clamp(t * 0.18, 0, 0.18);
      ctx.beginPath();
      ctx.arc(0, 0, slash.size * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }
    ctx.scale(slash.facing, 1);
    ctx.strokeStyle = slash.color;
    ctx.lineWidth = 13;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, slash.size * (1.05 - t * 0.2), -0.7, 0.78);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 23;
    ctx.beginPath();
    ctx.arc(0, 0, slash.size * (1.02 - t * 0.18), -0.68, 0.76);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, slash.size * 0.72, -0.55, 0.62);
    ctx.stroke();
    ctx.restore();
  }
}

function drawSparks() {
  for (const spark of game.sparks) {
    ctx.globalAlpha = clamp(spark.life * 2.4, 0, 1);
    ctx.fillStyle = spark.color;
    ctx.fillRect(spark.x - 2, spark.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function drawOverlay() {
  if (game.state === "playing" || game.state === "roundOver" || game.state === "select") return;
  ctx.fillStyle = "rgba(10, 12, 16, 0.55)";
  ctx.fillRect(0, 0, w(), h());
  ctx.textAlign = "center";
  ctx.fillStyle = "#f5f1e8";
  ctx.font = "900 42px Microsoft YaHei, Arial";
  ctx.fillText(game.state === "matchOver" ? `${game.winner.name} 获胜` : "铠甲小人格斗", w() / 2, h() * 0.38);
  ctx.fillStyle = "#d6dbe0";
  ctx.font = "16px Microsoft YaHei, Arial";
  ctx.fillText(game.state === "matchOver" ? "点击重新开始再战" : "普攻连点接三段，技能可衔接连招，能量满可放大招", w() / 2, h() * 0.47);
}

function setSelectedType(player, type) {
  selectedTypes[player] = type;
  document.querySelectorAll(`.choice-row[data-player="${player}"] .choice`).forEach((button) => {
    button.classList.toggle("active", button.dataset.type === type);
  });
  newMatch(false);
  game.state = "select";
}

function startSelectedMatch() {
  hud.selectScreen.classList.add("hidden");
  keys.clear();
  keyTap.clear();
  newMatch(false);
  document.activeElement?.blur();
}

function cycleSelectedType(player, direction) {
  const currentIndex = selectableTypes.indexOf(selectedTypes[player]);
  const nextIndex = (currentIndex + direction + selectableTypes.length) % selectableTypes.length;
  setSelectedType(player, selectableTypes[nextIndex]);
}

function handleSelectKey(event) {
  if (hud.selectScreen.classList.contains("hidden")) return false;

  if (event.code === "KeyA" || event.code === "KeyD") {
    cycleSelectedType("p1", event.code === "KeyA" ? -1 : 1);
    event.preventDefault();
    return true;
  }

  if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
    cycleSelectedType("p2", event.code === "ArrowLeft" ? -1 : 1);
    event.preventDefault();
    return true;
  }

  if (event.code === "Enter" || event.code === "Space") {
    startSelectedMatch();
    event.preventDefault();
    return true;
  }

  return false;
}

function draw() {
  ctx.clearRect(0, 0, w(), h());
  ctx.save();
  if (game.shake > 0) {
    ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
  }
  drawBackground();
  drawProjectiles();
  drawFighter(game.p1);
  drawFighter(game.p2);
  drawSlashes();
  drawSparks();
  ctx.restore();

  if (game.flash > 0) {
    ctx.fillStyle = `rgba(255, 244, 200, ${game.flash * 1.8})`;
    ctx.fillRect(0, 0, w(), h());
  }
  drawOverlay();
}

function frame(now) {
  const delta = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  if (handleSelectKey(event)) return;

  if (event.code === "KeyR") {
    restartMatch();
    return;
  }
  if (!keys.has(event.code)) keyTap.set(event.code, true);
  keys.add(event.code);
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Enter"].includes(event.code)) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

function restartMatch() {
  keys.clear();
  keyTap.clear();
  newMatch(false);
  if (!hud.selectScreen.classList.contains("hidden")) {
    game.state = "select";
  }
  hud.restart.blur();
}

hud.restart.addEventListener("keydown", (event) => {
  if (event.code === "Enter") {
    event.preventDefault();
    hud.restart.blur();
  }
});

hud.restart.addEventListener("click", restartMatch);

document.querySelectorAll(".choice").forEach((button) => {
  button.addEventListener("click", () => {
    const row = button.closest(".choice-row");
    setSelectedType(row.dataset.player, button.dataset.type);
  });
});

hud.start.addEventListener("click", startSelectedMatch);

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
newMatch(false);
game.state = "select";
requestAnimationFrame(frame);
