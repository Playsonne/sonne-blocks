import type { Action } from './game/engine';
const KEY_ACTION: Record<string, Action> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'cw',
  KeyX: 'cw', KeyZ: 'ccw', Space: 'drop', KeyC: 'hold',
};
type Held = { action: Action; elapsed: number; next: number; order: number };
const repeats = (action: Action) => action === 'left' || action === 'right' || action === 'down';
export class Controls {
  private held = new Map<string, Held>();
  private order = 0;
  private buttons: HTMLButtonElement[];
  constructor(private act: (action: Action) => void, private enabled: () => boolean, pause: () => void) {
    this.buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action]'));
    window.addEventListener('keydown', event => {
      if (document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === 'Escape') { event.preventDefault(); if (!event.repeat) pause(); return; }
      const action = KEY_ACTION[event.code];
      if (!action || !this.enabled()) return;
      // Preserve ordinary keyboard activation of focused buttons and links.
      if (event.code === 'Space' && event.target instanceof Element && event.target.closest('button,a,input')) return;
      event.preventDefault();
      if (!event.repeat) this.press(`key:${event.code}`, action);
    });
    window.addEventListener('keyup', event => this.release(`key:${event.code}`));
    window.addEventListener('blur', () => this.reset());
    for (const button of this.buttons) {
      const action = button.dataset.action as Action;
      button.addEventListener('pointerdown', event => {
        if (!this.enabled() || event.button !== 0) return;
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        this.press(`pointer:${event.pointerId}`, action);
      });
      const release = (event: PointerEvent) => this.release(`pointer:${event.pointerId}`);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
      button.addEventListener('contextmenu', event => event.preventDefault());
      button.addEventListener('click', event => { if (event.detail === 0 && this.enabled()) this.act(action); });
    }
  }
  private press(id: string, action: Action): void {
    if (this.held.has(id)) return;
    this.held.set(id, { action, elapsed: 0, next: action === 'down' ? 45 : 155, order: ++this.order });
    this.act(action);
    this.paint();
  }
  private release(id: string): void {
    const released = this.held.get(id);
    this.held.delete(id);
    if (released?.action === 'left' || released?.action === 'right') {
      for (const held of this.held.values()) if (held.action === 'left' || held.action === 'right') { held.elapsed = 0; held.next = 155; }
    }
    this.paint();
  }
  private paint(): void {
    for (const button of this.buttons) button.classList.toggle('pressed', [...this.held.values()].some(h => h.action === button.dataset.action));
  }
  reset(): void { this.held.clear(); this.paint(); }
  advance(ms: number): void {
    if (!this.enabled()) { this.reset(); return; }
    const values = [...this.held.values()];
    const horizontal = values.filter(h => h.action === 'left' || h.action === 'right').sort((a, b) => b.order - a.order)[0];
    const down = values.filter(h => h.action === 'down').sort((a, b) => b.order - a.order)[0];
    for (const held of [horizontal, down]) {
      if (!held || !repeats(held.action)) continue;
      held.elapsed += ms;
      while (held.elapsed >= held.next && this.enabled()) {
        this.act(held.action);
        held.next += held.action === 'down' ? 35 : 45;
      }
    }
  }
}
