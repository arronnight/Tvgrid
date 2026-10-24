import {
  CHANNELS,
  LAYOUTS,
  programAt,
  scheduleBetween,
  nextPrograms,
  formatDate,
  formatTime,
  tickerMarkup
} from './js/data.js';
import { drawChannel } from './js/renderers.js';

const ROUNDS = 5;
const ROUND_MS = 10000;
const HALF_HOUR = 30 * 60000;
const STORAGE = 'tvgrid.v2.';

const $ = (id) => document.getElementById(id);

const els = {
  brandHome: $('brandHome'),
  clockDate: $('clockDate'),
  clockTime: $('clockTime'),
  guideBtn: $('guideBtn'),
  gameBtn: $('gameBtn'),
  soundBtn: $('soundBtn'),
  powerBtn: $('powerBtn'),
  wallCount: $('wallCount'),
  wallStatus: $('wallStatus'),
  layoutSwitch: $('layoutSwitch'),
  gameStrip: $('gameStrip'),
  targetCanvas: $('targetCanvas'),
  gameClue: $('gameClue'),
  gameClock: $('gameClock'),
  gameTimerFill: $('gameTimerFill'),
  tvGrid: $('tvGrid'),
  shuffleBtn: $('shuffleBtn'),
  tickerTrack: $('tickerTrack'),
  channelPanel: $('channelPanel'),
  gamePanel: $('gamePanel'),
  monitorState: $('monitorState'),
  selNum: $('selNum'),
  selName: $('selName'),
  selMeta: $('selMeta'),
  selShow: $('selShow'),
  progressFill: $('progressFill'),
  selStart: $('selStart'),
  selRemaining: $('selRemaining'),
  selEnd: $('selEnd'),
  selNext: $('selNext'),
  selNextTime: $('selNextTime'),
  prevBtn: $('prevBtn'),
  expandBtn: $('expandBtn'),
  nextBtn: $('nextBtn'),
  favBtn: $('favBtn'),
  favLabel: $('favLabel'),
  scheduleList: $('scheduleList'),
  panelGuideBtn: $('panelGuideBtn'),
  footChannel: $('footChannel'),
  footCallsign: $('footCallsign'),
  gameRound: $('gameRound'),
  gameScore: $('gameScore'),
  gameStreak: $('gameStreak'),
  gameBest: $('gameBest'),
  quitGameBtn: $('quitGameBtn'),
  guideOverlay: $('guideOverlay'),
  guideNow: $('guideNow'),
  guideTimebar: $('guideTimebar'),
  guideRows: $('guideRows'),
  guideScroll: $('guideScroll'),
  focusOverlay: $('focusOverlay'),
  focusCanvas: $('focusCanvas'),
  focusMeta: $('focusMeta'),
  focusTitle: $('focusTitle'),
  focusBug: $('focusBug'),
  focusShow: $('focusShow'),
  focusTime: $('focusTime'),
  focusPrev: $('focusPrev'),
  focusNext: $('focusNext'),
  focusClose: $('focusClose'),
  resultOverlay: $('resultOverlay'),
  resultScore: $('resultScore'),
  resultHits: $('resultHits'),
  resultBest: $('resultBest'),
  resultAccuracy: $('resultAccuracy'),
  resultNote: $('resultNote'),
  playAgainBtn: $('playAgainBtn'),
  backToWallBtn: $('backToWallBtn'),
  toast: $('toast')
};

