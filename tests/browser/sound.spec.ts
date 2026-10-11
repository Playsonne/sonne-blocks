import { test, expect, type Page } from '@playwright/test';
import { Game, type GameState } from '../../src/game/engine';
import { SAVE_KEY } from '../../src/persistence';
import { PREFERENCES_KEY } from '../../src/preferences';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

async function load(page: Page, options: { enabled?: boolean; mode?: string; state?: GameState; api?: 'missing' | 'denied' } = {}) {
  await page.addInitScript(({ options, saveKey, prefsKey }) => {
    if (!localStorage.getItem('sound-seeded')) {
      localStorage.setItem('sound-seeded', 'true');
      if (options.state) localStorage.setItem(saveKey, JSON.stringify({ version: 1, state: options.state }));
      localStorage.setItem(prefsKey, JSON.stringify({ version: 1, mode: options.mode ?? 'buttons', gesturesExplained: true, sound: options.enabled ?? false, soundVolume: .35 }));
    }
    const probe = (window as any).audioProbe = { contexts: [], notes: [], master: null, analyser: null };
    const Native = window.AudioContext;
    if (options.api === 'missing') {
      Object.defineProperty(window, 'AudioContext', { configurable: true, value: undefined });
      Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: undefined });
      return;
    }
    // Keep real synthesis and the browser's audio policy. Observe nodes without
    // replacing audio with a fake API; analyse the actual mixed output as well.
    window.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) { super(options); probe.contexts.push(this); }
      get state() { return options.api === 'denied' ? 'suspended' : super.state; }
      createGain() {
        const gain = super.createGain(), connect = gain.connect.bind(gain);
        gain.connect = ((destination: AudioNode) => {
          if (destination === this.destination) {
            probe.master = gain; probe.analyser = this.createAnalyser();
            connect(probe.analyser); probe.analyser.connect(destination); return destination;
          }
          return connect(destination);
        }) as typeof gain.connect;
        return gain;
      }
      createOscillator() {
        const oscillator = super.createOscillator();
        const note = { frequency: 0, type: '', start: 0, stops: [] as (number | undefined)[], disconnected: false };
        const frequency = oscillator.frequency.setValueAtTime.bind(oscillator.frequency);
        oscillator.frequency.setValueAtTime = (value, time) => { note.frequency = value; return frequency(value, time); };
        const start = oscillator.start.bind(oscillator), stop = oscillator.stop.bind(oscillator), disconnect = oscillator.disconnect.bind(oscillator);
        oscillator.start = (time = 0) => { note.start = time; note.type = oscillator.type; probe.notes.push(note); start(time); };
        oscillator.stop = time => { note.stops.push(time); stop(time); };
        oscillator.disconnect = () => { note.disconnected = true; disconnect(); };
        return oscillator;
      }
      resume() { return options.api === 'denied' ? Promise.reject(new Error('Audio denied')) : super.resume(); }
    };
  }, { options, saveKey: SAVE_KEY, prefsKey: PREFERENCES_KEY });
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.offlineReady === 'true');
}
const notes = (page: Page): Promise<{ frequency: number; type: string; stops: (number | null)[]; disconnected: boolean }[]> => page.evaluate(() => (window as any).audioProbe.notes);
const contexts = (page: Page) => page.evaluate(() => (window as any).audioProbe.contexts.length);
async function ready(page: Page) {
  await page.locator('#play').tap();
  await expect.poll(() => page.evaluate(() => (window as any).audioProbe.contexts[0]?.state)).toBe('running');
}
async function volume(page: Page, value: number) {
  await page.locator('#sound-volume').fill(String(value));
}

