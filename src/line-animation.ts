import { HIDDEN_ROWS, ROWS, type ClearedRow } from './game/engine';

export const LINE_ANIMATION_MS = 520;

/** One bounded visual effect. It never delays or changes the game state. */
export class LineAnimation {
  private rows: ClearedRow[] = [];
  private startedAt = 0;
  start(rows: ClearedRow[], now: number): void {
    this.rows = rows.filter(row => row.index >= HIDDEN_ROWS && row.index < ROWS)
      .map(row => ({ index: row.index, cells: [...row.cells] }));
    this.startedAt = now;
  }
  cancel(): void { this.rows = []; }
  sample(now: number): { rows: ClearedRow[]; progress: number } | undefined {
    if (!this.rows.length) return;
    const progress = Math.max(0, (now - this.startedAt) / LINE_ANIMATION_MS);
    if (progress >= 1) { this.cancel(); return; }
    return { rows: this.rows, progress };
  }
}