function readSetting(key, fallback) {
  try {
    const value = localStorage.getItem(STORAGE + key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function writeSetting(key, value) {
  try {
    localStorage.setItem(STORAGE + key, JSON.stringify(value));
  } catch {
    /* storage is optional */
  }
}

const savedLayout = readSetting('layout', '4x3');
const savedFavorites = readSetting('favorites', []);
const savedPower = readSetting('power', true);
const savedSound = readSetting('sound', false);
const savedBest = readSetting('best', 0);

const state = {
  layout: LAYOUTS[savedLayout] ? savedLayout : '4x3',
  power: savedPower !== false,
  sound: savedSound === true,
  selected: 0,
  favorites: new Set(Array.isArray(savedFavorites) ? savedFavorites.filter(Number.isInteger) : []),
  order: CHANNELS.map((_, index) => index),
  expanded: false,
  lastFocus: null,
  game: {
    active: false,
    roundActive: false,
    round: 0,
    target: null,
    previousTarget: null,
    deadline: 0,
    score: 0,
    streak: 0,
    best: Number.isFinite(savedBest) ? savedBest : 0,
    hits: 0,
    misses: 0,
    savedLayout: '4x3',
    savedOrder: [],
    nextTimer: 0
  }
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvasContexts = [];
const tvElements = [];
const focusContext = els.focusCanvas.getContext('2d');
const targetContext = els.targetCanvas.getContext('2d');
let toastTimer = 0;
let lastFrame = 0;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

function padScore(value) {
  return String(Math.max(0, Math.round(value))).padStart(4, '0');
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function favoriteStar(index, prefix = '') {
  return state.favorites.has(index) ? `${prefix}<span class="star" aria-label="favorite">★</span>` : '';
}

/* ------------------------------------------------------------------ */
/* Sound                                                              */
/* ------------------------------------------------------------------ */

let audioContext = null;
let noiseBuffer = null;

function ensureAudio() {
  if (!audioContext) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    audioContext = new Context();
  }
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  return audioContext;
}

function makeNoiseBuffer(context) {
  if (noiseBuffer) return noiseBuffer;
  const length = Math.floor(context.sampleRate * 0.25);
  noiseBuffer = context.createBuffer(1, length, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function tone(frequency, delay = 0, duration = 0.08, type = 'triangle', volume = 0.03) {
  if (!state.sound) return;
  const context = ensureAudio();
  if (!context) return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function noiseBurst(duration = 0.12, volume = 0.035) {
  if (!state.sound) return;
  const context = ensureAudio();
  if (!context) return;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const start = context.currentTime;
  source.buffer = makeNoiseBuffer(context);
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1800, start);
  filter.Q.setValueAtTime(0.7, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(start);
  source.stop(start + duration);
}

function playTune() {
  noiseBurst(0.11, 0.028);
  tone(523.25, 0.02, 0.04, 'square', 0.018);
  tone(659.25, 0.08, 0.05, 'square', 0.014);
}

function playHit() {
  tone(659.25, 0, 0.08, 'triangle', 0.045);
  tone(880, 0.075, 0.09, 'triangle', 0.04);
  tone(1318.5, 0.16, 0.16, 'triangle', 0.035);
}

function playMiss() {
  tone(196, 0, 0.1, 'sawtooth', 0.025);
  tone(146.83, 0.09, 0.16, 'sawtooth', 0.022);
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => els.toast.classList.remove('is-visible'), 2300);
}

/* ------------------------------------------------------------------ */
/* Wall                                                               */
/* ------------------------------------------------------------------ */

function buildWall() {
  CHANNELS.forEach((channel, index) => {
    const tv = document.createElement('button');
    tv.type = 'button';
    tv.className = 'tv';
    tv.dataset.index = String(index);
    tv.setAttribute('aria-label', `Channel ${channel.num} ${channel.name}. ${channel.genre}. Select to monitor.`);
    tv.title = 'Select to monitor. Click again for full screen.';
    tv.innerHTML = `
      <span class="screen">
        <canvas width="480" height="360"></canvas>
        <span class="screen-glass"></span>
        <span class="screen-scan"></span>
        <span class="tv-static"></span>
        <span class="tv-live">LIVE</span>
        <span class="tv-fav" hidden>★</span>
        <span class="tv-meta">
          <span class="tv-num">${escapeHtml(channel.num)}</span>
          <span class="tv-show"></span>
        </span>
      </span>
    `;
    tv.addEventListener('click', () => handleTileClick(index));
    tv.addEventListener('animationend', () => tv.classList.remove('tuning'));
    els.tvGrid.appendChild(tv);
    tvElements.push(tv);
    canvasContexts.push(tv.querySelector('canvas').getContext('2d'));
  });
}

function updateTileLabels(now = Date.now()) {
  CHANNELS.forEach((channel, index) => {
    const tv = tvElements[index];
    const program = programAt(channel, now);
    tv.querySelector('.tv-show').textContent = program.title;
    tv.querySelector('.tv-num').textContent = channel.num;
    tv.querySelector('.tv-fav').hidden = !state.favorites.has(index);
    tv.title = `Channel ${channel.num} ${channel.name} — ${program.title}. Select to monitor. Click again for full screen.`;
    tv.setAttribute('aria-label', `Channel ${channel.num} ${channel.name}, now playing ${program.title}. Select to monitor.`);
  });
}

function updateLayoutButtons() {
  els.layoutSwitch.querySelectorAll('button').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.layout === state.layout));
  });
}

function renderGrid() {
  const count = state.game.active ? CHANNELS.length : LAYOUTS[state.layout].count;
  state.order.forEach((channelIndex, position) => {
    const tv = tvElements[channelIndex];
    tv.classList.toggle('is-hidden', position >= count);
    els.tvGrid.appendChild(tv);
  });
  els.tvGrid.dataset.layout = state.layout;
  els.wallCount.textContent = `${count} CH / ${state.layout.replace('x', '×')}`;
}

function syncCanvasResolution() {
  const { width, height } = LAYOUTS[state.layout];
  CHANNELS.forEach((_, index) => {
    const canvas = tvElements[index].querySelector('canvas');
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  });
}

function setLayout(name, options = {}) {
  if (!LAYOUTS[name]) return;
  if (state.game.active && name !== '4x3') return;
  state.layout = name;
  writeSetting('layout', name);
  updateLayoutButtons();
  renderGrid();
  syncCanvasResolution();

  if (!state.game.active) {
    const count = LAYOUTS[name].count;
    const position = state.order.indexOf(state.selected);
    if (position < 0 || position >= count) {
      state.selected = state.order[0];
    }
  }

  updateSelectionUI();
  updatePanel();
  if (!options.silent) {
    showToast(`MULTIVIEW ${name.replace('x', ' × ')}`);
    drawWall(performance.now() / 1000);
  }
}

function revealChannel(index) {
  if (state.game.active) return;
  const position = state.order.indexOf(index);
  if (position < 0 || position >= LAYOUTS[state.layout].count) {
    setLayout('4x3', { silent: true });
  }
}

function flashTile(index) {
  const tv = tvElements[index];
  tv.classList.remove('tuning');
  void tv.offsetWidth;
  tv.classList.add('tuning');
}

function updateSelectionUI() {
  tvElements.forEach((tv, index) => {
    const selected = index === state.selected && !state.game.active;
    tv.classList.toggle('is-selected', selected);
    if (selected) tv.setAttribute('aria-current', 'true');
    else tv.removeAttribute('aria-current');
  });
}

function selectChannel(index, options = {}) {
  if (index < 0 || index >= CHANNELS.length) return;
  const changed = state.selected !== index;
  state.selected = index;
  if (options.reveal !== false) revealChannel(index);
  updateSelectionUI();
  updatePanel();
  updateFocus();
  if (changed && options.silent !== true) {
    flashTile(index);
    playTune();
  }
  if (options.scroll && tvElements[index] && !tvElements[index].classList.contains('is-hidden')) {
    tvElements[index].scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
  }
}

function handleTileClick(index) {
  if (!state.power) {
    setPower(true);
    selectChannel(index);
    return;
  }
  if (state.game.active) {
    handleGuess(index);
    return;
  }
  if (state.selected === index) {
    openFocus();
    return;
  }
  selectChannel(index);
}

function shuffleOrder() {
  const order = [...state.order];
  for (let index = order.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [order[index], order[other]] = [order[other], order[index]];
  }
  return order;
}

function shuffleWall() {
  if (state.game.active) return;
  state.order = shuffleOrder();
  const count = LAYOUTS[state.layout].count;
  const position = state.order.indexOf(state.selected);
  if (position >= count) {
    [state.order[0], state.order[position]] = [state.order[position], state.order[0]];
  }
  renderGrid();
  updateSelectionUI();
  showToast('WALL SHUFFLED');
  playTune();
}

/* ------------------------------------------------------------------ */
/* Clock, panel, ticker                                               */
/* ------------------------------------------------------------------ */

function updateClock() {
  const now = new Date();
  els.clockDate.textContent = formatDate(now);
  els.clockTime.textContent = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  if (!els.guideOverlay.hidden) {
    els.guideNow.textContent = `${formatTime(now)}`;
  }
}

function updatePanel() {
  const channel = CHANNELS[state.selected];
  const program = programAt(channel, Date.now());
  const now = Date.now();
  const progress = clamp((now - program.startMs) / (program.endMs - program.startMs), 0, 1);
  const remaining = Math.max(0, Math.ceil((program.endMs - now) / 60000));
  const schedule = nextPrograms(channel, now, 5);
  const next = schedule[1] || schedule[0];

  els.selNum.textContent = channel.num;
  els.selName.textContent = channel.name;
  els.selMeta.textContent = `${channel.callsign} · ${channel.genre} · STEREO`;
  els.selShow.textContent = program.title;
  els.progressFill.style.width = `${(progress * 100).toFixed(2)}%`;
  els.selStart.textContent = formatTime(program.startMs);
  els.selEnd.textContent = formatTime(program.endMs);
  els.selRemaining.textContent = remaining > 0 ? `${remaining} MIN LEFT` : 'ENDING NOW';
  els.selNext.textContent = next.title;
  els.selNextTime.textContent = formatTime(next.startMs);
  els.footChannel.textContent = channel.num;
  els.footCallsign.textContent = channel.callsign;
  els.monitorState.textContent = state.power ? 'LIVE' : 'STANDBY';

  els.favBtn.setAttribute('aria-pressed', String(state.favorites.has(state.selected)));
  els.favLabel.textContent = state.favorites.has(state.selected) ? 'REMOVE FROM FAVORITES' : 'ADD TO FAVORITES';

  els.scheduleList.innerHTML = schedule.map((item) => `
    <li class="${item.isNow ? 'is-now' : ''}">
      <span class="schedule-time">${formatTime(item.startMs)}</span>
      <span class="schedule-title">${escapeHtml(item.title)}</span>
    </li>
  `).join('');

  updateFocus();
}

function updateTicker() {
  const content = tickerMarkup(Date.now());
  els.tickerTrack.innerHTML = `<span class="ticker-copy">${content}</span><span class="ticker-copy" aria-hidden="true">${content}</span>`;
}

/* ------------------------------------------------------------------ */
/* Power and favorites                                                */
/* ------------------------------------------------------------------ */

function setPower(on, options = {}) {
  if (!on && state.game.active) exitGame({ silent: true });
  if (!on && !els.focusOverlay.hidden) closeOverlay(els.focusOverlay);

  state.power = on;
  document.body.classList.toggle('is-off', !on);
  els.powerBtn.setAttribute('aria-pressed', String(on));
  els.powerBtn.setAttribute('aria-label', on ? 'Power off' : 'Power on');
  els.monitorState.textContent = on ? 'LIVE' : 'STANDBY';
  els.wallStatus.textContent = on ? 'ALL CHANNELS LOCKED' : 'SYSTEM STANDBY';
  writeSetting('power', on);

  if (!on) {
    document.body.classList.add('is-off');
  } else {
    drawWall(performance.now() / 1000);
    if (!options.silent) playTune();
  }

  if (!options.silent) {
    showToast(on ? 'SYSTEM ONLINE' : 'SYSTEM STANDBY');
  }
}

function toggleFavorite() {
  if (state.favorites.has(state.selected)) {
    state.favorites.delete(state.selected);
    showToast('REMOVED FROM FAVORITES');
  } else {
    state.favorites.add(state.selected);
    showToast('ADDED TO FAVORITES');
    tone(880, 0, 0.05, 'triangle', 0.02);
  }
  writeSetting('favorites', [...state.favorites]);
  updatePanel();
  updateTileLabels();
}

function toggleSound() {
  state.sound = !state.sound;
  writeSetting('sound', state.sound);
  els.soundBtn.setAttribute('aria-pressed', String(state.sound));
  if (state.sound) {
    ensureAudio();
    tone(660, 0, 0.06, 'triangle', 0.03);
    tone(990, 0.07, 0.08, 'triangle', 0.025);
    showToast('AUDIO ENABLED');
  } else {
    showToast('AUDIO MUTED');
  }
}

/* ------------------------------------------------------------------ */
/* Overlays                                                           */
/* ------------------------------------------------------------------ */

function openOverlay(element, focusTarget) {
  state.lastFocus = document.activeElement;
  element.hidden = false;
  document.body.classList.add('overlay-open');
  window.requestAnimationFrame(() => {
    const target = focusTarget || element.querySelector('.close-btn');
    target?.focus();
  });
}

function closeOverlay(element) {
  element.hidden = true;
  const open = [...document.querySelectorAll('.overlay')].some((overlay) => !overlay.hidden);
  if (!open) {
    document.body.classList.remove('overlay-open');
    if (state.lastFocus && document.contains(state.lastFocus)) {
      state.lastFocus.focus({ preventScroll: true });
    }
  }
}

function closeAllOverlays() {
  document.querySelectorAll('.overlay').forEach((overlay) => {
    overlay.hidden = true;
  });
  document.body.classList.remove('overlay-open');
}

/* ------------------------------------------------------------------ */
/* Guide                                                              */
/* ------------------------------------------------------------------ */

function buildGuide() {
  const now = Date.now();
  const windowStart = Math.floor(now / HALF_HOUR) * HALF_HOUR - HALF_HOUR;
  const windowEnd = windowStart + 4 * 60 * 60000;
  const span = windowEnd - windowStart;

  let ruler = '';
  for (let time = windowStart; time <= windowEnd; time += HALF_HOUR) {
    const percent = clamp(((time - windowStart) / span) * 100, 0, 99.5);
    const hour = new Date(time).getMinutes() === 0;
    ruler += `<span class="ruler-mark ${hour ? 'is-hour' : ''}" style="left:${percent}%">${formatTime(time)}</span>`;
  }
  els.guideTimebar.innerHTML = '<span class="guide-gutter-label">CHANNEL</span><div class="guide-ruler">' + ruler + '</div>';

  const rows = CHANNELS.map((channel, index) => {
    const items = scheduleBetween(channel, windowStart, windowEnd);
    const blocks = items.map((item) => {
      const from = Math.max(item.startMs, windowStart);
      const to = Math.min(item.endMs, windowEnd);
      if (to <= from) return '';
      const left = ((from - windowStart) / span) * 100;
      const width = ((to - from) / span) * 100;
      const onNow = now >= item.startMs && now < item.endMs;
      return `
        <button class="guide-program ${onNow ? 'is-now' : ''}" type="button"
          style="left:${left}%;width:calc(${width}% - 4px)"
          data-channel="${index}" data-title="${escapeHtml(item.title)}"
          aria-label="Tune to ${channel.num} ${escapeHtml(channel.name)} at ${formatTime(item.startMs)} for ${escapeHtml(item.title)}">
          <span class="guide-program-title">${escapeHtml(item.title)}</span>
          <span class="guide-program-time">${formatTime(item.startMs)} – ${formatTime(item.endMs)}</span>
        </button>
      `;
    }).join('');

    const nowLine = now >= windowStart && now < windowEnd
      ? `<span class="now-line" style="left:${((now - windowStart) / span) * 100}%"></span>`
      : '';

    return `
      <div class="guide-row">
        <button class="guide-channel" type="button" data-channel="${index}" aria-label="Tune to channel ${channel.num} ${escapeHtml(channel.name)}">
          <span class="guide-channel-num">${channel.num}</span>
          <span class="guide-channel-name">${escapeHtml(channel.name)}${favoriteStar(index, ' ')}</span>
        </button>
        <div class="guide-track">${blocks}${nowLine}</div>
      </div>
    `;
  }).join('');

  els.guideRows.innerHTML = rows;
  els.guideNow.textContent = formatTime(now);
}

function openGuide() {
  if (state.game.active) {
    showToast('FINISH SIGNAL HUNT FIRST');
    return;
  }
  if (!els.focusOverlay.hidden) closeOverlay(els.focusOverlay);
  buildGuide();
  openOverlay(els.guideOverlay, els.guideOverlay.querySelector('.close-btn'));
}

/* ------------------------------------------------------------------ */
/* Focus view                                                         */
/* ------------------------------------------------------------------ */

function updateFocus() {
  if (els.focusOverlay.hidden) return;
  const channel = CHANNELS[state.selected];
  const program = programAt(channel, Date.now());
  els.focusMeta.textContent = `CH ${channel.num} · ${channel.callsign} · ${channel.genre}`;
  els.focusTitle.textContent = channel.name;
  els.focusShow.textContent = program.title;
  els.focusTime.textContent = `${formatTime(program.startMs)} – ${formatTime(program.endMs)} · ${channel.desc}`;
  els.focusBug.textContent = `${channel.callsign} · CH ${channel.num}`;
}

function openFocus() {
  if (state.game.active) {
    showToast('FINISH SIGNAL HUNT FIRST');
    return;
  }
  if (!state.power) setPower(true, { silent: true });
  state.expanded = true;
  openOverlay(els.focusOverlay, els.focusOverlay.querySelector('.close-btn'));
  updateFocus();
  drawChannel(CHANNELS[state.selected], focusContext, performance.now() / 1000, { vignette: 0.38 });
}

function closeFocus() {
  state.expanded = false;
  closeOverlay(els.focusOverlay);
}

/* ------------------------------------------------------------------ */
/* Signal Hunt                                                        */
/* ------------------------------------------------------------------ */

function updateGameHud() {
  els.gameRound.textContent = String(Math.min(state.game.round || 1, ROUNDS));
  els.gameScore.textContent = padScore(state.game.score);
  els.gameStreak.textContent = String(state.game.streak);
  els.gameBest.textContent = padScore(state.game.best);
}

function startGame() {
  if (state.game.active) return;
  closeAllOverlays();
  if (!state.power) setPower(true, { silent: true });

  state.game.active = true;
  state.game.roundActive = false;
  state.game.round = 0;
  state.game.target = null;
  state.game.previousTarget = null;
  state.game.score = 0;
  state.game.streak = 0;
  state.game.hits = 0;
  state.game.misses = 0;
  state.game.savedLayout = state.layout;
  state.game.savedOrder = [...state.order];
  window.clearTimeout(state.game.nextTimer);

  document.body.classList.add('game-active');
  els.gameStrip.hidden = false;
  els.channelPanel.hidden = true;
  els.gamePanel.hidden = false;

  setLayout('4x3', { silent: true });
  state.order = shuffleOrder();
  renderGrid();
  updateSelectionUI();
  updateGameHud();
  tvElements.forEach((tv) => tv.classList.remove('correct', 'wrong', 'is-selected'));
  showToast('SIGNAL HUNT · FIND THE TARGET BROADCAST');
  tone(440, 0, 0.08, 'square', 0.025);
  tone(660, 0.09, 0.08, 'square', 0.025);
  nextRound();
}

function nextRound() {
  if (!state.game.active) return;
  if (state.game.round >= ROUNDS) {
    finishGame();
    return;
  }

  state.game.round += 1;
  state.game.roundActive = true;
  state.game.deadline = performance.now() + ROUND_MS;
  state.game.roundStarted = performance.now();

  let target = Math.floor(Math.random() * CHANNELS.length);
  while (target === state.game.previousTarget) {
    target = Math.floor(Math.random() * CHANNELS.length);
  }
  state.game.target = target;
  state.game.previousTarget = target;

  tvElements.forEach((tv) => tv.classList.remove('correct', 'wrong'));
  els.gameClue.textContent = `MATCH THIS BROADCAST · ROUND ${state.game.round} OF ${ROUNDS}`;
  els.gameClock.textContent = (ROUND_MS / 1000).toFixed(1);
  els.gameTimerFill.style.transform = 'scaleX(1)';
  updateGameHud();
}

function tickGame(now) {
  if (!state.game.active || !state.game.roundActive) return;
  const remaining = state.game.deadline - now;
  const ratio = clamp(remaining / ROUND_MS, 0, 1);
  els.gameClock.textContent = (Math.max(0, remaining) / 1000).toFixed(1);
  els.gameTimerFill.style.transform = `scaleX(${ratio})`;
  if (remaining <= 0) timeoutRound();
}

function timeoutRound() {
  if (!state.game.roundActive) return;
  state.game.roundActive = false;
  state.game.misses += 1;
  state.game.streak = 0;
  updateGameHud();
  if (state.game.target != null) {
    tvElements[state.game.target].classList.add('wrong');
  }
  playMiss();
  showToast(`SIGNAL LOST · TARGET WAS CH ${CHANNELS[state.game.target]?.num ?? '--'}`);
  state.game.nextTimer = window.setTimeout(() => {
    if (state.game.target != null) tvElements[state.game.target].classList.remove('wrong');
    if (state.game.active) nextRound();
  }, 1050);
}

function handleGuess(index) {
  if (!state.game.active || !state.game.roundActive) return;
  if (index === state.game.target) {
    state.game.roundActive = false;
    state.game.hits += 1;
    state.game.streak += 1;
    const remaining = Math.max(0, state.game.deadline - performance.now());
    const gained = 100 + Math.round(remaining / 1000) * 10 + (state.game.streak - 1) * 25;
    state.game.score += gained;
    updateGameHud();
    tvElements[index].classList.add('correct');
    playHit();
    showToast(`SIGNAL LOCKED · +${gained}`);
    els.gameClue.textContent = 'SIGNAL LOCKED';
    state.game.nextTimer = window.setTimeout(() => {
      if (!state.game.active) return;
      tvElements[index].classList.remove('correct');
      nextRound();
    }, 760);
  } else {
    state.game.misses += 1;
    state.game.streak = 0;
    state.game.score = Math.max(0, state.game.score - 25);
    state.game.deadline -= 2000;
    tvElements[index].classList.add('wrong');
    window.setTimeout(() => tvElements[index].classList.remove('wrong'), 400);
    updateGameHud();
    playMiss();
    showToast('MISS · -2.0 SECONDS');
  }
}

function finishGame() {
  state.game.roundActive = false;
  window.clearTimeout(state.game.nextTimer);
  const best = Math.max(state.game.best, state.game.score);
  state.game.best = best;
  writeSetting('best', best);

  const attempts = state.game.hits + state.game.misses;
  const accuracy = attempts ? Math.round((state.game.hits / attempts) * 100) : 0;
  const perfect = state.game.hits === ROUNDS;

  els.resultScore.textContent = padScore(state.game.score);
  els.resultHits.textContent = `${state.game.hits} / ${ROUNDS}`;
  els.resultBest.textContent = padScore(best);
  els.resultAccuracy.textContent = `${accuracy}%`;
  els.resultNote.textContent = perfect
    ? 'Flawless tuning. The control room approves.'
    : state.game.hits >= 3
      ? 'Strong signal. A few ghosts still in the machine.'
      : 'The wall got away from you. Try a slower sweep.';

  els.resultOverlay.hidden = false;
  document.body.classList.add('overlay-open');
  window.requestAnimationFrame(() => els.playAgainBtn.focus());
  playHit();
}

function restartGame() {
  els.resultOverlay.hidden = true;
  document.body.classList.remove('overlay-open');
  state.game.round = 0;
  state.game.score = 0;
  state.game.streak = 0;
  state.game.hits = 0;
  state.game.misses = 0;
  state.game.target = null;
  state.game.previousTarget = null;
  state.game.roundActive = false;
  state.order = shuffleOrder();
  state.layout = '4x3';
  renderGrid();
  syncCanvasResolution();
  updateGameHud();
  setLayout('4x3', { silent: true });
  nextRound();
}

function exitGame(options = {}) {
  if (!state.game.active && els.resultOverlay.hidden) return;
  window.clearTimeout(state.game.nextTimer);
  state.game.active = false;
  state.game.roundActive = false;
  state.game.target = null;
  els.resultOverlay.hidden = true;
  document.body.classList.remove('overlay-open');
  document.body.classList.remove('game-active');
  els.gameStrip.hidden = true;
  els.channelPanel.hidden = false;
  els.gamePanel.hidden = true;
  tvElements.forEach((tv) => tv.classList.remove('correct', 'wrong', 'is-selected'));

  state.order = state.game.savedOrder.length ? [...state.game.savedOrder] : CHANNELS.map((_, index) => index);
  const layout = LAYOUTS[state.game.savedLayout] ? state.game.savedLayout : '4x3';
  state.layout = layout;
  setLayout(layout, { silent: true });
  renderGrid();
  syncCanvasResolution();
  updateSelectionUI();
  updatePanel();
  updateGameHud();
  if (!options.silent) showToast('SIGNAL HUNT ENDED');
}

/* ------------------------------------------------------------------ */
/* Drawing                                                            */
/* ------------------------------------------------------------------ */

function drawWall(time) {
  if (!state.power) return;
  CHANNELS.forEach((channel, index) => {
    const tv = tvElements[index];
    if (tv.classList.contains('is-hidden')) return;
    drawChannel(channel, canvasContexts[index], time);
  });
}

function loop(timestamp) {
  window.requestAnimationFrame(loop);
  if (document.hidden) return;

  const interval = reducedMotion ? 140 : 33;
  if (timestamp - lastFrame < interval) return;
  lastFrame = timestamp;

  const time = timestamp / 1000;
  if (state.power) {
    drawWall(time);
    if (!els.focusOverlay.hidden) {
      drawChannel(CHANNELS[state.selected], focusContext, time, { vignette: 0.38 });
    }
    if (state.game.active && state.game.target != null) {
      drawChannel(CHANNELS[state.game.target], targetContext, time * 0.92, { vignette: 0.3 });
    }
  }
  if (state.game.active) tickGame(timestamp);
}

/* ------------------------------------------------------------------ */
/* Events                                                             */
/* ------------------------------------------------------------------ */

els.layoutSwitch.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-layout]');
  if (!button) return;
  if (state.game.active) return;
  setLayout(button.dataset.layout);
  flashTile(state.selected);
});

