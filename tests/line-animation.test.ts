import { expect, it } from 'vitest';
import { LineAnimation, LINE_ANIMATION_MS } from '../src/line-animation';
import { clearLines, emptyBoard, Game, type ClearedRow } from '../src/game/engine';

it('captura las filas originales, aunque no sean consecutivas, con sus colores antes del desplazamiento', () => {
  const board = emptyBoard(); board[17].fill('J'); board[21].fill('I'); board[16][0] = 'T';
  const result = clearLines(board);
  expect(result.rows).toEqual([{ index: 17, cells: Array(10).fill('J') }, { index: 21, cells: Array(10).fill('I') }]);
  expect(result.cleared).toBe(2); expect(result.board[18][0]).toBe('T');
  board[21][0] = 'Z'; expect(result.rows[1].cells[0]).toBe('I');
});
it('el efecto dura 520 ms, solo incluye filas visibles y no conserva referencias al tablero', () => {
  const effect = new LineAnimation();
  const rows: ClearedRow[] = [1, 18, 19, 20, 21].map(index => ({ index, cells: Array(10).fill('I') }));
  effect.start(rows, 1000); rows[1].cells[0] = 'Z';
  expect(effect.sample(1000)?.rows.map(row => row.index)).toEqual([18, 19, 20, 21]);
  expect(effect.sample(1000)?.rows[0].cells[0]).toBe('I');
  expect(effect.sample(1260)?.progress).toBe(.5);
  expect(effect.sample(1000 + LINE_ANIMATION_MS)).toBeUndefined();
  expect(effect.sample(1100)).toBeUndefined();
});
it('una nueva eliminación sustituye el efecto anterior; cancelar o no eliminar nada lo vacía', () => {
  const effect = new LineAnimation();
  effect.start([{ index: 21, cells: Array(10).fill('J') }], 0);
  effect.start([{ index: 17, cells: Array(10).fill('T') }], 100);
  expect(effect.sample(100)?.rows.map(row => row.index)).toEqual([17]);
  expect(effect.sample(100)?.progress).toBe(0);
  effect.cancel(); expect(effect.sample(110)).toBeUndefined();
  effect.start([], 120); expect(effect.sample(121)).toBeUndefined();
});
it('el motor elimina y puntúa inmediatamente; una nueva pieza no hereda las filas del evento anterior', () => {
  const game = new Game(); game.resume();
  game.state.active = { type: 'I', rotation: 1, x: 3, y: 18 };
  for (let y = 18; y < 22; y++) game.state.board[y] = Array.from({ length: 10 }, (_, x) => x === 5 ? null : 'J');
  game.act('drop');
  expect(game.state.lines).toBe(4); expect(game.state.score).toBe(800);
  expect(game.state.board.flat().every(cell => cell === null)).toBe(true);
  expect(game.lastClearedRows).toHaveLength(4); expect(game.lastClearedRows[0].cells[5]).toBe('I');
  expect(game.snapshot()).not.toHaveProperty('lastClearedRows');
  game.act('drop'); expect(game.lastClearedRows).toEqual([]);
  expect(game.state.lines).toBe(4); expect(game.locks).toBe(2);
});
