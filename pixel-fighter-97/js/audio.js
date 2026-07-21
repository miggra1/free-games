/* audio.js — 音频系统 */

class AudioArcade {
  constructor() { this.ctx = null; this.master = null; this.mt = 0; }
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.3;
      this.master.connect(this.ctx.destination);
    } catch (e) { }
  }
  tone(f, d, tp, g, sl, dl) {
    if (!this.ctx) return;
    tp = tp || "square"; g = g || 0.18; sl = sl || 0; dl = dl || 0;
    const t = this.ctx.currentTime + dl;
    const o = this.ctx.createOscillator(), gn = this.ctx.createGain();
    o.type = tp; o.frequency.setValueAtTime(f, t);
    if (sl) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + sl), t + d);
    gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(gn); gn.connect(this.master); o.start(t); o.stop(t + d);
  }
  noise(d, g, dl) {
    if (!this.ctx) return;
    g = g || 0.16; dl = dl || 0;
    const t = this.ctx.currentTime + dl;
    const l = Math.floor(this.ctx.sampleRate * d);
    const buf = this.ctx.createBuffer(1, l, this.ctx.sampleRate);
    const dt = buf.getChannelData(0);
    for (let i = 0; i < l; i++) dt[i] = Math.random() * 2 - 1;
    const s = this.ctx.createBufferSource(), gn = this.ctx.createGain();
    gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.buffer = buf; s.connect(gn); gn.connect(this.master); s.start(t); s.stop(t + d);
  }
  sfx(n) {
    this.init();
    const M = {
      tap: () => this.tone(280, .04, "square", .09, -80),
      heavy: () => { this.noise(.06, .18); this.tone(95, .09, "sawtooth", .16, -25); },
      block: () => { this.noise(.045, .11); this.tone(160, .05, "triangle", .1); },
      wave: () => { this.tone(180, .12, "sawtooth", .14, 240); this.tone(360, .1, "square", .08, 320); },
      rush: () => { this.noise(.07, .14); this.tone(410, .08, "square", .12, -170); },
      slash: () => { this.tone(740, .08, "sawtooth", .12, -360); this.noise(.04, .08); },
      quake: () => { this.tone(62, .18, "sawtooth", .2, -18); this.noise(.09, .12); },
      throw: () => { this.tone(120, .12, "square", .16, -50); this.noise(.07, .13); },
      super: () => { this.tone(110, .28, "sawtooth", .2, 560); this.tone(660, .2, "square", .11, -240); this.noise(.15, .1, .05); },
      ko: () => { this.tone(190, .18, "square", .2, -90); setTimeout(() => this.tone(80, .5, "sawtooth", .22, -28), 120); },
      select: () => this.tone(520, .05, "square", .11, 120),
      round: () => { this.tone(440, .1, "square", .12); this.tone(660, .1, "square", .1, .1); },
      fight: () => { this.tone(880, .15, "sawtooth", .15, 200); this.noise(.08, .1, .05); },
      dodge: () => this.tone(300, .06, "triangle", .08, -100),
      charge: () => this.tone(200, .08, "sine", .06, 100),
      maxmode: () => { this.tone(440, .1, "square", .14); this.tone(880, .15, "square", .12, .1); this.tone(1320, .2, "sawtooth", .1, .2); },
      stun: () => { this.tone(600, .06, "square", .08, -200); this.tone(400, .06, "square", .08, -200, .06); this.tone(200, .1, "square", .1, .12); },
      countdown: () => this.tone(880, .08, "square", .1),
      win: () => { this.tone(523, .12, "square", .14); this.tone(659, .12, "square", .12, .12); this.tone(784, .2, "square", .14, .24); },
      lose: () => { this.tone(330, .2, "sawtooth", .14, -100); this.tone(220, .3, "sawtooth", .12, -80, .2); },
      teleport: () => { this.tone(1200, .04, "sine", .1, -800); this.tone(400, .06, "sine", .08, 400, .03); },
      guardbreak: () => { this.tone(150, .15, "sawtooth", .2, -60); this.noise(.1, .15); }
    };
    if (M[n]) M[n]();
  }
  music(frame, si, intense) {
    if (!this.ctx || frame < this.mt) return;
    this.mt = frame + (intense ? 12 : 20);
    const bar = Math.floor(frame / 20) % 32;
    const BN = [82,82,98,110,123,110,98,82,73,82,98,147,123,110,98,82,82,82,98,110,123,110,98,82,73,82,98,147,165,147,123,98];
    const b = BN[bar] * (si===1?1.2:si===2?0.8:si===3?0.7:si===4?0.9:1);
    this.tone(b, .06, "square", .03);
    if (bar % 4 === 0) this.tone(b * 2, .04, "triangle", .02);
    if (bar % 8 === 0) this.tone(b * 4, .03, "sine", .015);
    if (intense && bar % 2 === 0) this.tone(b * 1.5, .03, "sawtooth", .02);
  }
}
const audio = new AudioArcade();
