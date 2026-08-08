'use strict';

/* ============ Audio ============ */

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function beep(freq, duration, type, volume) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.value = volume != null ? volume : 0.3;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch (e) { /* audio not available */ }
}

function playWarningBeep() { beep(880, 0.18, 'sine', 0.3); }
function playTickBeep() { beep(1046, 0.12, 'sine', 0.35); }
function playEndBuzzer() {
  beep(220, 0.9, 'sawtooth', 0.25);
  setTimeout(() => beep(220, 0.9, 'sawtooth', 0.25), 250);
}

/* ============ Time formatting ============ */

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

/* ============ Timer engine ============ */

class TimerEngine {
  constructor({ mode, totalSeconds, onTick, onFinish, onSecondChange }) {
    this.mode = mode;                 // 'countdown' | 'countup'
    this.totalSeconds = totalSeconds; // countdown target / countup starting display
    this.elapsed = 0;                 // seconds elapsed since (re)start
    this.running = false;
    this.startTs = null;
    this.intervalId = null;
    this.lastWholeSecond = null;
    this.onTick = onTick;
    this.onFinish = onFinish;
    this.onSecondChange = onSecondChange; // called once per whole-second transition
    this.finished = false;
  }

  currentValue() {
    if (this.mode === 'countdown') {
      return Math.max(0, this.totalSeconds - this.elapsed);
    }
    return this.elapsed;
  }

  setTotal(totalSeconds) {
    this.totalSeconds = totalSeconds;
    this.reset();
  }

  start() {
    if (this.running || this.finished) return;
    this.running = true;
    this.startTs = performance.now() - this.elapsed * 1000;
    this.intervalId = setInterval(() => this._tick(), 100);
    this._tick();
  }

  pause() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  reset() {
    this.pause();
    this.elapsed = 0;
    this.finished = false;
    this.lastWholeSecond = null;
    if (this.onTick) this.onTick(this.currentValue(), this);
  }

  _tick() {
    this.elapsed = (performance.now() - this.startTs) / 1000;

    if (this.mode === 'countdown' && this.elapsed >= this.totalSeconds) {
      this.elapsed = this.totalSeconds;
      const val = this.currentValue();
      if (this.onTick) this.onTick(val, this);
      this._emitSecondChange(0);
      this.finished = true;
      this.pause();
      if (this.onFinish) this.onFinish();
      return;
    }

    const val = this.currentValue();
    if (this.onTick) this.onTick(val, this);

    const displaySecond = this.mode === 'countdown' ? Math.ceil(val - 0.0001) : Math.floor(val);
    this._emitSecondChange(displaySecond);
  }

  _emitSecondChange(displaySecond) {
    if (this.lastWholeSecond === displaySecond) return;
    this.lastWholeSecond = displaySecond;
    if (this.onSecondChange) this.onSecondChange(displaySecond);
  }
}

/* ============ Wheel picker ============ */

const ITEM_H = 40;

function buildWheelColumn(el, max, initial) {
  el.innerHTML = '';
  for (let i = 0; i <= max; i++) {
    const div = document.createElement('div');
    div.className = 'wheel-item';
    div.textContent = String(i).padStart(2, '0');
    div.dataset.value = i;
    el.appendChild(div);
  }
  // padding so first/last item can center under the highlight
  el.style.scrollPaddingTop = ITEM_H + 'px';
  el.style.paddingTop = ITEM_H + 'px';
  el.style.paddingBottom = ITEM_H + 'px';
  el.scrollTop = initial * ITEM_H;
}

function getWheelValue(el) {
  const idx = Math.round(el.scrollTop / ITEM_H);
  return idx;
}

function setWheelSelectedHighlight(el) {
  const idx = getWheelValue(el);
  Array.from(el.children).forEach((child, i) => {
    child.classList.toggle('selected', i === idx);
  });
}