els.guideBtn.addEventListener('click', openGuide);
els.panelGuideBtn.addEventListener('click', openGuide);
els.gameBtn.addEventListener('click', startGame);
els.soundBtn.addEventListener('click', toggleSound);
els.powerBtn.addEventListener('click', () => setPower(!state.power));
els.prevBtn.addEventListener('click', () => selectChannel((state.selected - 1 + CHANNELS.length) % CHANNELS.length, { scroll: true }));
els.nextBtn.addEventListener('click', () => selectChannel((state.selected + 1) % CHANNELS.length, { scroll: true }));
els.expandBtn.addEventListener('click', openFocus);
els.favBtn.addEventListener('click', toggleFavorite);
els.shuffleBtn.addEventListener('click', shuffleWall);
els.quitGameBtn.addEventListener('click', () => exitGame());
els.focusPrev.addEventListener('click', () => selectChannel((state.selected - 1 + CHANNELS.length) % CHANNELS.length, { reveal: false, silent: true }));
els.focusNext.addEventListener('click', () => selectChannel((state.selected + 1) % CHANNELS.length, { reveal: false, silent: true }));
els.focusClose.addEventListener('click', closeFocus);
els.playAgainBtn.addEventListener('click', restartGame);
els.backToWallBtn.addEventListener('click', () => exitGame());

