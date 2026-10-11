import { COLS, HIDDEN_ROWS, type Game, type ClearedRow } from './game/engine';
import { cells, COLORS, type PieceType } from './game/pieces';
import { LineAnimation } from './line-animation';

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const value = canvas.getContext('2d');
  if (!value) throw new Error('Este navegador no permite dibujar el tablero.');
  return value;
}
function tile(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, ghost = false): void {
  const gap = Math.max(1.3, size * .055);
  ctx.beginPath();
  ctx.roundRect(x + gap, y + gap, size - gap * 2, size - gap * 2, Math.max(2, size * .11));
  if (ghost) {
    ctx.fillStyle = color + '10'; ctx.fill();
    ctx.strokeStyle = color + '65'; ctx.lineWidth = 1.2; ctx.stroke();
  } else {
    ctx.fillStyle = color; ctx.fill();
    ctx.fillStyle = '#ffffff30'; ctx.fillRect(x + gap + 3, y + gap + 2, size - gap * 2 - 6, 2);
    ctx.fillStyle = '#00000010'; ctx.fillRect(x + gap + 2, y + size - gap - 4, size - gap * 2 - 4, 2);
  }
}
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private size = 300;
  private dpr = 1;
  private lineAnimation = new LineAnimation();
  constructor(private readonly canvas: HTMLCanvasElement, private readonly next: HTMLCanvasElement, private readonly hold: HTMLCanvasElement) {
    this.ctx = context(canvas);
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement!.parentElement!);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }
  private resize(): void {
    this.cancelLineAnimation();
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    const wrap = this.canvas.parentElement!;
    const stage = wrap.parentElement!;
    // CSS gives this slot the space left after header, stats, previews, controls and
    // safe areas. Resizing changes only the canvas, never the game or its clock.
    const available = stage.getBoundingClientRect();
    this.size = Math.max(1, Math.min((available.height - 2) / 2, available.width - 2));
    wrap.style.width = `${this.size + 2}px`;
    wrap.style.height = `${this.size * 2 + 2}px`;
    this.canvas.width = Math.round(this.size * this.dpr);
    this.canvas.height = this.canvas.width * 2;
  }
  animateLines(rows: ClearedRow[]): void { this.lineAnimation.start(rows, performance.now()); }
  cancelLineAnimation(): void { this.lineAnimation.cancel(); }
  draw(game: Game, welcome: boolean, now: number): void {
    const ctx = this.ctx;
    const unit = this.size / COLS;
    const scale = this.canvas.width / this.size;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, this.size, this.size * 2);
    ctx.strokeStyle = '#22312766'; ctx.lineWidth = .6;
    for (let x = 1; x < 10; x++) { ctx.beginPath(); ctx.moveTo(x * unit, 0); ctx.lineTo(x * unit, this.size * 2); ctx.stroke(); }
    for (let y = 1; y < 20; y++) { ctx.beginPath(); ctx.moveTo(0, y * unit); ctx.lineTo(this.size, y * unit); ctx.stroke(); }
    if (welcome) {
      const pattern = ['0000000000','0000000000','0000000000','0000000000','0000000000','0000000000','0000000000','0000000000','0000000000','0000000000','0000000000','0000000000','0000000000','0000000000','0000000000','0000000000','000000000T','0SS00000TT','SS0LL00JZT','OO0LIIIIZZ'];
      pattern.forEach((row, y) => [...row].forEach((type, x) => { if (type !== '0') tile(ctx, x * unit, y * unit, unit, COLORS[type as PieceType]); }));
    } else {
      game.state.board.slice(HIDDEN_ROWS).forEach((row, y) => row.forEach((type, x) => { if (type) tile(ctx, x * unit, y * unit, unit, COLORS[type]); }));
      // Paint feedback beneath the ghost and active piece so play remains readable.
      this.drawLineAnimation(unit, now);
      if (game.state.status !== 'over') {
        for (const [x, y] of cells(game.ghost())) if (y >= HIDDEN_ROWS) tile(ctx, x * unit, (y - HIDDEN_ROWS) * unit, unit, COLORS[game.state.active.type], true);
        for (const [x, y] of cells(game.state.active)) if (y >= HIDDEN_ROWS) tile(ctx, x * unit, (y - HIDDEN_ROWS) * unit, unit, COLORS[game.state.active.type]);
      }
    }
    this.preview(this.next, game.state.next, 'Siguiente pieza');
    this.preview(this.hold, game.state.hold, 'Pieza reservada');
  }
  private drawLineAnimation(unit: number, now: number): void {
    const effect = this.lineAnimation.sample(now);
    if (!effect) return;
    const ctx = this.ctx, p = effect.progress;
    // Hold the first flash for ~100 ms, then dissolve. An immediate quadratic
    // fade made the old 260 ms effect practically invisible during normal play.
    const dissolve = Math.max(0, (p - .2) / .8);
    const fade = 1 - dissolve;
    const size = unit * (1 - dissolve * .7), inset = (unit - size) / 2;
    ctx.save();
    for (const row of effect.rows) {
      const y = (row.index - HIDDEN_ROWS) * unit;
      ctx.globalAlpha = .95 * fade;
      row.cells.forEach((type, x) => tile(ctx, x * unit + inset, y + inset, size, COLORS[type]));
      // A single bright pulse, confined to the completed rows; no repeated flash.
      ctx.globalAlpha = .65 * fade;
      ctx.fillStyle = '#f2ffda';
      ctx.fillRect(0, y + unit * .08, this.size, unit * .84);
      ctx.globalAlpha = fade;
      ctx.fillRect(0, y + unit * .43, this.size, Math.max(2, unit * .14));
      if (dissolve > 0) {
        // Small colored fragments make the break-up readable even for one row.
        // Deterministic positions avoid flicker and extra animation timers.
        row.cells.forEach((type, x) => {
          ctx.fillStyle = COLORS[type];
          ctx.globalAlpha = fade * .9;
          const chip = unit * (.18 - dissolve * .08);
          for (const direction of [-1, 1]) {
            const cx = (x + .5) * unit + direction * unit * (.12 + dissolve * .38);
            const cy = y + unit * .5 + direction * unit * (.1 + dissolve * .6);
            ctx.fillRect(cx - chip / 2, cy - chip / 2, chip, chip);
          }
        });
      }
    }
    ctx.restore();
  }
  private preview(canvas: HTMLCanvasElement, type: PieceType | null, label: string): void {
    const ctx = context(canvas);
    const dpr = this.dpr;
    if (canvas.width !== 100 * dpr) { canvas.width = 100 * dpr; canvas.height = 70 * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, 100, 70);
    canvas.setAttribute('aria-label', type ? `${label}: ${type}` : 'Sin pieza reservada');
    if (!type) { ctx.fillStyle = '#64755f'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('—', 50, 42); return; }
    const points = cells({ type, rotation: 0, x: 0, y: 0 });
    const minX = Math.min(...points.map(([x]) => x)), maxX = Math.max(...points.map(([x]) => x));
    const minY = Math.min(...points.map(([, y]) => y)), maxY = Math.max(...points.map(([, y]) => y));
    const size = 19, offsetX = (100 - (maxX - minX + 1) * size) / 2, offsetY = (70 - (maxY - minY + 1) * size) / 2;
    for (const [x, y] of points) tile(ctx, offsetX + (x - minX) * size, offsetY + (y - minY) * size, size, COLORS[type]);
  }
}
