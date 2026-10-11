import { expect, it } from 'vitest';
import { formatDuration, readSessionStats } from '../src/session';
import { Game } from '../src/game/engine';

it.each([[0, '00:00'], [999, '00:00'], [125999, '02:05'], [3600000, '1:00:00'], [3661000, '1:01:01']])('formatea %i ms como %s', (ms, expected) => {
  expect(formatDuration(ms as number)).toBe(expected);
});
it('descarta solo los metadatos incompletos, inválidos o no finitos', () => {
  const stats = { playedMs: 1200.5, recordAtStart: 200, completeDuration: true };
  expect(readSessionStats(stats)).toEqual(stats);
  for (const value of [undefined, {}, null, { ...stats, playedMs: -1 }, { ...stats, playedMs: Infinity }, { ...stats, recordAtStart: 1.1 }, { ...stats, completeDuration: 'true' }]) {
    expect(readSessionStats(value)).toBeUndefined();
  }
});
it('cuenta solo tiempo activo, detiene el reloj al perder y reinicia en una nueva instancia', () => {
  const game = new Game();
  game.advance(1000); expect(game.elapsedMs).toBe(0);
  game.resume(); game.advance(1000); expect(game.elapsedMs).toBe(1000);
  game.pause(); game.advance(5000); expect(game.elapsedMs).toBe(1000);
  game.resume();
  game.state.active = { type: 'I', rotation: 0, x: 3, y: 0 };
  game.state.board[2][3] = 'T';
  game.advance(1000);
  expect(game.state.status).toBe('over'); expect(game.elapsedMs).toBe(1500);
  game.advance(1000); expect(game.elapsedMs).toBe(1500);
  expect(new Game().elapsedMs).toBe(0);
});
