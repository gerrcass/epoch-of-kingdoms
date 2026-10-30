/**
 * Small procedural WebAudio layer. No files, no network, no autoplay before a gesture.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private lastPlayed = new Map<string, number>();
  private ambientStarted = false;

  async init(): Promise<void> {
    if (this.ctx) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.5;
    master.connect(ctx.destination);
    this.master = master;
    const length = Math.floor(ctx.sampleRate * 1.2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    if (ctx.state === 'suspended') await ctx.resume();
    this.startAmbient();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.03);
    }
  }

  private now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  private throttle(name: string, gap: number): boolean {
    const now = performance.now();
    const last = this.lastPlayed.get(name) ?? 0;
    if (now - last < gap) return false;
    this.lastPlayed.set(name, now);
    return true;
  }

  private tone(freq: number, duration: number, type: OscillatorType, volume = 0.08, endFreq = freq, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const start = this.now() + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private noise(duration: number, volume: number, filterFreq: number, type: BiquadFilterType = 'bandpass'): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const start = this.now();
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    filter.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(start);
    source.stop(start + duration);
  }

  play(name: string): void {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'click':
        this.tone(520, 0.05, 'triangle', 0.03, 380);
        break;
      case 'select':
        if (this.throttle('select', 60)) this.tone(700, 0.05, 'sine', 0.025, 760);
        break;
      case 'command':
        if (this.throttle('command', 70)) this.tone(420, 0.07, 'triangle', 0.03, 520);
        break;
      case 'sword':
        if (this.throttle('sword', 45)) {
          this.noise(0.12, 0.06, 1600, 'bandpass');
          this.tone(190 + Math.random() * 40, 0.08, 'square', 0.02, 120);
        }
        break;
      case 'arrow':
        if (this.throttle('arrow', 55)) this.noise(0.2, 0.025, 3200, 'highpass');
        break;
      case 'chop':
        if (this.throttle('chop', 120)) {
          this.noise(0.08, 0.035, 900);
          this.tone(150, 0.07, 'triangle', 0.02, 100);
        }
        break;
      case 'build':
        if (this.throttle('build', 120)) {
          this.tone(120, 0.18, 'triangle', 0.06, 70);
          this.noise(0.12, 0.03, 600);
        }
        break;
      case 'ready':
        this.tone(660, 0.18, 'sine', 0.045, 880);
        this.tone(990, 0.24, 'sine', 0.03, 990, 0.08);
        break;
      case 'age':
        this.tone(196, 0.5, 'sawtooth', 0.03, 392);
        this.tone(261, 0.7, 'triangle', 0.05, 523, 0.12);
        this.tone(329, 0.8, 'sine', 0.035, 659, 0.26);
        break;
      case 'victory':
        [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.9, 'triangle', 0.06, f, i * 0.16));
        break;
      case 'defeat':
        [330, 262, 196, 131].forEach((f, i) => this.tone(f, 0.7, 'sine', 0.06, f * 0.92, i * 0.22));
        break;
      case 'error':
        if (this.throttle('error', 180)) this.tone(120, 0.16, 'square', 0.025, 90);
        break;
      default:
        break;
    }
  }

  private startAmbient(): void {
    if (!this.ctx || !this.master || this.ambientStarted) return;
    this.ambientStarted = true;
    const ctx = this.ctx;
    const master = this.master;
    const drone = ctx.createOscillator();
    const droneGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    drone.type = 'sine';
    drone.frequency.value = 55;
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    droneGain.gain.value = 0.012;
    drone.connect(filter);
    filter.connect(droneGain);
    droneGain.connect(master);
    drone.start();
    const notes = [220, 246.94, 293.66, 329.63, 392];
    const tick = (): void => {
      if (!this.ctx || this.muted) return;
      const note = notes[Math.floor(Math.random() * notes.length)]!;
      this.tone(note, 2.8, 'triangle', 0.012, note, 0);
      window.setTimeout(tick, 6000 + Math.random() * 5000);
    };
    window.setTimeout(tick, 3500);
  }
}
