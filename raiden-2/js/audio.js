/**
 * Raiden II - Audio
 * Procedural sound generation with Web Audio API
 */

let audioCtx = null;

function initAudio() {
  if (audioCtx) {
    if (audioCtx.state === "suspended") audioCtx.resume();
    return;
  }
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function playTone(freq, duration, type = "square", vol = 0.1, ramp = true) {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    if (ramp) gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    else gain.gain.setValueAtTime(0, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) { /* ignore */ }
}

function playNoise(duration, vol = 0.05, filterFreq = 2000) {
  if (!audioCtx) return;
  try {
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start();
  } catch (e) { /* ignore */ }
}

const SFX = {
  playerShot() {
    playTone(800, 0.06, "square", 0.04);
    playTone(1200, 0.04, "square", 0.03);
  },
  laserShot() {
    playTone(300, 0.12, "sawtooth", 0.06);
    playTone(450, 0.08, "square", 0.04);
  },
  enemyShot() {
    playTone(220, 0.08, "square", 0.03);
    playTone(160, 0.06, "triangle", 0.02);
  },
  smallExplosion() {
    playNoise(0.12, 0.06, 1500);
    playTone(80, 0.1, "triangle", 0.08);
  },
  mediumExplosion() {
    playNoise(0.25, 0.08, 900);
    playTone(60, 0.2, "sawtooth", 0.1);
    playTone(40, 0.3, "triangle", 0.08);
  },
  bigExplosion() {
    playNoise(0.5, 0.12, 600);
    playTone(35, 0.5, "sawtooth", 0.15);
    playTone(50, 0.4, "triangle", 0.1);
  },
  bossExplosion() {
    playNoise(1.5, 0.15, 400);
    playTone(25, 1.0, "sawtooth", 0.2);
    playTone(15, 1.2, "triangle", 0.15);
    setTimeout(() => playNoise(0.8, 0.1, 300), 400);
    setTimeout(() => playNoise(0.6, 0.08, 200), 700);
  },
  bomb() {
    playNoise(0.6, 0.15, 1200);
    playTone(100, 0.5, "sawtooth", 0.12);
    playTone(200, 0.3, "square", 0.08);
  },
  powerUp() {
    playTone(600, 0.08, "square", 0.05);
    setTimeout(() => playTone(900, 0.06, "square", 0.05), 80);
    setTimeout(() => playTone(1200, 0.08, "square", 0.05), 160);
  },
  itemCollect() {
    playTone(1000, 0.06, "square", 0.04);
    setTimeout(() => playTone(1400, 0.06, "square", 0.04), 60);
  },
  warning() {
    playTone(440, 0.15, "square", 0.08);
    setTimeout(() => playTone(440, 0.15, "square", 0.08), 300);
    setTimeout(() => playTone(440, 0.15, "square", 0.08), 600);
  },
  playerDie() {
    playNoise(0.4, 0.1, 1000);
    playTone(200, 0.3, "sawtooth", 0.1);
    playTone(100, 0.5, "triangle", 0.08);
  },
  stageClear() {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => playTone(523 * (1 + i * 0.25), 0.15, "square", 0.06), i * 150);
    }
  },
  bossWarning() {
    playTone(450, 0.18, "square", 0.1);
    setTimeout(() => playTone(450, 0.18, "square", 0.1), 250);
    setTimeout(() => playTone(450, 0.18, "square", 0.1), 500);
    setTimeout(() => playTone(450, 0.18, "square", 0.1), 750);
    setTimeout(() => playTone(600, 0.3, "square", 0.12), 1000);
  },
};
