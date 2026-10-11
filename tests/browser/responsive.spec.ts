import { test, expect, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { Game } from '../../src/game/engine';
import type { PieceType } from '../../src/game/pieces';
import { SAVE_KEY, validState } from '../../src/persistence';

function sampleGame() {
  const state = new Game(() => .4).snapshot();
  state.active = { type: 'T', rotation: 0, x: 3, y: 5 };
  state.next = 'L'; state.hold = 'I'; state.score = 1280; state.lines = 8;
  const rows = ['00000T0000', 'L000TT0000', 'L00SSTJ000', 'LLOSSJJ000', 'OOZZ0J0III', 'OOZZ0LSSII'];
  rows.forEach((row, index) => { state.board[16 + index] = [...row].map(c => c === '0' ? null : c as PieceType); });
  return state;
}
async function restoreSample(page: Page) {
  const state = sampleGame();
  expect(validState(state)).toBe(true);
  await page.addInitScript(({ state, key }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, state }));
  }, { state, key: SAVE_KEY });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Partida en pausa' })).toBeVisible();
}
async function measure(page: Page) {
  return page.evaluate(() => {
    const box = (selector: string) => {
      const r = document.querySelector(selector)!.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      header: box('.header'), board: box('#board'), stage: box('.stage'), game: box('.game'), controls: box('.controls'),
      stats: box('.scoreboard'), previews: box('.previews'),
      hold: box('#hold-box'), next: box('.piece-box:has(#next)'),
      buttons: [...document.querySelectorAll<HTMLButtonElement>('[data-action], #hold-box, #help, #pause')].map(el => {
        const r = el.getBoundingClientRect();
        return { action: el.dataset.action || el.id, x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      }),
    };
  });
}
async function fitted(page: Page, mobile: boolean) {
  await expect.poll(async () => {
    const m = await measure(page);
    return Math.abs(m.board.height / m.board.width - 2);
  }).toBeLessThan(.015);
  const m = await measure(page);
  expect(m.scroll.width).toBe(m.viewport.width);
  expect(m.scroll.height).toBeLessThanOrEqual(m.viewport.height);
  expect(m.board.bottom).toBeLessThanOrEqual(m.viewport.height);
  expect(m.controls.bottom).toBeLessThanOrEqual(m.viewport.height);
  expect(m.board.height).toBeGreaterThan(270);
  const maximumWidth = Math.min(m.stage.width - 2, (m.stage.height - 2) / 2);
  expect(Math.abs(m.board.width - maximumWidth)).toBeLessThan(1);
  for (const b of m.buttons) {
    expect(b.width, b.action).toBeGreaterThanOrEqual(44);
    expect(b.height, b.action).toBeGreaterThanOrEqual(44);
    expect(b.bottom, b.action).toBeLessThanOrEqual(m.viewport.height);
    expect(b.x, b.action).toBeGreaterThanOrEqual(0);
    expect(b.right, b.action).toBeLessThanOrEqual(m.viewport.width);
  }
  expect(Math.abs(m.game.x + m.game.width / 2 - m.viewport.width / 2)).toBeLessThan(1);
  if (mobile) {
    expect(m.header.bottom).toBeLessThanOrEqual(m.stats.y);
    expect(m.stats.bottom).toBeLessThanOrEqual(m.previews.y);
    expect(m.previews.bottom).toBeLessThanOrEqual(m.board.y);
    expect(m.board.bottom).toBeLessThanOrEqual(m.controls.y);
    expect(Math.abs(m.hold.y - m.next.y)).toBeLessThan(1);
    expect(m.hold.right).toBeLessThan(m.next.x);
    expect(Math.abs(m.board.x + m.board.width / 2 - m.viewport.width / 2)).toBeLessThan(1);
    const drop = m.buttons.find(b => b.action === 'drop')!;
    expect(drop.x - m.buttons.find(b => b.action === 'right')!.right).toBeGreaterThanOrEqual(12);
  }
  return m;
}

const viewports = [
  { width: 320, height: 568, previous: 310 },
  { width: 360, height: 640, previous: 385 },
  { width: 390, height: 844, previous: 522 },
  { width: 412, height: 915, previous: 566 },
  { width: 1366, height: 768, previous: 443 },
  { width: 1920, height: 1080, previous: 575 },
];
for (const size of viewports) {
  test(`distribución ${size.width}×${size.height}: tablero máximo, pausa y controles`, async ({ page }, testInfo) => {
    const mobile = size.width < 850;
    const prefix = `${mobile ? 'movil' : 'escritorio'}-${size.width}x${size.height}`;
    await page.setViewportSize(size); await restoreSample(page);
    await expect(page.locator('#app-version')).toBeVisible();
    await expect(page.locator('#app-version')).toBeInViewport();
    await expect(page.locator('.intro')).toBeHidden();
    await expect(page.locator('#overlay-kicker')).toBeHidden();
    await expect(page.locator('#overlay-description')).toBeHidden();
    await page.screenshot({ path: `test-results/${prefix}-pausa.png`, fullPage: true });
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.locator('#app-version')).toBeVisible();
    await expect(page.locator('.brand small')).toBeHidden();
    await expect(page.locator('#install')).toBeHidden();
    await expect(page.locator('#game-caption')).toBeHidden();
    await expect(page.locator('#next')).toHaveCount(1);
    const m = await fitted(page, mobile);
    expect(m.board.height).toBeGreaterThan(size.previous);
    await testInfo.attach('dimensiones', { body: JSON.stringify(m, null, 2), contentType: 'application/json' });
    writeFileSync(testInfo.outputPath('dimensiones.json'), JSON.stringify(m, null, 2));
    await page.screenshot({ path: `test-results/${prefix}-jugando.png`, fullPage: true });
    await page.locator('[data-action="left"]').click();
    await page.locator('[data-action="cw"]').click();
    await page.locator('[data-action="drop"]').click();
    await expect(page.locator('#score')).not.toHaveText('1280');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Partida en pausa' })).toBeVisible();
    await fitted(page, mobile);
  });
}

