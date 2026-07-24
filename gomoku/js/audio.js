/* ============================================================
 * audio.js — 五子棋音效合成
 * 落子 / 胜利 / 禁手 / 非法 / 读秒 / 点击 / 背景音乐
 * ============================================================ */
(function () {
  "use strict";

  let ctx = null, masterGain = null, bgmGain = null, bgmOsc = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.3;
      masterGain.connect(ctx.destination);
      bgmGain = ctx.createGain();
      bgmGain.gain.value = 0.08;
      bgmGain.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  function play(freq, dur, type, vol, decay) {
    if (muted) return;
    ensure();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (decay || dur));
    osc.connect(g); g.connect(masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  }

  function playNoise(dur, vol) {
    if (muted) return;
    ensure();
    const bufSize = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = vol || 0.2;
    src.connect(g); g.connect(masterGain);
    src.start();
  }

  const AUDIO = {
    get muted() { return muted; },
    toggleMute() { muted = !muted; if (muted && bgmOsc) AUDIO.bgm.stop(); return muted; },

    stone() {
      play(800, 0.06, "sine", 0.4, 0.04);
      play(400, 0.1, "triangle", 0.2, 0.08);
      playNoise(0.03, 0.1);
    },
    stoneHeavy() {
      play(500, 0.08, "sine", 0.5, 0.06);
      play(250, 0.12, "triangle", 0.3, 0.1);
      playNoise(0.05, 0.15);
    },
    win() {
      ensure();
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((f, i) => {
        setTimeout(() => play(f, 0.3, "sine", 0.35, 0.25), i * 100);
      });
      setTimeout(() => playNoise(0.3, 0.2), 400);
    },
    lose() {
      ensure();
      const notes = [400, 350, 300, 250];
      notes.forEach((f, i) => {
        setTimeout(() => play(f, 0.25, "sine", 0.3, 0.2), i * 150);
      });
    },
    forbidden() {
      play(200, 0.3, "square", 0.3, 0.25);
      play(150, 0.4, "sawtooth", 0.15, 0.35);
    },
    illegal() {
      play(300, 0.1, "square", 0.2, 0.08);
    },
    tick() {
      play(1000, 0.03, "sine", 0.15, 0.02);
    },
    countTick() {
      play(800, 0.05, "sine", 0.25, 0.04);
    },
    click() {
      play(600, 0.03, "sine", 0.15, 0.02);
    },
    swap() {
      play(500, 0.05, "sine", 0.2, 0.04);
      setTimeout(() => play(700, 0.05, "sine", 0.2, 0.04), 50);
    },
    undo() {
      play(400, 0.05, "sine", 0.15, 0.04);
    },

    bgm: {
      start() {
        if (muted || bgmOsc) return;
        ensure();
        // 简单氛围和弦
        const freqs = [220, 277, 330];
        bgmOsc = freqs.map(f => {
          const osc = ctx.createOscillator();
          osc.type = "sine"; osc.frequency.value = f;
          const g = ctx.createGain(); g.gain.value = 0.03;
          osc.connect(g); g.connect(bgmGain);
          osc.start();
          return osc;
        });
      },
      stop() {
        if (bgmOsc) { bgmOsc.forEach(o => o.stop()); bgmOsc = null; }
      },
    },

    ensure,
  };

  window.AUDIO = AUDIO;
})();
