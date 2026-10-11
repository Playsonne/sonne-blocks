import { expect, it, vi } from 'vitest';
import { Haptics } from '../src/haptics';

it('solo vibra cuando se ha activado y la página está visible', () => {
  let enabled = false, visible = true;
  const vibrate = vi.fn(() => true);
  const haptics = new Haptics(() => enabled, { vibrate }, () => visible);
  expect(haptics.play('drop')).toBe(false); expect(vibrate).not.toHaveBeenCalled();
  enabled = true; haptics.play('drop'); expect(vibrate).toHaveBeenLastCalledWith(12);
  haptics.play('clear'); expect(vibrate).toHaveBeenLastCalledWith([18, 35, 24]);
  visible = false; expect(haptics.play('clear')).toBe(false); expect(vibrate).toHaveBeenCalledTimes(2);
  haptics.stop(); expect(vibrate).toHaveBeenLastCalledWith(0);
  haptics.stop(); expect(vibrate).toHaveBeenCalledTimes(3);
});
it('la ausencia, el rechazo o un error de la API no interrumpen el juego', () => {
  const absent = new Haptics(() => true, {}, () => true);
  expect(absent.supported).toBe(false); expect(absent.play('drop')).toBe(false);
  const denied = new Haptics(() => true, { vibrate: () => false }, () => true);
  expect(denied.play('drop')).toBe(false);
  const throwing = new Haptics(() => true, { vibrate() { throw Error('No disponible'); } }, () => true);
  expect(throwing.play('clear')).toBe(false); expect(() => throwing.stop()).not.toThrow();
});