function initWheelPicker(minEl, secEl, initialMinutes, initialSeconds, onChange) {
  buildWheelColumn(minEl, 59, initialMinutes);
  buildWheelColumn(secEl, 59, initialSeconds);
  setWheelSelectedHighlight(minEl);
  setWheelSelectedHighlight(secEl);

  let scrollTimeout;
  function handleScroll(el) {
    setWheelSelectedHighlight(el);
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const min = getWheelValue(minEl);
      const sec = getWheelValue(secEl);
      if (onChange) onChange(min, sec);
    }, 120);
  }
  minEl.addEventListener('scroll', () => handleScroll(minEl));
  secEl.addEventListener('scroll', () => handleScroll(secEl));
}

function getWheelTotalSeconds(minEl, secEl) {
  return getWheelValue(minEl) * 60 + getWheelValue(secEl);
}

/* ============ Main timer wiring ============ */

const DEFAULT_PRESETS = [60, 120, 150, 180, 300];

const mainDisplay = document.getElementById('mainDisplay');
const mainPresets = document.getElementById('mainPresets');
const mainStartBtn = document.getElementById('mainStart');
const mainPauseBtn = document.getElementById('mainPause');
const mainResetBtn = document.getElementById('mainReset');
const mainWheelMin = document.getElementById('mainWheelMin');
const mainWheelSec = document.getElementById('mainWheelSec');
const mainApplyCustom = document.getElementById('mainApplyCustom');
const mainCustomDetails = document.getElementById('mainCustomDetails');
const modeButtons = document.querySelectorAll('.mode-btn');

let mainSoundMode = 'alert'; // 'alert' = 30s/10s/5-1 beeps, 'silent' = final buzzer only
let mainTotalSeconds = 120;

const mainTimer = new TimerEngine({
  mode: 'countdown',
  totalSeconds: mainTotalSeconds,
  onTick: (val) => {
    mainDisplay.textContent = formatTime(val);
    mainDisplay.classList.remove('warn', 'critical', 'finished');
    if (val <= 0) mainDisplay.classList.add('finished');
    else if (val <= 10) mainDisplay.classList.add('critical');
    else if (val <= 30) mainDisplay.classList.add('warn');
  },
  onSecondChange: (sec) => {
    if (mainSoundMode !== 'alert') return;
    if (sec === 30 || sec === 10) playWarningBeep();
    else if (sec >= 1 && sec <= 5) playTickBeep();
  },
  onFinish: () => {
    playEndBuzzer();
    mainStartBtn.disabled = false;
    mainPauseBtn.disabled = true;
  }
});
mainTimer.onTick(mainTimer.currentValue(), mainTimer);

function setMainPresetActive(seconds) {
  Array.from(mainPresets.children).forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.seconds) === seconds);
  });
}

function setMainTotal(seconds) {
  mainTotalSeconds = seconds;
  mainTimer.setTotal(seconds);
  mainStartBtn.disabled = false;
  mainPauseBtn.disabled = true;
}

mainPresets.addEventListener('click', (e) => {
  const btn = e.target.closest('.preset-btn');
  if (!btn) return;
  const seconds = Number(btn.dataset.seconds);
  setMainPresetActive(seconds);
  setMainTotal(seconds);
});

modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    modeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mainSoundMode = btn.dataset.mode;
    mainTimer.reset();
    mainDisplay.classList.remove('warn', 'critical', 'finished');
    mainDisplay.textContent = formatTime(mainTotalSeconds);
    mainStartBtn.disabled = false;
    mainPauseBtn.disabled = true;
  });
});

initWheelPicker(mainWheelMin, mainWheelSec, 2, 0);

mainApplyCustom.addEventListener('click', () => {
  const seconds = getWheelTotalSeconds(mainWheelMin, mainWheelSec);
  setMainPresetActive(-1);
  setMainTotal(seconds || 1);
  mainCustomDetails.open = false;
});

mainStartBtn.addEventListener('click', () => {
  getAudioCtx();
  mainTimer.start();
  mainStartBtn.disabled = true;
  mainPauseBtn.disabled = false;
});

mainPauseBtn.addEventListener('click', () => {
  mainTimer.pause();
  mainStartBtn.disabled = false;
  mainPauseBtn.disabled = true;
});

mainResetBtn.addEventListener('click', () => {
  mainTimer.reset();
  mainStartBtn.disabled = false;
  mainPauseBtn.disabled = true;
  mainDisplay.classList.remove('warn', 'critical', 'finished');
});

