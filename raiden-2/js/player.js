/**
 * Raiden II - Player
 * Ship movement, weapons, lives, bombs
 */

const PLAYER_SPEED = 280;
const PLAYER_HIT_R = 4;
const SCROLL_SPEED = 60;
const STAGE_LENGTH = 12000;

function createPlayer(x, y) {
  return {
    x, y,
    vx: 0, vy: 0,
    tiltX: 0,
    weapon: "vulcan",
    weaponLevel: 1,
    subWeapon: null,
    subLevel: 0,
    lives: 3,
    bombs: 3,
    maxBombs: 7,
    score: 0,
    dead: false,
    invincible: 0,
    respawnTimer: 0,
    respawnX: W / 2,
    respawnY: H - 100,
    canBomb: true,
    bombTimer: 0,
    shotTimer: 0,
    shotInterval: 0.08,
    missileTimer: 0,
    missileInterval: 0.25,
  };
}

function updatePlayer(p, dt, shotPressed, bombPressed, bulletSpd, enemyBullets, enemies) {
  if (p.dead) {
    p.respawnTimer -= dt;
    if (p.respawnTimer <= 0 && p.lives > 0) {
      p.dead = false;
      p.x = p.respawnX;
      p.y = p.respawnY;
      p.invincible = 2.5;
      p.weaponLevel = Math.max(1, p.weaponLevel - 2);
      p.subLevel = Math.max(0, p.subLevel - 2);
    } else if (p.lives <= 0) {
      p.respawnTimer = 0;
    }
    return;
  }

  if (p.invincible > 0) p.invincible -= dt;

  // Movement
  const dx = (input.isDown(KEY_RIGHT) ? 1 : 0) - (input.isDown(KEY_LEFT) ? 1 : 0);
  const dy = (input.isDown(KEY_DOWN) ? 1 : 0) - (input.isDown(KEY_UP) ? 1 : 0);
  p.vx = dx * PLAYER_SPEED;
  p.vy = dy * PLAYER_SPEED;
  p.tiltX += (dx * 0.3 - p.tiltX) * 0.15;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = Math.max(16, Math.min(W - 16, p.x));
  p.y = Math.max(30, Math.min(H - 30, p.y));

  // Shooting
  if (shotPressed) {
    p.shotTimer -= dt;
    if (p.shotTimer <= 0) {
      p.shotTimer = p.shotInterval;
      const bullets = [];
      if (p.weapon === "vulcan") {
        const count = Math.min(p.weaponLevel + 1, 7);
        const spread = count * 0.12;
        for (let i = 0; i < count; i++) {
          const a = -spread / 2 + (i / (count - 1)) * spread;
          bullets.push({ x: p.x, y: p.y - 12, vx: Math.sin(a) * 200, vy: -bulletSpd, type: "vulcan", dmg: 1 });
        }
      } else {
        const w = 2 + p.weaponLevel;
        bullets.push({ x: p.x, y: p.y - 10, vx: 0, vy: 0, type: "laser", dmg: 2, w });
      }
      SFX.playerShot();
      return bullets;
    }
  }

  // Missiles
  if (p.subWeapon) {
    p.missileTimer -= dt;
    if (p.missileTimer <= 0) {
      p.missileTimer = p.missileInterval;
      const ms = [];
      const count = Math.min(p.subLevel + 1, 3);
      if (p.subWeapon === "homing") {
        // Homing: find nearest enemy
        let nearest = null, nearestDist = 300;
        for (const e of enemies) {
          if (e.dead || e.y < 0 || e.y > H) continue;
          const d = Math.hypot(p.x - e.x, p.y - e.y);
          if (d < nearestDist) { nearest = e; nearestDist = d; }
        }
        for (let i = 0; i < count; i++) {
          const ox = (i - (count - 1) / 2) * 15;
          ms.push({ x: p.x + ox, y: p.y, vx: 0, vy: -180, type: "homing", target: nearest, turnSpeed: 3, life: 2 });
        }
      } else {
        // Straight missiles
        for (let i = 0; i < count; i++) {
          const ox = (i - (count - 1) / 2) * 12;
          ms.push({ x: p.x + ox, y: p.y, vx: 0, vy: -300, type: "straight", dmg: 3, life: 1.5 });
        }
      }
      return { missiles: ms };
    }
  }
  return null;
}

function playerUseBomb(p, enemyBullets) {
  if (p.dead || !p.canBomb || p.bombs <= 0) return null;
  p.bombs--;
  p.canBomb = false;
  p.bombTimer = 1.5;
  SFX.bomb();
  return { x: p.x, y: p.y };
}

function playerHit(p) {
  if (p.dead || p.invincible > 0) return false;
  p.lives--;
  p.dead = true;
  p.respawnTimer = 1.5;
  p.weapon = "vulcan";
  p.subWeapon = null;
  p.subLevel = 0;
  SFX.playerDie();
  R.flashAlpha = 0.6;
  return true;
}

function playerCollectItem(p, item) {
  SFX.itemCollect();
  switch (item.type) {
    case "P":
      if (p.weaponLevel < 7) p.weaponLevel++;
      break;
    case "F":
      p.weaponLevel = 7;
      p.bombs = Math.min(p.maxBombs, p.bombs + 3);
      break;
    case "M":
      p.subWeapon = (item.subType || "homing");
      p.subLevel = Math.min(p.subLevel + 1, 3);
      break;
    case "B":
      p.bombs = Math.min(p.maxBombs, p.bombs + 1);
      break;
    case "1UP":
      p.lives = Math.min(p.lives + 1, 9);
      break;
    case "medal":
      p.score += item.value || 100;
      break;
  }
}