els.brandHome.addEventListener('click', (event) => {
  event.preventDefault();
  showToast('TVGRID CONTROL ROOM');
});

els.guideRows.addEventListener('click', (event) => {
  const program = event.target.closest('.guide-program');
  const channelButton = event.target.closest('.guide-channel');
  const target = program || channelButton;
  if (!target) return;
  const index = Number(target.dataset.channel);
  const title = program?.dataset.title;
  selectChannel(index, { reveal: true, scroll: true });
  closeOverlay(els.guideOverlay);
  flashTile(index);
  showToast(title ? `TUNED TO CH ${CHANNELS[index].num} · ${title.toUpperCase()}` : `TUNED TO CH ${CHANNELS[index].num} · ${CHANNELS[index].name}`);
});

document.querySelectorAll('[data-close]').forEach((button) => {
  button.addEventListener('click', () => {
    const overlay = document.getElementById(button.dataset.close);
    if (overlay) closeOverlay(overlay);
  });
});

[els.guideOverlay, els.focusOverlay, els.resultOverlay].forEach((overlay) => {
  overlay.addEventListener('click', (event) => {
    if (event.target !== overlay) return;
    if (overlay === els.resultOverlay) {
      exitGame();
    } else if (overlay === els.focusOverlay) {
      closeFocus();
    } else {
      closeOverlay(overlay);
    }
  });
});

