import type { Action } from './game/engine';

type Point = { x: number; y: number; time: number };
type Bounds = { left: number; width: number };
type Callbacks = { act: (action: Action) => void; enabled: () => boolean; piece: () => unknown };

/** CSS pixels and milliseconds. Keep docs/GESTOS.md in sync when tuning. */
export function gestureThresholds(width: number) {
  const cell = width / 10;
  return {
    cell, tapSlop: Math.max(6, Math.min(10, cell * .25)), tapMs: 250,
    axisDistance: Math.max(8, Math.min(14, cell * .35)), axisRatio: 1.5,
    dropDistance: Math.max(60, cell * 3), dropMs: 300,
    dropSpeed: Math.max(.65, cell * .025), dropCross: cell * .75,
  };
}
type Contact = {
  start: Point; last: Point; anchor: Point; bounds: Bounds;
  limits: ReturnType<typeof gestureThresholds>; piece: unknown;
  axis: 'x' | 'y' | null; moved: boolean; maxX: number; upward: number;
};

/** No timers: a stationary finger never repeats a move. A new piece requires a new contact. */
export class GestureRecognizer {
  private contact: Contact | null = null;
  constructor(private callbacks: Callbacks) {}

  begin(point: Point, bounds: Bounds): void {
    this.cancel();
    if (!this.callbacks.enabled() || bounds.width <= 0) return;
    this.contact = {
      start: point, last: point, anchor: point, bounds, limits: gestureThresholds(bounds.width),
      piece: this.callbacks.piece(), axis: null, moved: false, maxX: 0, upward: 0,
    };
  }
  cancel(): void { this.contact = null; }
  private valid(c: Contact): boolean {
    if (this.contact !== c) return false;
    if (!this.callbacks.enabled() || this.callbacks.piece() !== c.piece) { this.cancel(); return false; }
    return true;
  }
  move(point: Point): void {
    const c = this.contact;
    if (!c || !this.valid(c)) return;
    const dx = point.x - c.start.x, dy = point.y - c.start.y, l = c.limits;
    c.maxX = Math.max(c.maxX, Math.abs(dx));
    c.upward += Math.max(0, c.last.y - point.y);
    c.last = point;
    if (Math.hypot(dx, dy) > l.tapSlop) c.moved = true;
    if (!c.axis) {
      if (Math.abs(dx) >= l.axisDistance && Math.abs(dx) >= Math.abs(dy) * l.axisRatio) c.axis = 'x';
      else if (Math.abs(dy) >= l.axisDistance && Math.abs(dy) >= Math.abs(dx) * l.axisRatio) c.axis = 'y';
      else return;
      c.moved = true;
      // First step at the intent threshold; further steps use a full visible cell.
      c.anchor = c.axis === 'x' ? { ...point, x: c.start.x + Math.sign(dx) * l.axisDistance }
        : { ...point, y: c.start.y + Math.sign(dy) * l.axisDistance };
      if (c.axis === 'x') this.callbacks.act(dx > 0 ? 'right' : 'left');
      else if (dy > 0) this.callbacks.act('down');
    }
    while (this.valid(c)) {
      const distance = c.axis === 'x' ? point.x - c.anchor.x : point.y - c.anchor.y;
      if (c.axis === 'y' && distance < 0) {
        // Upward movement only resets the soft-drop anchor; it never moves a piece up.
        c.anchor = point; break;
      }
      if (Math.abs(distance) < l.cell) break;
      const direction = Math.sign(distance);
      if (c.axis === 'x') c.anchor = { ...c.anchor, x: c.anchor.x + direction * l.cell };
      else c.anchor = { ...c.anchor, y: c.anchor.y + l.cell };
      this.callbacks.act(c.axis === 'x' ? (direction > 0 ? 'right' : 'left') : 'down');
    }
  }
  end(point: Point): void {
    this.move(point);
    const c = this.contact;
    if (!c || !this.valid(c)) return;
    this.cancel(); // Clear before emitting the final action, even if it replaces the piece synchronously.
    const duration = Math.max(1, point.time - c.start.time), dy = point.y - c.start.y, l = c.limits;
    if (!c.moved && duration <= l.tapMs) {
      this.callbacks.act(point.x < c.bounds.left + c.bounds.width / 2 ? 'ccw' : 'cw');
    } else if (c.axis === 'y' && dy >= l.dropDistance && duration <= l.dropMs
      && dy / duration >= l.dropSpeed && c.maxX <= Math.min(l.dropCross, dy * .2) && c.upward <= l.tapSlop) {
      this.callbacks.act('drop');
    }
  }
}

/** Pointer Events only. Capture keeps drags continuous outside the canvas. */
export class BoardGestures {
  private recognizer: GestureRecognizer;
  private contacts = new Set<number>();
  private pointer: number | null = null;
  private multiple = false;
  get ambiguousContact(): boolean { return this.multiple; }

  constructor(board: HTMLCanvasElement, callbacks: Callbacks) {
    this.recognizer = new GestureRecognizer(callbacks);
    const point = (event: PointerEvent): Point => ({ x: event.clientX, y: event.clientY, time: event.timeStamp });
    document.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      if (!this.contacts.size) this.multiple = false;
      this.contacts.add(event.pointerId);
      if (this.contacts.size > 1) { this.multiple = true; this.cancel(); }
    }, true);
    board.addEventListener('pointerdown', event => {
      if (!callbacks.enabled() || event.button !== 0) return;
      event.preventDefault();
      if (this.contacts.size !== 1) return;
      this.pointer = event.pointerId;
      board.setPointerCapture(event.pointerId);
      const bounds = board.getBoundingClientRect();
      this.recognizer.begin(point(event), { left: bounds.left, width: bounds.width });
    });
    board.addEventListener('pointermove', event => {
      if (event.pointerId !== this.pointer) return;
      event.preventDefault();
      // Retain bends/reversals when the browser batches samples into one event.
      for (const sample of event.getCoalescedEvents?.() ?? []) this.recognizer.move(point(sample));
      this.recognizer.move(point(event));
    });
    document.addEventListener('pointerup', event => {
      if (event.pointerId === this.pointer) this.recognizer.end(point(event));
      this.release(event.pointerId);
    }, true);
    document.addEventListener('pointercancel', event => this.release(event.pointerId), true);
    board.addEventListener('lostpointercapture', () => this.cancel());
    board.addEventListener('contextmenu', event => { if (callbacks.enabled()) event.preventDefault(); });
    window.addEventListener('resize', () => this.cancel());
    window.visualViewport?.addEventListener('resize', () => this.cancel());
    window.addEventListener('blur', () => { this.cancel(); this.contacts.clear(); });
    window.addEventListener('pagehide', () => { this.cancel(); this.contacts.clear(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.cancel(); this.contacts.clear(); } });
    let size = '';
    new ResizeObserver(entries => {
      const rect = entries[0]!.contentRect, next = `${rect.width}:${rect.height}`;
      if (size && next !== size) this.cancel();
      size = next;
    }).observe(board);
  }
  cancel(): void { this.recognizer.cancel(); this.pointer = null; }
  private release(id: number): void {
    if (this.pointer === id) this.cancel();
    this.contacts.delete(id);
  }
}
