export type ControlMode = 'buttons' | 'gestures';
export const PREFERENCES_KEY = 'sonne-blocks:controls:v1';
export class Preferences {
  mode: ControlMode = 'buttons';
  gesturesExplained = false;
  vibration = false;
  private storage?: Storage;
  constructor(storage?: Storage) {
    try {
      this.storage = storage ?? localStorage;
      const data = JSON.parse(this.storage.getItem(PREFERENCES_KEY) ?? 'null');
      if (data?.version === 1) this.vibration = data.vibration === true;
      if (data?.version === 1 && (data.mode === 'buttons' || data.mode === 'gestures') && typeof data.gesturesExplained === 'boolean') {
        this.gesturesExplained = data.gesturesExplained;
        // Never silently enter an unexplained mode after a partial/corrupt write.
        this.mode = data.mode === 'gestures' && !data.gesturesExplained ? 'buttons' : data.mode;
      }
    } catch { /* A missing or blocked store keeps the safe default. */ }
  }
  set(mode: ControlMode): boolean {
    this.mode = mode;
    if (mode === 'gestures') this.gesturesExplained = true;
    return this.save();
  }
  setVibration(enabled: boolean): boolean {
    this.vibration = enabled;
    return this.save();
  }
  private save(): boolean {
    try {
      if (!this.storage) return false;
      this.storage.setItem(PREFERENCES_KEY, JSON.stringify({ version: 1, mode: this.mode, gesturesExplained: this.gesturesExplained, vibration: this.vibration }));
      return true;
    } catch { return false; }
  }
}
