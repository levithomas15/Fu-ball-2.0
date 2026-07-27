/**
 * Kompletter Sound ohne externe Dateien – alles per WebAudio synthetisiert:
 * Schussgeräusch, Aufprall, Fanfare, Stadionatmosphäre.
 */
export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.started = false;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this._crowdBed();
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.master) this.master.gain.value = this.enabled ? 0.55 : 0;
    return this.enabled;
  }

  _noiseBuffer(seconds = 1) {
    const n = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Leises, wogendes Publikumsrauschen im Hintergrund. */
  _crowdBed() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(4);
    src.loop = true;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.6;

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1400;

    const g = this.ctx.createGain();
    g.gain.value = 0.05;

    // langsames Wogen
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain).connect(g.gain);
    lfo.start();

    src.connect(bp).connect(lp).connect(g).connect(this.master);
    src.start();
    this.crowdGain = g;
  }

  /** Ball trifft den Fuß – Klick + Körper, Tonhöhe nach Härte. */
  kick(strength = 1) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const s = Math.min(1.6, Math.max(0.3, strength));

    // tiefer Impuls
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220 * s, t);
    osc.frequency.exponentialRampToValueAtTime(58, t + 0.13);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.5 * s, t + 0.006);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
    osc.connect(og).connect(this.master);
    osc.start(t); osc.stop(t + 0.22);

    // Anschlaggeräusch (Leder)
    const n = this.ctx.createBufferSource();
    n.buffer = this._noiseBuffer(0.2);
    const nf = this.ctx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = 1100 + 700 * s; nf.Q.value = 1.1;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.34 * s, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    n.connect(nf).connect(ng).connect(this.master);
    n.start(t); n.stop(t + 0.12);
  }

  /** Ball fällt auf den Rasen. */
  thud() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const n = this.ctx.createBufferSource();
    n.buffer = this._noiseBuffer(0.4);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(700, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 0.3);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.45, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    n.connect(f).connect(g).connect(this.master);
    n.start(t); n.stop(t + 0.4);
  }

  /** Kurzer Ton bei Meilensteinen. */
  chime(step = 0) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const base = [523.25, 659.25, 783.99, 1046.5][step % 4];
    [0, 0.09].forEach((d, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = base * (i ? 1.5 : 1);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.22, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.5);
      o.connect(g).connect(this.master);
      o.start(t + d); o.stop(t + d + 0.55);
    });
  }

  /** Enttäuschtes "Ooooh" der Zuschauer beim Fehlversuch. */
  crowdOoh() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const n = this.ctx.createBufferSource();
    n.buffer = this._noiseBuffer(1.6);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(700, t);
    f.frequency.exponentialRampToValueAtTime(320, t + 1.1);
    f.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.16);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    n.connect(f).connect(g).connect(this.master);
    n.start(t); n.stop(t + 1.5);
  }

  /** Jubel bei einem neuen Rekord. */
  cheer() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const n = this.ctx.createBufferSource();
    n.buffer = this._noiseBuffer(2.5);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.34, t + 0.25);
    g.gain.setValueAtTime(0.3, t + 1.0);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    n.connect(f).connect(g).connect(this.master);
    n.start(t); n.stop(t + 2.5);
    this.chime(3);
  }
}