test('silencio inicial: ningún contexto de audio hasta activar sonido; Probar genera señal real', async ({ page }) => {
  await load(page); await page.locator('#play').tap(); await page.keyboard.press('Space');
  expect(await contexts(page)).toBe(0);
  await page.locator('#help').tap();
  await expect(page.locator('#sound')).not.toBeChecked(); await expect(page.locator('#test-sound')).toBeDisabled();
  await page.locator('#sound').check(); await page.locator('#test-sound').tap();
  await expect.poll(() => page.evaluate(() => {
    const analyser = (window as any).audioProbe.analyser as AnalyserNode;
    const values = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(values);
    return Math.max(...values.map(Math.abs));
  }), { intervals: [10, 20, 30] }).toBeGreaterThan(.001);
  expect(await notes(page)).toHaveLength(4);
  await page.screenshot({ path: 'test-results/ajuste-sonido.png' });
});

test('volumen y activación persisten offline; cero y desactivar silencian', async ({ page, context }) => {
  await load(page, { enabled: true, mode: 'gestures' }); expect(await contexts(page)).toBe(0);
  await page.locator('#help').tap(); await volume(page, 60);
  await page.locator('#test-sound').tap(); expect(await notes(page)).toHaveLength(4);
  await expect.poll(() => page.evaluate(() => (window as any).audioProbe.master.gain.value)).toBeCloseTo(.6, 2);
  await volume(page, 0); await expect(page.locator('#test-sound')).toBeDisabled();
  expect((await notes(page)).every(n => n.disconnected)).toBe(true);
  await volume(page, 60); await page.locator('#sound').uncheck();
  await context.setOffline(true); await page.reload(); await page.locator('#help').tap();
  await expect(page.locator('#sound')).not.toBeChecked(); await expect(page.locator('#sound-volume')).toHaveValue('60');
  await expect(page.locator('input[value="gestures"]')).toBeChecked(); expect(await contexts(page)).toBe(0);
  await page.locator('#sound').check(); await page.locator('#test-sound').tap(); expect(await notes(page)).toHaveLength(4);
  await page.reload(); await page.locator('#help').tap(); await expect(page.locator('#sound')).toBeChecked();
  await page.locator('#help-dialog .primary').tap(); await ready(page); await page.keyboard.press('Space');
  expect(await notes(page)).toHaveLength(1);
});

for (const mode of ['buttons', 'gestures']) {
  test(`${mode}: caída con un golpe; mover, girar y reservar en silencio`, async ({ page }) => {
    await load(page, { enabled: true, mode }); await ready(page);
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('KeyC');
    expect(await notes(page)).toHaveLength(0);
    if (mode === 'buttons') await page.locator('[data-action="drop"]').tap();
    else {
      const cdp = await page.context().newCDPSession(page), board = (await page.locator('#board').boundingBox())!;
      const x = board.x + board.width / 2, y = board.y + board.height * .25;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + board.width * .6, id: 1 }] });
      expect(await notes(page)).toHaveLength(0);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
    }
    expect(await notes(page)).toHaveLength(1); expect((await notes(page))[0].type).toBe('triangle');
    await page.keyboard.press('Escape'); expect((await notes(page))[0].disconnected).toBe(true);
  });
}

for (const count of [1, 2, 3, 4]) {
  test(`${count} filas: un único acorde sin añadir golpe de caída`, async ({ page }) => {
    const state = new Game().snapshot(); state.active = { type: 'I', rotation: 1, x: 3, y: 18 };
    for (let y = 22 - count; y < 22; y++) state.board[y] = Array.from({ length: 10 }, (_, x) => x === 5 ? null : 'J');
    await load(page, { enabled: true, state }); await ready(page); await page.keyboard.press('Space');
    await expect(page.locator('#lines')).toHaveText(String(count));
    const events = await notes(page); expect(events).toHaveLength(count); expect(events.every(n => n.type === 'sine')).toBe(true);
    expect(new Set(events.map(n => n.frequency)).size).toBe(count);
  });
}

test('la eliminación por gravedad también suena; sin líneas la fijación natural es silenciosa', async ({ page }) => {
  const state = new Game().snapshot(); state.active = { type: 'O', rotation: 0, x: 3, y: 20 };
  state.board[21] = Array.from({ length: 10 }, (_, x) => x === 4 || x === 5 ? null : 'J');
  await load(page, { enabled: true, state }); await ready(page);
  await expect(page.locator('#lines')).toHaveText('1'); expect(await notes(page)).toHaveLength(1);
  // The next piece can reach the floor by soft drop, without any hard-drop sound.
  const activeType = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).state.active.type, SAVE_KEY);
  const before = await activeType(); await page.keyboard.down('ArrowDown');
  await expect.poll(activeType).not.toBe(before); await page.keyboard.up('ArrowDown');
  expect(await notes(page)).toHaveLength(1);
});

