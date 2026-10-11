export type HapticEffect = 'drop' | 'clear';
// Milliseconds: short impact for a hard drop; two small pulses for cleared lines.
export const HAPTIC_PATTERNS = { drop: 12, clear: [18, 35, 24] };
type VibrationDevice = { vibrate?: (pattern: number | number[]) => boolean };

export class Haptics {
  private active = false;
  constructor(
    private enabled: () => boolean,
    private device: VibrationDevice = navigator,
    private visible: () => boolean = () => !document.hidden,
  ) {}
  get supported(): boolean { return typeof this.device.vibrate === 'function'; }
  play(effect: HapticEffect): boolean {
    if (!this.enabled() || !this.supported || !this.visible()) return false;
    try {
      this.active = this.device.vibrate!(HAPTIC_PATTERNS[effect]);
      return this.active;
    } catch { return false; }
  }
  stop(): void {
    if (!this.active) return;
    this.active = false;
    try { this.device.vibrate?.(0); } catch { /* Feedback must never interrupt a game. */ }
  }
}
