import { describe, it, expect } from 'vitest';
import { GestureRecognizer, gestureThresholds } from '../src/gestures';
import { Game, type Action } from '../src/game/engine';

function setup(width = 300) {
  const actions: Action[] = [];
  let enabled = true, piece = 0;
  const gesture = new GestureRecognizer({ act: a => actions.push(a), enabled: () => enabled, piece: () => piece });
  const start = (x = width / 2, y = 100) => gesture.begin({ x, y, time: 0 }, { left: 0, width });
  const move = (x: number, y = 100, time = 50) => gesture.move({ x, y, time });
  const end = (x: number, y = 100, time = 100) => gesture.end({ x, y, time });
  return { gesture, actions, start, move, end, replace: () => piece++, disable: () => { enabled = false; } };
}
describe('reconocimiento de gestos', () => {
  it.each([200, 300, 400])('umbrales proporcionales y primer paso inmediato, tablero %i px', width => {
    const h = setup(width), l = gestureThresholds(width), x = width / 2;
    h.start(); h.move(x + l.axisDistance - .01); expect(h.actions).toEqual([]);
    h.move(x + l.axisDistance); expect(h.actions).toEqual(['right']);
    h.move(x + l.axisDistance + l.cell * 2); expect(h.actions).toEqual(['right', 'right', 'right']);
  });
  it('permite cambiar de dirección sin levantar el dedo ni girar al soltar', () => {
    const h = setup(); h.start(); h.move(195); h.move(130); h.end(130);
    expect(h.actions).toEqual(['right', 'right', 'left', 'left']);
  });
  it.each([[75, 'ccw'], [225, 'cw']] as const)('toque breve en %i gira una sola vez hacia %s', (x, action) => {
    const h = setup(); h.start(x); h.end(x + 2, 102, 250); h.end(x, 100, 260);
    expect(h.actions).toEqual([action]);
  });
  it('un toque largo o con recorrido de ida y vuelta no gira', () => {
    const h = setup(); h.start(); h.end(150, 100, 251); expect(h.actions).toEqual([]);
    h.start(); h.move(159, 109); h.end(150); expect(h.actions).toEqual([]);
  });
  it('el límite de tolerancia del toque acepta ruido, pero no un arrastre ambiguo', () => {
    const h = setup(), slop = gestureThresholds(300).tapSlop;
    h.start(); h.end(150 + slop); expect(h.actions).toEqual(['cw']);
    h.actions.length = 0; h.start(); h.end(150 + slop + .01); expect(h.actions).toEqual([]);
  });
  it('bloquea el eje horizontal: un descenso posterior no deja caer', () => {
    const h = setup(); h.start(); h.move(170); h.end(170, 350, 150);
    expect(h.actions).toEqual(['right']);
  });
  it('descenso lento por casillas y reversión vertical sin movimientos ascendentes ni caída instantánea', () => {
    const h = setup(); h.start(); h.move(150, 141, 300); h.move(150, 120, 400); h.end(150, 151, 600);
    expect(h.actions).toEqual(['down', 'down', 'down']);
  });
  it('una caída rápida solo se ejecuta al soltar y solo una vez', () => {
    const h = setup(); h.start(); h.move(150, 220, 80); expect(h.actions).not.toContain('drop');
    h.end(150, 220, 100); h.end(150, 220, 101);
    expect(h.actions.filter(a => a === 'drop')).toHaveLength(1);
    expect(h.actions.at(-1)).toBe('drop');
  });
  it.each([
    ['corto', 150, 189, 50], ['lento', 150, 190, 121], ['largo en tiempo', 150, 400, 301],
    ['diagonal', 210, 220, 100], ['hacia arriba', 150, 0, 80],
  ])('rechaza caída instantánea: %s', (_name, x, y, time) => {
    const h = setup(); h.start(); h.end(x as number, y as number, time as number);
    expect(h.actions).not.toContain('drop'); expect(h.actions).not.toContain('cw'); expect(h.actions).not.toContain('ccw');
  });
  it('acepta el límite de velocidad y distancia, rechaza desvíos y retrocesos en el recorrido', () => {
    const h = setup(); h.start(); h.end(150, 190, 120); expect(h.actions.at(-1)).toBe('drop');
    h.actions.length = 0; h.start(); h.move(180, 160, 50); h.end(150, 220, 100); expect(h.actions).not.toContain('drop');
    h.actions.length = 0; h.start(); h.move(150, 220, 50); h.move(150, 190, 70); h.end(150, 230, 100); expect(h.actions).not.toContain('drop');
  });
  it.each(['cancel', 'replace', 'disable'] as const)('%s impide acciones del contacto anterior', mode => {
    const h = setup(); h.start(); h.move(170);
    if (mode === 'cancel') h.gesture.cancel(); else h[mode]();
    h.move(260, 300); h.end(260, 400); expect(h.actions).toEqual(['right']);
  });
  it('cancelar dentro de una acción interrumpe los pasos acumulados del mismo evento', () => {
    const actions: Action[] = [];
    const gesture = new GestureRecognizer({ act: a => { actions.push(a); gesture.cancel(); }, enabled: () => true, piece: () => 1 });
    gesture.begin({ x: 0, y: 0, time: 0 }, { left: 0, width: 300 });
    gesture.move({ x: 180, y: 0, time: 50 }); expect(actions).toEqual(['right']);
  });
  it('la fijación por gravedad cancela el arrastre y exige otro contacto para la pieza siguiente', () => {
    const game = new Game(() => .4); game.resume();
    game.state.active = game.ghost();
    const gesture = new GestureRecognizer({ act: a => { game.act(a); }, enabled: () => true, piece: () => `${game.locks}:${game.state.holdUsed}` });
    gesture.begin({ x: 150, y: 100, time: 0 }, { left: 0, width: 300 });
    game.advance(500); expect(game.locks).toBe(1);
    const next = game.snapshot();
    gesture.move({ x: 240, y: 100, time: 50 }); gesture.end({ x: 240, y: 300, time: 100 });
    expect(game.snapshot()).toEqual(next);
    gesture.begin({ x: 150, y: 100, time: 200 }, { left: 0, width: 300 });
    gesture.move({ x: 170, y: 100, time: 220 }); expect(game.state.active.x).toBe(next.active.x + 1);
  });
  it('una reserva externa tampoco permite actuar sobre la pieza intercambiada', () => {
    const game = new Game(() => .4); game.resume();
    const gesture = new GestureRecognizer({ act: a => { game.act(a); }, enabled: () => true, piece: () => `${game.locks}:${game.state.holdUsed}` });
    gesture.begin({ x: 150, y: 100, time: 0 }, { left: 0, width: 300 });
    game.act('hold'); const next = game.snapshot();
    gesture.end({ x: 150, y: 300, time: 100 }); expect(game.snapshot()).toEqual(next);
  });
});