for (const key of ['Space', 'KeyC']) test(`fin de partida con ${key}: dos notas una sola vez`, async ({ page }) => {
  const state = new Game().snapshot(); state.active = { type: 'I', rotation: 0, x: 3, y: 0 }; state.board[2][3] = 'T';
  state.hold = 'J';
  await load(page, { enabled: true, state }); await ready(page); await page.keyboard.press(key);
  await expect(page.locator('html')).toHaveAttribute('data-game-status', 'over');
  let events = await notes(page); expect(events).toHaveLength(2); expect(events[1].frequency).toBeLessThan(events[0].frequency);
  await page.waitForTimeout(120); expect(await notes(page)).toHaveLength(2);
  await page.locator('#help').tap(); expect((await notes(page)).every(n => n.disconnected)).toBe(true);
  await page.locator('#help-dialog .primary').tap(); expect(await notes(page)).toHaveLength(2);
});

for (const interruption of ['blur', 'visibility', 'pagehide', 'close', 'escape', 'disable']) {
  test(`la prueba de sonido se cancela con ${interruption}`, async ({ page }) => {
    await load(page, { enabled: true }); await page.locator('#help').tap(); await page.locator('#test-sound').tap();
    expect(await notes(page)).toHaveLength(4);
    if (interruption === 'close') await page.locator('#help-dialog .primary').tap();
    else if (interruption === 'escape') await page.keyboard.press('Escape');
    else if (interruption === 'disable') await page.locator('#sound').uncheck();
    else await page.evaluate(event => {
      if (event === 'visibility') {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange'));
      } else window.dispatchEvent(new Event(event));
    }, interruption);
    // Native dialog close (Escape) is delivered as a separate queued event.
    await expect.poll(async () => (await notes(page)).every(n => n.disconnected)).toBe(true);
    await page.waitForTimeout(150); expect(await notes(page)).toHaveLength(4);
  });
}

test('ayuda con texto ampliado y poca altura: volumen accesible por teclado sin desbordamiento', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 400 }); await load(page, { enabled: true });
  await page.addStyleTag({ content: 'html { font-size: 200%; }' }); await page.locator('#help').tap();
  await page.locator('#sound-volume').focus(); await page.keyboard.press('ArrowRight');
  await expect(page.locator('#sound-volume')).toHaveValue('40');
  await page.locator('#test-sound').scrollIntoViewIfNeeded(); await expect(page.locator('#test-sound')).toBeInViewport();
  expect(await page.locator('#help-dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
});

test('sin API, sonido deshabilitado y partida utilizable', async ({ page }) => {
  await load(page, { enabled: true, api: 'missing' }); await page.locator('#help').tap();
  await expect(page.locator('#sound')).toBeDisabled(); await expect(page.locator('#sound-note')).toContainText('no ofrece sonido');
  await page.locator('#help-dialog .primary').tap(); await page.locator('#play').tap(); await page.keyboard.press('Space');
  await expect(page.locator('#score')).not.toHaveText('0'); expect(await notes(page)).toHaveLength(0);
});
test('permiso rechazado: explicación al probar, sin errores ni cambios en la partida', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await load(page, { enabled: true, api: 'denied' }); await page.locator('#help').tap();
  await page.locator('#test-sound').tap(); await expect(page.locator('#sound-note')).toContainText('No se pudo reproducir');
  await page.locator('#help-dialog .primary').tap(); await page.locator('#play').tap(); await page.keyboard.press('Space');
  await expect(page.locator('#score')).not.toHaveText('0'); expect(await notes(page)).toHaveLength(0); expect(errors).toEqual([]);
});