test('bienvenida de escritorio: el texto grande desaparece al jugar y al pausar', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 }); await page.goto('/');
  await expect(page.locator('.intro')).toBeVisible();
  await page.screenshot({ path: 'test-results/escritorio-bienvenida.png', fullPage: true });
  await page.locator('#play').click(); await expect(page.locator('.intro')).toBeHidden();
  await page.keyboard.press('Escape'); await expect(page.locator('.intro')).toBeHidden();
  await expect(page.locator('.keyboard-guide')).toBeVisible();
});

test('redimensionar, cambiar orientación y reservar zonas seguras conserva toda la partida', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await restoreSample(page);
  const initial = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
  for (const viewport of [{ width: 390, height: 690 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(page.locator('html')).toHaveAttribute('data-game-status', 'paused');
    expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(initial);
    if (viewport.height > 600) await fitted(page, viewport.width < 850);
  }
  // Simulates insets, not an actual iPhone or an installed OS window.
  await page.addStyleTag({ content: ':root { --safe-top: 44px; --safe-bottom: 34px; }' });
  await fitted(page, true);
  const m = await measure(page);
  expect((await page.locator('.header').boundingBox())!.y).toBeGreaterThanOrEqual(44);
  expect(m.controls.bottom).toBeLessThanOrEqual(844 - 34);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  const before = await page.locator('#score').textContent();
  await page.setViewportSize({ width: 412, height: 915 });
  await expect(page.locator('html')).toHaveAttribute('data-game-status', 'playing');
  await expect(page.locator('#score')).toHaveText(before!);
  await page.keyboard.press('Escape');
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).state, SAVE_KEY);
  const initialState = JSON.parse(initial!).state;
  for (const key of ['board', 'next', 'hold', 'bag', 'score', 'lines', 'level', 'holdUsed']) expect(stored[key]).toEqual(initialState[key]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Partida en pausa' })).toBeVisible();
  await expect(page.locator('#score')).toHaveText(before!);
});

for (const fontSize of ['100%', '200%']) {
  test(`poca altura y texto ${fontSize}: menús, pausa y confirmación accesibles con scroll`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 400 }); await restoreSample(page);
    await page.addStyleTag({ content: `html { font-size: ${fontSize}; }` });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(400);
    const layout = await measure(page);
    expect(layout.header.bottom).toBeLessThanOrEqual(layout.stats.y);
    await page.locator('#new-game').click();
    await expect(page.locator('#restart-dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Volver', exact: true }).click();
    await expect(page.locator('#score')).toHaveText('1280');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-game-status', 'playing');
    await page.locator('#help').click();
    await expect(page.locator('#help-dialog')).toBeVisible();
    const dialog = await page.locator('#help-dialog').evaluate(el => ({ client: el.clientHeight, scroll: el.scrollHeight, width: el.clientWidth, scrollWidth: el.scrollWidth }));
    expect(dialog.scroll).toBeGreaterThan(dialog.client);
    expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.width);
    await page.screenshot({ path: `test-results/ayuda-altura-400-texto-${fontSize.replace('%', '')}.png` });
    await page.locator('#install').scrollIntoViewIfNeeded();
    await expect(page.locator('#install')).toBeInViewport();
    await page.locator('#help-dialog .primary').click();
    await expect(page.locator('html')).toHaveAttribute('data-game-status', 'paused');
    await page.locator('#new-game').click();
    await page.locator('#confirm-restart').click();
    await expect(page.locator('#score')).toHaveText('0');
    await expect(page.locator('#best')).toHaveText('1280');
    await expect(page.locator('html')).toHaveAttribute('data-game-status', 'playing');
  });
}

test('instalación, estado de guardado y avisos siguen accesibles desde la ayuda', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await restoreSample(page);
  // Exercise the fallback path; do not accept a browser-native installation prompt.
  await page.addInitScript(() => window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); event.stopImmediatePropagation(); }));
  await page.reload(); await page.locator('#help').click();
  await expect(page.locator('#game-caption')).toBeVisible();
  await page.locator('#install').click();
  await expect(page.locator('#install-dialog')).toBeVisible();
  await expect(page.locator('#help-dialog')).not.toBeVisible();
  await page.locator('#install-dialog .primary').click();
  await expect(page.locator('html')).toHaveAttribute('data-game-status', 'paused');
});

test('contexto móvil con tacto y densidad alta: tablero y controles conservan sus dimensiones CSS', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.625 });
  const page = await context.newPage();
  try {
    await restoreSample(page);
    await page.getByRole('button', { name: 'Continuar', exact: true }).tap();
    await fitted(page, true);
    const raster = await page.locator('#board').evaluate((canvas: HTMLCanvasElement) => ({ width: canvas.width, height: canvas.height, cssWidth: canvas.getBoundingClientRect().width }));
    expect(raster.height).toBe(raster.width * 2);
    expect(raster.width / raster.cssWidth).toBeCloseTo(2.625, 2);
    await page.locator('[data-action="hold"]').tap();
    await expect(page.locator('#hold-note')).toHaveText('Ya utilizada');
    await page.locator('[data-action="drop"]').tap();
    await expect(page.locator('#hold-note')).toHaveText('Disponible');
    await page.locator('#pause').tap();
    await expect(page.getByRole('heading', { name: 'Partida en pausa' })).toBeVisible();
  } finally { await context.close(); }
});
