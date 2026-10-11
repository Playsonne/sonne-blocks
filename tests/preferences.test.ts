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
it('recuerda la animación independientemente de vibración y controles, migrando los ajustes existentes', () => {
  const store = memory('{"version":1,"mode":"gestures","gesturesExplained":true,"vibration":true}');
  const prefs = new Preferences(store); expect(prefs.lineAnimation).toBe(true);
  expect(prefs.setLineAnimation(false)).toBe(true);
  const reloaded = new Preferences(store);
  expect(reloaded.lineAnimation).toBe(false); expect(reloaded.mode).toBe('gestures'); expect(reloaded.vibration).toBe(true);
  reloaded.set('buttons'); reloaded.setVibration(false); expect(new Preferences(store).lineAnimation).toBe(false);
  reloaded.setLineAnimation(true); expect(new Preferences(store).lineAnimation).toBe(true);
});
it('un ajuste de animación inválido usa el valor inicial y el almacenamiento bloqueado no impide cambiarlo', () => {
  expect(new Preferences(memory('{"version":1,"lineAnimation":"false"}')).lineAnimation).toBe(true);
  const prefs = new Preferences({ getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); } } as unknown as Storage);
  expect(prefs.setLineAnimation(false)).toBe(false); expect(prefs.lineAnimation).toBe(false);
});
it('sonido apagado de inicio, volumen moderado y preferencias independientes que sobreviven a recargas', () => {
  const store = memory('{"version":1,"mode":"gestures","gesturesExplained":true,"vibration":true,"lineAnimation":false}');
  const prefs = new Preferences(store); expect(prefs.sound).toBe(false); expect(prefs.soundVolume).toBe(.35);
  prefs.setSound(true); prefs.setSoundVolume(.6);
  const next = new Preferences(store); expect(next.sound).toBe(true); expect(next.soundVolume).toBe(.6);
  expect(next.mode).toBe('gestures'); expect(next.vibration).toBe(true); expect(next.lineAnimation).toBe(false);
  next.set('buttons'); next.setVibration(false); next.setLineAnimation(true);
  expect(new Preferences(store).sound).toBe(true); expect(new Preferences(store).soundVolume).toBe(.6);
  next.setSound(false); expect(new Preferences(store).soundVolume).toBe(.6);
});
it('valida volumen y funciona en memoria cuando no puede guardar el sonido', () => {
  for (const value of ['"0.5"', '-1', '2', 'null']) expect(new Preferences(memory(`{"version":1,"soundVolume":${value}}`)).soundVolume).toBe(.35);
  expect(new Preferences(memory('{"version":1,"sound":"true"}')).sound).toBe(false);
  const prefs = new Preferences({ getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); } } as unknown as Storage);
  expect(prefs.setSound(true)).toBe(false); expect(prefs.sound).toBe(true);
  expect(prefs.setSoundVolume(.8)).toBe(false); expect(prefs.soundVolume).toBe(.8);
  prefs.setSoundVolume(NaN); expect(prefs.soundVolume).toBe(.8);
  prefs.setSoundVolume(-1); expect(prefs.soundVolume).toBe(0);
  prefs.setSoundVolume(2); expect(prefs.soundVolume).toBe(1);
});
