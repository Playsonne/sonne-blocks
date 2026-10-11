import { expect, it, vi } from 'vitest';
import { Sound } from '../src/sound';

function rig(initial = 'running') {
  let enabled = true, visible = true, volume = .35;
  const param = () => ({ setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() });
  const gains: any[] = [], oscillators: any[] = [];
  const context = {
    state: initial, currentTime: 10, destination: {},
    createGain: vi.fn(() => { const node = { gain: param(), connect: vi.fn(), disconnect: vi.fn() }; gains.push(node); return node; }),
    createOscillator: vi.fn(() => { const node = { frequency: param(), type: '', connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null }; oscillators.push(node); return node; }),
    resume: vi.fn(async () => { context.state = 'running'; }),
    addEventListener: vi.fn(),
  };
  const factory = vi.fn(() => context as unknown as AudioContext);
  const sound = new Sound(() => enabled, () => volume, factory, () => visible);
  return { sound, context, factory, gains, oscillators, enable: (value: boolean) => { enabled = value; }, visible: (value: boolean) => { visible = value; }, volume: (value: number) => { volume = value; } };
}

it('no crea audio al cargar, estando desactivado o sin interacción explícita', async () => {
  const r = rig(); expect(r.factory).not.toHaveBeenCalled();
  expect(r.sound.play('clear')).toBe(false); expect(r.factory).not.toHaveBeenCalled();
  r.enable(false); expect(await r.sound.activate()).toBe(false); expect(r.factory).not.toHaveBeenCalled();
  r.enable(true); expect(await r.sound.activate()).toBe(true);
  expect(await r.sound.activate()).toBe(true); expect(r.factory).toHaveBeenCalledTimes(1);
});
it('caída corta con envolvente sin saltos, y limpieza al terminar', async () => {
  const r = rig(); await r.sound.activate(); expect(r.sound.play('drop')).toBe(true);
  expect(r.oscillators).toHaveLength(1);
  const oscillator = r.oscillators[0], gain = r.gains[1].gain;
  expect(oscillator.frequency.exponentialRampToValueAtTime.mock.calls[0][0]).toBeLessThan(oscillator.frequency.setValueAtTime.mock.calls[0][0]);
  expect(oscillator.stop.mock.calls[0][0] - oscillator.start.mock.calls[0][0]).toBeLessThan(.12);
  expect(gain.setValueAtTime.mock.calls[0][0]).toBe(0);
  expect(gain.linearRampToValueAtTime).toHaveBeenCalled();
  expect(gain.setValueAtTime.mock.calls.at(-1)[0]).toBe(0);
  oscillator.onended(); expect(oscillator.disconnect).toHaveBeenCalled();
  r.sound.stop(); expect(oscillator.stop).toHaveBeenCalledTimes(1);
});
it.each([1, 2, 3, 4])('%s filas tienen su acorde, con voces y amplitud limitadas', async lines => {
  const r = rig(); await r.sound.activate(); r.sound.play('clear', lines);
  expect(r.oscillators).toHaveLength(lines);
  const frequencies = r.oscillators.map(o => o.frequency.setValueAtTime.mock.calls[0][0]);
  expect(new Set(frequencies).size).toBe(lines);
  const totalAmplitude = r.gains.slice(1).reduce((total, g) => total + g.gain.linearRampToValueAtTime.mock.calls[0][0], 0);
  expect(totalAmplitude).toBeLessThan(.5);
  expect(r.oscillators.at(-1).stop.mock.calls[0][0] - 10).toBeLessThan(.4);
});
it('cada evento sustituye al anterior; fin de partida son dos notas descendentes', async () => {
  const r = rig(); await r.sound.activate(); r.sound.play('clear', 4);
  const old = [...r.oscillators]; r.sound.play('over');
  for (const o of old) { expect(o.stop).toHaveBeenLastCalledWith(); expect(o.disconnect).toHaveBeenCalledTimes(1); }
  const end = r.oscillators.slice(4); expect(end).toHaveLength(2);
  expect(end[1].frequency.setValueAtTime.mock.calls[0][0]).toBeLessThan(end[0].frequency.setValueAtTime.mock.calls[0][0]);
  expect(end[1].start.mock.calls[0][0]).toBeGreaterThan(end[0].start.mock.calls[0][0]);
  r.sound.stop(); r.sound.stop(); expect(end[1].disconnect).toHaveBeenCalledTimes(1);
});
it('actualiza volumen, silencia a cero y bloquea sonidos desactivados u ocultos', async () => {
  const r = rig(); await r.sound.activate(); r.sound.play('clear', 4);
  r.volume(.2); r.sound.updateVolume(); expect(r.gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(.2, 10, .015);
  r.volume(0); r.sound.updateVolume(); expect(r.oscillators.every(o => o.disconnect.mock.calls.length === 1)).toBe(true);
  expect(r.sound.play('drop')).toBe(false);
  r.volume(.35); r.visible(false); expect(r.sound.play('drop')).toBe(false); expect(await r.sound.activate()).toBe(false);
  r.visible(true); r.enable(false); expect(r.sound.play('drop')).toBe(false);
});
it('una reanudación pendiente nunca reproduce una prueba después de cancelar', async () => {
  const r = rig('suspended'); let resume!: () => void;
  r.context.resume.mockImplementation(() => new Promise<void>(resolve => { resume = () => { r.context.state = 'running'; resolve(); }; }));
  const preview = r.sound.preview(); r.sound.stop(); resume();
  expect(await preview).toBe(false); expect(r.oscillators).toHaveLength(0);
  expect(await r.sound.preview()).toBe(true); expect(r.oscillators).toHaveLength(4);
});
it('una interrupción cancela las voces y no acumula sonidos al volver', async () => {
  const r = rig(); await r.sound.activate(); r.sound.play('clear', 4);
  r.context.state = 'suspended'; r.context.addEventListener.mock.calls[0][1]();
  expect(r.oscillators.every(o => o.disconnect.mock.calls.length === 1)).toBe(true);
  expect(r.sound.play('drop')).toBe(false); await r.sound.activate();
  expect(r.oscillators).toHaveLength(4); r.sound.play('drop'); expect(r.oscillators).toHaveLength(5);
});
it('API ausente, creación fallida, permiso rechazado y errores de síntesis no interrumpen el juego', async () => {
  const absent = new Sound(() => true, () => .35, undefined, () => true);
  expect(absent.supported).toBe(false); expect(await absent.activate()).toBe(false);
  const failed = new Sound(() => true, () => .35, () => { throw Error('unavailable'); }, () => true);
  expect(await failed.activate()).toBe(false);
  const r = rig('suspended'); r.context.resume.mockRejectedValue(Error('denied'));
  expect(await r.sound.preview()).toBe(false); expect(r.oscillators).toHaveLength(0);
  r.context.state = 'running'; r.context.createOscillator.mockImplementation(() => { throw Error('device lost'); });
  expect(r.sound.play('drop')).toBe(false); expect(() => r.sound.stop()).not.toThrow();
});
