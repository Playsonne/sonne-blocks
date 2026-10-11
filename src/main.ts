import './style.css';
import { Game, type Action } from './game/engine';
import { Persistence } from './persistence';
import { Renderer } from './render';
import { Controls } from './controls';
import { setupPwa } from './pwa';
import { BoardGestures } from './gestures';
import { Preferences, type ControlMode } from './preferences';

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const store = new Persistence();
const preferences = new Preferences();
const saved = store.load();
let game = new Game(Math.random, saved);
let welcome = !saved;
let best = Math.max(store.record(), saved?.score ?? 0);
let lastTime = 0;
let recordedLocks = 0;
let lastStatus = '';
let warnedStorage = false;
let offlineReady = false;
let toastTimer = 0;
let flashTimer = 0;
const renderer = new Renderer($('#board'), $('#next'), $('#hold'));
const controls = new Controls(action, () => game.state.status === 'playing' && !document.querySelector('dialog[open]'), () => pause());
const gestures = new BoardGestures($('#board'), {
  act: action,
  enabled: () => preferences.mode === 'gestures' && game.state.status === 'playing' && !document.querySelector('dialog[open]'),
  piece: () => `${game.locks}:${game.state.holdUsed}`,
});
const number = new Intl.NumberFormat('es-ES');
function notify(message: string): void {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false;
  $('#last-notice').textContent = message; $('#last-notice').hidden = false;
  toastTimer = window.setTimeout(() => { $('#toast').hidden = true; }, 4000);
}
function storageNotice(): void {
  if (!store.available && !warnedStorage) {
    warnedStorage = true;
    notify('No se puede guardar en este navegador. Puedes seguir jugando.');
  }
  $('#game-caption').textContent = store.available ? (offlineReady ? 'Listo para jugar sin conexión · guardado local' : 'Tu partida se guarda en este dispositivo') : 'Partida en memoria · guardado no disponible';
}
function save(): void {
  if (!welcome) store.save(game.snapshot());
  store.setRecord(best);
  storageNotice();
}
function sync(): void {
  const s = game.state;
  best = Math.max(best, s.score);
  $('#score').textContent = number.format(s.score);
  $('#best').textContent = number.format(best);
  $('#level').textContent = String(s.level).padStart(2, '0');
  $('#lines').textContent = number.format(s.lines);
  $('#progress-fill').style.width = `${(s.lines % 10) * 10}%`;
  $('#progress').setAttribute('aria-valuenow', String(s.lines % 10));
  $('#hold-box').classList.toggle('used', s.holdUsed);
  $('#hold-note').textContent = s.holdUsed ? 'Ya utilizada' : 'Disponible';
  const playing = s.status === 'playing';
  $<HTMLButtonElement>('#hold-box').disabled = !playing || s.holdUsed;
  $('#overlay').hidden = playing;
  $<HTMLButtonElement>('#pause').disabled = !playing;
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => { button.disabled = !playing || (button.dataset.action === 'hold' && s.holdUsed); });
  document.documentElement.dataset.gameStatus = welcome ? 'welcome' : s.status;
  if (s.status !== lastStatus) {
    lastStatus = s.status;
    if (!playing) { controls.reset(); gestures.cancel(); }
  }
  if (!playing) {
    $('#new-game').hidden = welcome || s.status === 'over';
    if (welcome) {
      $('#overlay-kicker').textContent = 'TU PRÓXIMA PAUSA FAVORITA';
      $('#overlay-title').innerHTML = 'Haz sitio.<br />Sigue jugando.';
      $('#overlay-description').innerHTML = 'Completa líneas.<br />Encuentra tu ritmo.';
      $('#play').innerHTML = 'Empezar <span aria-hidden="true">↗</span>';
    } else if (s.status === 'over') {
      $('#overlay-kicker').textContent = 'CADA PARTIDA CUENTA';
      $('#overlay-title').innerHTML = 'Buen intento.<br />¿Otra ronda?';
      $('#overlay-description').textContent = `${number.format(s.score)} puntos · ${s.lines} líneas`;
      $('#play').textContent = 'Volver a jugar';
    } else {
      $('#overlay-title').textContent = 'Partida en pausa';
      $('#play').textContent = 'Continuar';
    }
  }
  if (game.locks !== recordedLocks) {
    gestures.cancel();
    recordedLocks = game.locks;
    if (game.lastClear) {
      const flash = $('#clear-message');
      flash.textContent = game.lastClear === 4 ? '¡4 líneas!' : `+${game.lastClear} ${game.lastClear === 1 ? 'línea' : 'líneas'}`;
      flash.classList.remove('flash'); void flash.offsetWidth; flash.classList.add('flash');
      clearTimeout(flashTimer); flashTimer = window.setTimeout(() => flash.classList.remove('flash'), 700);
    }
    save();
  }
  if (s.status === 'over') { store.clear(); store.setRecord(best); storageNotice(); }
}
function action(value: Action): void {
  if (game.act(value)) {
    if (value === 'hold') gestures.cancel();
    sync();
  }
}
function pause(): void {
  game.pause(); controls.reset(); gestures.cancel(); lastTime = 0; sync(); save();
}
function startNew(): void {
  game = new Game(); welcome = false; recordedLocks = 0; controls.reset(); gestures.cancel();
  game.resume(); lastTime = 0; save(); sync();
  (document.activeElement as HTMLElement | null)?.blur();
}
function continuePlay(): void {
  if (welcome || game.state.status === 'over') startNew();
  else { game.resume(); controls.reset(); gestures.cancel(); lastTime = 0; sync(); (document.activeElement as HTMLElement | null)?.blur(); }
}
$('#play').addEventListener('click', continuePlay);
$('#hold-box').addEventListener('click', event => {
  if (game.state.status !== 'playing' || document.querySelector('dialog[open]')) return;
  if (preferences.mode === 'gestures' && event.detail !== 0 && gestures.ambiguousContact) return;
  action('hold');
});
$('#pause').addEventListener('click', pause);
function openDialog(selector: string): void {
  gestures.cancel();
  if (game.state.status === 'playing') pause();
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(dialog => dialog.close());
  $<HTMLDialogElement>(selector).showModal();
}
$('#help').addEventListener('click', () => openDialog('#help-dialog'));
function renderControlMode(): void {
  document.documentElement.dataset.controlMode = preferences.mode;
  document.querySelectorAll<HTMLInputElement>('[name="control-mode"]').forEach(input => { input.checked = input.value === preferences.mode; });
}
function setControlMode(mode: ControlMode): void {
  controls.reset(); gestures.cancel();
  if (!preferences.set(mode)) notify('El modo de control se mantendrá mientras esté abierto el juego. No se ha podido guardar la preferencia.');
  renderControlMode();
}
document.querySelectorAll<HTMLInputElement>('[name="control-mode"]').forEach(input => input.addEventListener('change', () => {
  if (input.value === 'gestures' && !preferences.gesturesExplained) openDialog('#gesture-dialog');
  else setControlMode(input.value as ControlMode);
}));
$('#start-gestures').addEventListener('click', () => {
  setControlMode('gestures');
  $<HTMLDialogElement>('#gesture-dialog').close();
  continuePlay();
});
$('#gesture-dialog').addEventListener('close', () => {
  if (!preferences.gesturesExplained) { renderControlMode(); openDialog('#help-dialog'); }
});
$('#new-game').addEventListener('click', () => openDialog('#restart-dialog'));
$('#confirm-restart').addEventListener('click', () => { $<HTMLDialogElement>('#restart-dialog').close(); startNew(); });
document.querySelectorAll<HTMLElement>('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog')?.close()));
$('.brand').addEventListener('click', event => { event.preventDefault(); pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('blur', () => { if (game.state.status === 'playing') pause(); });
window.addEventListener('pagehide', pause);
window.addEventListener('pageshow', () => { game.pause(); lastTime = 0; sync(); });
function connection(): void { $('#connection').textContent = navigator.onLine ? 'LOCAL · SIN CUENTAS' : 'SIN CONEXIÓN · A JUGAR'; }
window.addEventListener('online', connection); window.addEventListener('offline', connection); connection();
setupPwa({ notify, ready: () => { offlineReady = true; storageNotice(); }, prepareUpdate: pause, isPlaying: () => game.state.status === 'playing', installHelp: () => openDialog('#install-dialog') });
renderControlMode(); sync(); storageNotice();
if (store.corrupted) notify('No se pudo recuperar la partida guardada. Puedes empezar otra.');
function frame(time: number): void {
  const delta = lastTime ? time - lastTime : 0;
  lastTime = time;
  if (game.state.status === 'playing') {
    // Suspend after a long frame instead of catching up after OS/browser suspension.
    if (delta > 250) pause();
    else { controls.advance(delta); game.advance(delta); sync(); }
  }
  renderer.draw(game, welcome);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