// initialize with 2 minute preset active
setMainPresetActive(120);
mainDisplay.textContent = formatTime(120);

/* ============ Sub timer wiring ============ */

const subDisplay = document.getElementById('subDisplay');
const subPresets = document.getElementById('subPresets');
const subStartBtn = document.getElementById('subStart');
const subPauseBtn = document.getElementById('subPause');
const subResetBtn = document.getElementById('subReset');

let subTotalSeconds = 60;

const subTimer = new TimerEngine({
  mode: 'countdown',
  totalSeconds: subTotalSeconds,
  onTick: (val) => {
    subDisplay.textContent = formatTime(val);
    subDisplay.classList.toggle('finished', val <= 0);
  },
  onFinish: () => {
    playEndBuzzer();
    subStartBtn.disabled = false;
    subPauseBtn.disabled = true;
  }
});
subTimer.onTick(subTimer.currentValue(), subTimer);

function setSubPresetActive(seconds) {
  Array.from(subPresets.children).forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.seconds) === seconds);
  });
}

subPresets.addEventListener('click', (e) => {
  const btn = e.target.closest('.preset-btn');
  if (!btn) return;
  const seconds = Number(btn.dataset.seconds);
  setSubPresetActive(seconds);
  subTotalSeconds = seconds;
  subTimer.setTotal(seconds);
  subStartBtn.disabled = false;
  subPauseBtn.disabled = true;
  subDisplay.classList.remove('finished');
});

subStartBtn.addEventListener('click', () => {
  getAudioCtx();
  subTimer.start();
  subStartBtn.disabled = true;
  subPauseBtn.disabled = false;
});

subPauseBtn.addEventListener('click', () => {
  subTimer.pause();
  subStartBtn.disabled = false;
  subPauseBtn.disabled = true;
});

subResetBtn.addEventListener('click', () => {
  subTimer.reset();
  subStartBtn.disabled = false;
  subPauseBtn.disabled = true;
  subDisplay.classList.remove('finished');
});

setSubPresetActive(60);
subDisplay.textContent = formatTime(60);

/* ============ Score board ============ */

const scoreEls = {
  home: document.getElementById('scoreHome'),
  away: document.getElementById('scoreAway'),
};
const scores = { home: 0, away: 0 };

document.querySelectorAll('.score-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const team = btn.dataset.team;
    const delta = Number(btn.dataset.delta);
    scores[team] = Math.max(0, scores[team] + delta);
    scoreEls[team].textContent = scores[team];
  });
});

document.getElementById('scoreReset').addEventListener('click', () => {
  scores.home = 0;
  scores.away = 0;
  scoreEls.home.textContent = '0';
  scoreEls.away.textContent = '0';
  fitScoreHome();
  fitScoreAway();
});

/* ============ Fit big digits to available width ============ */
/* The CSS clamp() sizes fonts off viewport height; on tall/narrow screens
   that can produce text wider than its container, so this trims the
   font-size back down to whatever actually fits. */

function makeWidthFitter(el) {
  return function fit() {
    el.style.fontSize = '';
    const container = el.parentElement;
    const cs = getComputedStyle(container);
    const paddingX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const available = container.clientWidth - paddingX;
    const textWidth = el.scrollWidth;
    if (textWidth > available && available > 0) {
      const naturalSize = parseFloat(getComputedStyle(el).fontSize);
      const scale = (available / textWidth) * 0.94;
      el.style.fontSize = (naturalSize * scale) + 'px';
    }
  };
}

const fitMainDisplay = makeWidthFitter(mainDisplay);
const fitSubDisplay = makeWidthFitter(subDisplay);
const fitScoreHome = makeWidthFitter(scoreEls.home);
const fitScoreAway = makeWidthFitter(scoreEls.away);

function fitAllDisplays() {
  fitMainDisplay();
  fitSubDisplay();
  fitScoreHome();
  fitScoreAway();
}

window.addEventListener('resize', fitAllDisplays);
window.addEventListener('orientationchange', () => setTimeout(fitAllDisplays, 60));
fitAllDisplays();
