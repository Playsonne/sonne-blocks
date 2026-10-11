export type ControlMode = 'buttons' | 'gestures';
export const PREFERENCES_KEY = 'sonne-blocks:controls:v1';
export class Preferences {
  mode: ControlMode = 'buttons';
  gesturesExplained = false;
  vibration = false;
  lineAnimation = true;
  sound = false;
  soundVolume = .35;
  private storage?: Storage;
  constructor(storage?: Storage) {
    try {
      this.storage = storage ?? localStorage;
      const data = JSON.parse(this.storage.getItem(PREFERENCES_KEY) ?? 'null');
      if (data?.version === 1) this.vibration = data.vibration === true;
      if (data?.version === 1) this.sound = data.sound === true;
      if (data?.version === 1 && typeof data.soundVolume === 'number' && Number.isFinite(data.soundVolume) && data.soundVolume >= 0 && data.soundVolume <= 1) this.soundVolume = data.soundVolume;
      if (data?.version === 1 && typeof data.lineAnimation === 'boolean') this.lineAnimation = data.lineAnimation;
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
  setLineAnimation(enabled: boolean): boolean {
    this.lineAnimation = enabled;
    return this.save();
  }
  setSound(enabled: boolean): boolean {
    this.sound = enabled;
    return this.save();
  }
  setSoundVolume(volume: number): boolean {
    if (Number.isFinite(volume)) this.soundVolume = Math.max(0, Math.min(1, volume));
    return this.save();
  }
  private save(): boolean {
    try {
      if (!this.storage) return false;
      this.storage.setItem(PREFERENCES_KEY, JSON.stringify({ version: 1, mode: this.mode, gesturesExplained: this.gesturesExplained, vibration: this.vibration, lineAnimation: this.lineAnimation, sound: this.sound, soundVolume: this.soundVolume }));
      return true;
    } catch { return false; }
  }
}
