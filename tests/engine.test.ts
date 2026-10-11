import { describe, it, expect } from 'vitest';
import { Game, emptyBoard, collides, clearLines, LOCK_DELAY, MAX_LOCK_RESETS } from '../src/game/engine';
import { cells, shuffledBag, TYPES, type Piece, type PieceType } from '../src/game/pieces';

const playing = () => { const game = new Game(() => .4); game.resume(); return game; };
describe('colisiones', () => {
  it('impide atravesar los bordes, el suelo, el techo y otros bloques', () => {
    const board = emptyBoard();
    const p: Piece = { type: 'T', rotation: 0, x: 3, y: 2 };
    expect(collides(board, p)).toBe(false);
    for (const change of [{ x: -1 }, { x: 8 }, { y: -1 }, { y: 21 }]) expect(collides(board, { ...p, ...change })).toBe(true);
    board[3][4] = 'I'; expect(collides(board, p)).toBe(true);
  });
  it('la sombra coincide con la pieza tras la caída instantánea', () => {
    const game = playing(); const ghost = game.ghost();
    expect(collides(game.state.board, ghost)).toBe(false);
    expect(collides(game.state.board, { ...ghost, y: ghost.y + 1 })).toBe(true);
    game.act('drop');
    for (const [x, y] of cells(ghost)) expect(game.state.board[y][x]).toBe(ghost.type);
  });
});
describe('giros SRS', () => {
  it.each(TYPES)('cuatro giros restauran la forma y posición de %s en espacio libre', type => {
    const game = playing(); game.state.active = { type, x: 3, y: 5, rotation: 0 };
    const before = cells(game.state.active).sort().toString();
    for (let i = 0; i < 4; i++) game.act('cw');
    expect(cells(game.state.active).sort().toString()).toBe(before);
  });
  it('ajusta T junto a la pared izquierda y gira en ambos sentidos', () => {
    const game = playing(); game.state.active = { type: 'T', rotation: 1, x: -1, y: 6 };
    expect(game.act('ccw')).toBe(true); expect(game.state.active).toMatchObject({ rotation: 0, x: 0, y: 6 });
    game.act('cw'); expect(game.state.active.rotation).toBe(1);
  });
  it('aplica el ajuste específico de I junto a la pared derecha', () => {
    const game = playing(); game.state.active = { type: 'I', rotation: 3, x: 8, y: 5 };
    expect(game.act('cw')).toBe(true); expect(game.state.active).toMatchObject({ rotation: 0, x: 6 });
  });
  it('levanta una T que gira sobre el suelo', () => {
    const game = playing(); game.state.active = { type: 'T', rotation: 0, x: 3, y: 20 };
    expect(game.act('cw')).toBe(true); expect(game.state.active.y).toBe(19);
    expect(collides(game.state.board, game.state.active)).toBe(false);
  });
  it('prueba ajustes junto a bloques y rechaza un giro sin espacio', () => {
    const game = playing(); game.state.active = { type: 'T', rotation: 0, x: 3, y: 6 };
    game.state.board[8][4] = 'J'; expect(game.act('cw')).toBe(true); expect(game.state.active.x).toBe(2);
    const trapped = playing(); trapped.state.board = emptyBoard().map(row => row.map(() => 'J'));
    trapped.state.active = { type: 'T', rotation: 0, x: 3, y: 6 };
    for (const [x, y] of cells(trapped.state.active)) trapped.state.board[y][x] = null;
    const before = trapped.snapshot().active; expect(trapped.act('cw')).toBe(false); expect(trapped.state.active).toEqual(before);
  });
});
describe('líneas, nivel y bolsa', () => {
  it.each([1, 2, 3, 4])('elimina %i filas a la vez y desplaza las superiores', count => {
    const board = emptyBoard(); board[5][0] = 'T';
    for (let i = 0; i < count; i++) board[21 - i].fill('I');
    const result = clearLines(board); expect(result.cleared).toBe(count); expect(result.board).toHaveLength(22);
    expect(result.board[5 + count][0]).toBe('T'); expect(result.board[0].every(c => c === null)).toBe(true);
  });
  it('puntúa cuatro líneas y sube de nivel al llegar a diez', () => {
    const game = playing(); game.state.lines = 6;
    for (let y = 18; y < 22; y++) game.state.board[y] = Array.from({ length: 10 }, (_, x) => x === 5 ? null : 'J');
    game.state.active = { type: 'I', rotation: 1, x: 3, y: 18 };
    game.act('drop'); expect(game.state.lines).toBe(10); expect(game.state.level).toBe(2); expect(game.state.score).toBe(800);
  });
  it('cada bolsa contiene exactamente las siete piezas', () => {
    for (let i = 0; i < 100; i++) expect(shuffledBag().sort()).toEqual([...TYPES].sort());
    expect(shuffledBag(() => 0)).not.toEqual(shuffledBag(() => .9999));
  });
  it('el flujo de piezas conserva las bolsas incluso al rellenarlas', () => {
    const game = playing(); const sequence: PieceType[] = [];
    for (let i = 0; i < 28; i++) { sequence.push(game.state.active.type); game.act('drop'); game.state.board = emptyBoard(); }
    for (let i = 0; i < sequence.length; i += 7) expect(sequence.slice(i, i + 7).sort()).toEqual([...TYPES].sort());
  });
});
describe('reserva y fin de partida', () => {
  it('permite una reserva por pieza y restablece el permiso tras fijar', () => {
    const game = playing(); const first = game.state.active.type; const next = game.state.next;
    expect(game.act('hold')).toBe(true); expect(game.state.hold).toBe(first); expect(game.state.active.type).toBe(next);
    const saved = game.snapshot(); expect(game.act('hold')).toBe(false); expect(game.snapshot()).toEqual(saved);
    game.act('drop'); expect(game.state.holdUsed).toBe(false);
    const queued = game.state.next; game.act('hold'); expect(game.state.active.type).toBe(first); expect(game.state.next).toBe(queued);
  });
  it('termina si la reserva no puede entrar, sin sobrescribir el tablero', () => {
    const game = playing(); game.state.active.y = 10; game.state.board[2].fill('J');
    const board = structuredClone(game.state.board); game.act('hold');
    expect(game.state.status).toBe('over'); expect(game.state.board).toEqual(board);
  });
  it('termina cuando una pieza se fija completamente sobre la zona visible', () => {
    const game = playing(); game.state.active = { type: 'I', rotation: 0, x: 3, y: 0 };
    game.state.board[2][3] = 'T'; game.act('drop'); expect(game.state.status).toBe('over');
  });
});
describe('tiempo, fijación y pausa', () => {
  it('produce el mismo resultado a 30, 60 y 144 FPS', () => {
    const snapshots = [30, 60, 144].map(fps => {
      const game = playing(); for (let i = 0; i < fps * 4; i++) game.advance(1000 / fps);
      return game.snapshot();
    });
    for (const s of snapshots) { expect(s.active).toEqual(snapshots[0].active); expect(s.gravityMs).toBeCloseTo(snapshots[0].gravityMs, 6); }
  });
  it('espera 500 ms antes de fijar y limita a 15 los reinicios', () => {
    const game = playing(); game.state.active = { type: 'O', rotation: 0, x: 3, y: 20 };
    game.advance(499); expect(game.locks).toBe(0);
    for (let i = 0; i < MAX_LOCK_RESETS; i++) { game.act(i % 2 ? 'right' : 'left'); game.advance(400); }
    expect(game.state.lockResets).toBe(15); game.act('right'); game.advance(100);
    expect(game.locks).toBe(1);
  });
  it('un movimiento bloqueado no reinicia el margen de fijación', () => {
    const game = playing(); game.state.active = { type: 'O', rotation: 0, x: -1, y: 20 };
    game.advance(400); expect(game.act('left')).toBe(false); game.advance(LOCK_DELAY - 400); expect(game.locks).toBe(1);
  });
  it('ni el tiempo ni los controles avanzan una partida en pausa', () => {
    const game = playing(); game.advance(320); game.pause(); const before = game.snapshot();
    game.advance(5000); game.act('drop'); expect(game.snapshot()).toEqual(before);
    game.resume(); game.advance(100); expect(game.state.active).toEqual(before.active);
  });
});
