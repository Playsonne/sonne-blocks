import { it, expect } from 'vitest';
import { Preferences, PREFERENCES_KEY } from '../src/preferences';

function memory(raw: string | null = null) {
  const values = new Map(raw === null ? [] : [[PREFERENCES_KEY, raw]]);
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } } as Storage;
}
it('empieza con Botones, conserva el modo y no repite la explicación ya aceptada', () => {
  const store = memory(), prefs = new Preferences(store);
  expect(prefs.mode).toBe('buttons'); expect(prefs.gesturesExplained).toBe(false);
  expect(prefs.set('gestures')).toBe(true);
  const reloaded = new Preferences(store); expect(reloaded.mode).toBe('gestures'); expect(reloaded.gesturesExplained).toBe(true);
  reloaded.set('buttons'); const again = new Preferences(store);
  expect(again.mode).toBe('buttons'); expect(again.gesturesExplained).toBe(true);
});
it.each(['{', 'null', '{"version":2,"mode":"gestures","gesturesExplained":true}', '{"version":1,"mode":"invalid","gesturesExplained":true}', '{"version":1,"mode":"gestures","gesturesExplained":false}'])('preferencia incompleta o dañada conserva Botones: %s', raw => {
  expect(new Preferences(memory(raw)).mode).toBe('buttons');
});
it('almacenamiento bloqueado mantiene el modo en memoria e informa del fallo', () => {
  const prefs = new Preferences({ getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); } } as unknown as Storage);
  expect(prefs.mode).toBe('buttons'); expect(prefs.set('gestures')).toBe(false); expect(prefs.mode).toBe('gestures');
  expect(prefs.setVibration(true)).toBe(false); expect(prefs.vibration).toBe(true);
});
it('la vibración es opcional, migra preferencias antiguas y no cambia el modo de control', () => {
  const store = memory('{"version":1,"mode":"gestures","gesturesExplained":true}');
  const prefs = new Preferences(store); expect(prefs.vibration).toBe(false);
  expect(prefs.setVibration(true)).toBe(true);
  const reloaded = new Preferences(store);
  expect(reloaded.vibration).toBe(true); expect(reloaded.mode).toBe('gestures');
  reloaded.set('buttons'); expect(new Preferences(store).vibration).toBe(true);
  reloaded.setVibration(false); expect(new Preferences(store).vibration).toBe(false);
  expect(new Preferences(memory('{"version":1,"vibration":"true"}')).vibration).toBe(false);
});