document.addEventListener('keydown', (event) => {
  const target = event.target;
  const typing = target instanceof HTMLElement && (
    target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
  if (typing) return;

  if (event.key === 'Escape') {
    if (!els.resultOverlay.hidden) {
      exitGame();
      event.preventDefault();
      return;
    }
    if (!els.guideOverlay.hidden) {
      closeOverlay(els.guideOverlay);
      event.preventDefault();
      return;
    }
    if (!els.focusOverlay.hidden) {
      closeFocus();
      event.preventDefault();
      return;
    }
    if (state.game.active) {
      exitGame();
      event.preventDefault();
    }
    return;
  }

  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (!els.resultOverlay.hidden) return;

  const key = event.key.toLowerCase();
  if (key === 'g') {
    event.preventDefault();
    if (els.guideOverlay.hidden) openGuide();
    else closeOverlay(els.guideOverlay);
    return;
  }
  if (key === 'p') {
    event.preventDefault();
    setPower(!state.power);
    return;
  }
  if (key === 's') {
    event.preventDefault();
    if (!state.game.active) startGame();
    return;
  }

  if (!els.guideOverlay.hidden || state.game.active) return;

  const columns = LAYOUTS[state.layout].cols;
  const count = LAYOUTS[state.layout].count;
  const currentPosition = state.order.indexOf(state.selected);
  let nextPosition = currentPosition;

  if (event.key === 'ArrowLeft') nextPosition = currentPosition - 1;
  else if (event.key === 'ArrowRight') nextPosition = currentPosition + 1;
  else if (event.key === 'ArrowUp') nextPosition = currentPosition - columns;
  else if (event.key === 'ArrowDown') nextPosition = currentPosition + columns;
  else if (event.key === 'Enter' && !els.focusOverlay.hidden) {
    openFocus();
    event.preventDefault();
    return;
  } else {
    return;
  }

  event.preventDefault();
  if (nextPosition < 0 || nextPosition >= count) return;
  const channelIndex = state.order[nextPosition];
  selectChannel(channelIndex, { silent: true });
  tvElements[channelIndex].focus({ preventScroll: true });
  tvElements[channelIndex].scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
});

/* ------------------------------------------------------------------ */
/* Boot                                                               */
/* ------------------------------------------------------------------ */

function init() {
  buildWall();
  updateLayoutButtons();
  els.soundBtn.setAttribute('aria-pressed', String(state.sound));
  els.powerBtn.setAttribute('aria-pressed', String(state.power));
  setPower(state.power, { silent: true });
  renderGrid();
  syncCanvasResolution();
  updateTileLabels();
  updateSelectionUI();
  updatePanel();
  updateTicker();
  updateClock();
  updateGameHud();
  els.tvGrid.dataset.layout = state.layout;
  els.wallCount.textContent = `${LAYOUTS[state.layout].count} CH / ${state.layout.replace('x', '×')}`;
  drawWall(performance.now() / 1000);
  window.requestAnimationFrame(loop);

  window.setInterval(updateClock, 1000);
  window.setInterval(() => {
    updatePanel();
    updateTileLabels();
  }, 15000);
  window.setInterval(updateTicker, 60000);
}

init();
