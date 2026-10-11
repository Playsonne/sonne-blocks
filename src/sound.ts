export type SoundEffect = 'drop' | 'clear' | 'over';
type AudioFactory = () => AudioContext;
type Voice = { oscillator: OscillatorNode; gain: GainNode };
type Tone = { frequency: number; endFrequency?: number; delay: number; duration: number; gain: number; type: OscillatorType };

function browserAudio(): AudioFactory | undefined {
  const Audio = globalThis.AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Audio ? () => new Audio({ latencyHint: 'interactive' }) : undefined;
}

// Short original tones, synthesized locally. At most four voices and no audio files.
function tones(effect: SoundEffect, lines: number): Tone[] {
  if (effect === 'drop') return [{ frequency: 170, endFrequency: 65, delay: 0, duration: .095, gain: .3, type: 'triangle' }];
  if (effect === 'over') return [392, 293.66].map((frequency, i) => ({ frequency, delay: i * .17, duration: .22, gain: .18, type: 'sine' }));
  const notes = [[659.25], [659.25, 830.61], [659.25, 830.61, 987.77], [523.25, 659.25, 783.99, 1046.5]][Math.max(1, Math.min(4, lines)) - 1];
  return notes.map((frequency, i) => ({ frequency, delay: i * .035, duration: .26, gain: .24 / Math.sqrt(notes.length), type: 'sine' }));
}

export class Sound {
  private context?: AudioContext;
  private master?: GainNode;
  private voices = new Set<Voice>();
  private generation = 0;
  constructor(
    private enabled: () => boolean,
    private volume: () => number,
    private factory: AudioFactory | undefined = browserAudio(),
    private visible: () => boolean = () => !document.hidden,
  ) {}
  get supported(): boolean { return !!this.factory; }

  /** Called only by explicit activation/start/continue/test controls, never on load. */
  async activate(): Promise<boolean> {
    if (!this.enabled() || !this.visible() || !this.factory) return false;
    const generation = this.generation;
    try {
      if (!this.context || this.context.state === 'closed') {
        const context = this.factory();
        this.context = context;
        this.master = context.createGain();
        this.master.connect(context.destination);
        this.master.gain.setValueAtTime(this.volume(), context.currentTime);
        context.addEventListener('statechange', () => {
          if (context === this.context && context.state !== 'running') this.stop();
        });
      }
      if (this.context.state !== 'running') await this.context.resume();
      return generation === this.generation && this.enabled() && this.visible() && this.context.state === 'running';
    } catch { return false; }
  }

  async preview(): Promise<boolean> {
    this.stop();
    const generation = this.generation;
    if (!await this.activate() || generation !== this.generation) return false;
    return this.play('clear', 4);
  }

  play(effect: SoundEffect, lines = 1): boolean {
    // Replace the previous sound; never queue game events waiting for audio permission.
    this.stop();
    const context = this.context, master = this.master;
    if (!this.enabled() || !this.visible() || this.volume() <= 0 || context?.state !== 'running' || !master) return false;
    try {
      const now = context.currentTime + .005;
      for (const tone of tones(effect, lines)) {
        const voice = { oscillator: context.createOscillator(), gain: context.createGain() };
        this.voices.add(voice);
        const { oscillator, gain } = voice;
        const start = now + tone.delay, end = start + tone.duration;
        oscillator.type = tone.type;
        oscillator.frequency.setValueAtTime(tone.frequency, start);
        if (tone.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequency, end);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(tone.gain, start + .008);
        gain.gain.exponentialRampToValueAtTime(.0001, end);
        gain.gain.setValueAtTime(0, end + .005);
        oscillator.connect(gain); gain.connect(master);
        oscillator.onended = () => this.release(voice);
        oscillator.start(start); oscillator.stop(end + .01);
      }
      return true;
    } catch { this.stop(); return false; }
  }

  updateVolume(): void {
    if (this.volume() <= 0) this.stop();
    try {
      if (this.context && this.master) {
        this.master.gain.cancelScheduledValues(this.context.currentTime);
        this.master.gain.setTargetAtTime(this.volume(), this.context.currentTime, .015);
      }
    } catch { this.stop(); }
  }

  stop(): void {
    this.generation++;
    for (const voice of this.voices) {
      try { voice.oscillator.stop(); } catch { /* Already ended or interrupted. */ }
      this.release(voice);
    }
  }
  private release(voice: Voice): void {
    voice.oscillator.onended = null;
    try { voice.oscillator.disconnect(); voice.gain.disconnect(); } catch { /* Audio must never interrupt play. */ }
    this.voices.delete(voice);
  }
}
