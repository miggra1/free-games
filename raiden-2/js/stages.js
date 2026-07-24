/**
 * Raiden II - Stage Data & Enemy Waves
 */

const STAGES = [{
  name: "STAGE 1 - OCEAN",
  theme: 0,
  duration: 60,
  waves: [
    // Early waves of small fighters
    { time: 2, type: "formation", color: "#5a5", data: [{ x: 80, y: -40 }, { x: 150, y: -60 }, { x: 220, y: -40 }, { x: 290, y: -60 }, { x: 360, y: -40 }] },
    { time: 5, type: "formation", color: "#5a5", data: [{ x: 100, y: -30 }, { x: 200, y: -50 }, { x: 300, y: -30 }, { x: 400, y: -50 }] },
    { time: 8, type: "medium", x: W / 2, y: H * 0.1, color: "#a55" },
    { time: 11, type: "formation", color: "#aa5", data: [{ x: 60, y: -50 }, { x: 160, y: -30 }, { x: 260, y: -50 }, { x: 360, y: -30 }, { x: 440, y: -50 }] },
    { time: 14, type: "formation", color: "#5aa", data: [{ x: 80, y: -30 }, { x: 180, y: -50 }, { x: 280, y: -30 }, { x: 380, y: -50 }] },
    { time: 17, type: "turret", x: 120, y: H * 0.4, angle: -0.3 },
    { time: 17.5, type: "turret", x: 360, y: H * 0.4, angle: 0.3 },
    { time: 20, type: "medium", x: W / 2, y: H * 0.15, color: "#88a" },
    { time: 22, type: "formation", color: "#a5a", data: [
      { x: 60, y: -60 }, { x: 140, y: -40 }, { x: 220, y: -60 }, { x: 300, y: -40 }, { x: 380, y: -60 },
      { x: 100, y: -20 }, { x: 180, y: -30 }, { x: 260, y: -20 }, { x: 340, y: -30 }, { x: 420, y: -20 },
    ]},
    { time: 25, type: "tank", x: 180, y: H * 0.6, angle: 0 },
    { time: 25.5, type: "tank", x: 300, y: H * 0.6, angle: 0 },
    { time: 28, type: "large", x: W / 2, y: H * 0.1, color: "#aa8833" },
    { time: 31, type: "formation", color: "#55a", data: [
      { x: 100, y: -40 }, { x: 200, y: -60 }, { x: 300, y: -40 }, { x: 400, y: -60 },
    ]},
    { time: 34, type: "medium", x: 150, y: H * 0.15, color: "#a55" },
    { time: 34.5, type: "medium", x: 330, y: H * 0.20, color: "#a55" },
    { time: 37, type: "formation", color: "#a5a", data: [
      { x: 80, y: -50 }, { x: 160, y: -30 }, { x: 240, y: -50 }, { x: 320, y: -30 }, { x: 400, y: -50 },
    ]},
    { time: 40, type: "tank", x: 100, y: H * 0.5, angle: -0.2 },
    { time: 40.5, type: "tank", x: 240, y: H * 0.5, angle: 0.2 },
    { time: 41, type: "tank", x: 380, y: H * 0.5, angle: 0 },
    { time: 44, type: "large", x: W / 3, y: H * 0.12, color: "#8866aa" },
    { time: 46, type: "formation", color: "#5a5", data: [
      { x: 70, y: -40 }, { x: 170, y: -25 }, { x: 270, y: -40 }, { x: 370, y: -25 },
      { x: 470, y: -40 }, { x: 120, y: -15 }, { x: 320, y: -15 },
    ]},
    // Boss at 50s
    { time: 50, type: "boss", x: W / 2, y: H * 0.15, name: "IRON CLAW" },
  ],
}];

// Spawn waves based on current time
function spawnWaves(stage, timer, scrollY) {
  const spawned = [];
  for (const wave of stage.waves) {
    if (wave.time <= timer && !wave.done) {
      wave.done = true;
      const e = spawnEnemy(wave, scrollY);
      if (Array.isArray(e)) spawned.push(...e);
      else spawned.push(e);
    }
  }
  return spawned;
}
