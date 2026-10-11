import { describe, it, expect } from 'vitest';
import { Game } from '../src/game/engine';
import { Persistence, SAVE_KEY, RECORD_KEY, validState } from '../src/persistence';
class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
describe('guardado versionado', () => {
  it('guarda el tiempo y el récord inicial con la partida y recupera sin pérdidas', () => {
    const memory = new MemoryStorage(), store = new Persistence(memory);
    const game = new Game(); game.resume(); game.advance(450);
    const session = { playedMs: game.elapsedMs, recordAtStart: 100, completeDuration: true };
    store.save(game.snapshot(), session);
    const reloaded = new Persistence(memory);
    expect(reloaded.load()).toEqual({ ...game.snapshot(), status: 'paused' });
    expect(reloaded.session).toEqual(session);
    const restoredGame = new Game(Math.random, reloaded.load());
    restoredGame.resume(); restoredGame.advance(200);
    reloaded.save(restoredGame.snapshot(), { ...session, playedMs: session.playedMs + restoredGame.elapsedMs });
    reloaded.load(); expect(reloaded.session?.playedMs).toBe(650);
  });
  it.each([undefined, { playedMs: -5 }, { playedMs: 100, recordAtStart: null, completeDuration: true }])('los metadatos ausentes o dañados no descartan una partida válida: %j', session => {
    const memory = new MemoryStorage(), game = new Game();
    memory.setItem(SAVE_KEY, JSON.stringify({ version: 1, state: game.snapshot(), session }));
    const store = new Persistence(memory);
    expect(store.load()).toEqual(game.snapshot()); expect(store.session).toBeUndefined(); expect(store.corrupted).toBe(false);
  });
  it('recupera tablero, temporizadores, reserva, siguiente y bolsa, siempre en pausa', () => {
    const store = new Persistence(new MemoryStorage()); const game = new Game(); game.resume();
    game.act('hold'); game.act('drop'); game.act('left'); game.advance(311); store.save(game.snapshot());
    const loaded = store.load()!; expect(loaded).toEqual({ ...game.snapshot(), status: 'paused' });
    const restored = new Game(Math.random, loaded); restored.resume();
    game.act('drop'); restored.act('drop'); expect(restored.snapshot()).toEqual(game.snapshot());
  });
  it.each(['malformed', '{', '{"version":99,"state":{}}', 'null'])('ignora un guardado dañado: %s', raw => {
    const memory = new MemoryStorage(); memory.setItem(SAVE_KEY, raw); memory.setItem(RECORD_KEY, '{"version":1,"score":456}');
    const store = new Persistence(memory); expect(store.load()).toBeUndefined(); expect(store.corrupted).toBe(true); expect(store.record()).toBe(456);
  });
  it('rechaza dimensiones, coordenadas, piezas, bolsa y contadores incoherentes', () => {
    const base = new Game().snapshot();
    const changes = [ { board: [] }, { active: { ...base.active, x: 99 } }, { active: { ...base.active, rotation: 9 } }, { next: 'Q' }, { bag: ['I', 'I'] }, { score: -1 }, { score: null }, { lines: 10, level: 1 }, { lockMs: 500 }, { gravityMs: -1 }, { lockResets: 16 }, { holdUsed: true, hold: null }, { status: 'over' } ];
    for (const change of changes) expect(validState({ ...base, ...change })).toBe(false);
    expect(validState(base)).toBe(true);
  });
  it('permite jugar si el almacenamiento lanza errores', () => {
    const broken = { getItem() { throw new Error('Bloqueado'); }, setItem() { throw new Error('Cuota'); }, removeItem() { throw new Error('Bloqueado'); } } as unknown as Storage;
    const store = new Persistence(broken); expect(store.load()).toBeUndefined(); expect(store.record()).toBe(0);
    expect(() => { store.save(new Game().snapshot()); store.setRecord(100); store.clear(); }).not.toThrow(); expect(store.available).toBe(false);
  });
  it('borra solo la partida al terminar, conservando el récord', () => {
    const store = new Persistence(new MemoryStorage()); const game = new Game(); store.setRecord(999); store.save(game.snapshot());
    game.state.status = 'over'; store.save(game.snapshot()); expect(store.load()).toBeUndefined(); expect(store.record()).toBe(999);
  });
});
