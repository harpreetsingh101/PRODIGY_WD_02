/* ═══════════════════════════════════════════════════════════════
   SOUND ENGINE — Web Audio API
   ═══════════════════════════════════════════════════════════════ */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/* --- Lap Beep: two-tone chirp, clean & professional --- */
function playBeep() {
  const ctx = getCtx(), now = ctx.currentTime;
  // Tone 1
  const o1 = ctx.createOscillator(), g1 = ctx.createGain();
  o1.connect(g1); g1.connect(ctx.destination);
  o1.type = 'sine';
  o1.frequency.setValueAtTime(1320, now);
  o1.frequency.exponentialRampToValueAtTime(880, now + 0.12);
  g1.gain.setValueAtTime(0.22, now);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
  o1.start(now); o1.stop(now + 0.28);
  // Tone 2 — delayed softer confirmation
  const o2 = ctx.createOscillator(), g2 = ctx.createGain();
  o2.connect(g2); g2.connect(ctx.destination);
  o2.type = 'sine';
  o2.frequency.setValueAtTime(1100, now + 0.15);
  o2.frequency.exponentialRampToValueAtTime(780, now + 0.34);
  g2.gain.setValueAtTime(0, now);
  g2.gain.linearRampToValueAtTime(0.16, now + 0.16);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
  o2.start(now + 0.15); o2.stop(now + 0.42);
}

/* --- Mechanical Click: short noise burst --- */
function playClick() {
  const ctx = getCtx(), now = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * 0.04);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/len, 12);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const hp  = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
  const g   = ctx.createGain(); g.gain.setValueAtTime(0.28, now);
  src.connect(hp); hp.connect(g); g.connect(ctx.destination);
  src.start(now);
}

/* --- Countdown Alarm: dramatic 3-note fanfare --- */
function playAlarm() {
  const ctx = getCtx(), now = ctx.currentTime;
  const notes = [
    { freq: 880,  start: 0,    dur: 0.38 },
    { freq: 1100, start: 0.32, dur: 0.38 },
    { freq: 1320, start: 0.64, dur: 0.55 }
  ];
  notes.forEach(n => {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(n.freq, now + n.start);
    gain.gain.setValueAtTime(0.24, now + n.start);
    gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);
    osc.start(now + n.start);
    osc.stop(now + n.start + n.dur);
  });
}

/* ═══════════════════════════════════════════════════════════════
   UTILITY
   ═══════════════════════════════════════════════════════════════ */
function pad2(n) { return String(n).padStart(2,'0'); }
function fmtSW(ms) {                               // MM:SS.cs
  const m  = Math.floor(ms / 60000);
  const s  = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000)  / 10);
  return pad2(m) + ':' + pad2(s) + '.' + pad2(cs);
}
function fmtCD(ms) {                               // HH:MM:SS
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000)   / 1000);
  return pad2(h) + ':' + pad2(m) + ':' + pad2(s);
}
function escHtml(s) { const d=document.createElement('div'); d.appendChild(document.createTextNode(s)); return d.innerHTML; }

const CIRC = 2 * Math.PI * 108; // ring circumference (r=108)

/* ═══════════════════════════════════════════════════════════════
   TAB SWITCHER
   ═══════════════════════════════════════════════════════════════ */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    playClick();
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

/* ═══════════════════════════════════════════════════════════════
   STOPWATCH
   ═══════════════════════════════════════════════════════════════ */
(function initStopwatch() {
  let elapsed = 0, startedAt = 0, running = false, intervalId = null, laps = [];

  const display     = document.getElementById('sw-display');
  const label       = document.getElementById('sw-label');
  const startBtn    = document.getElementById('sw-startBtn');
  const lapBtn      = document.getElementById('sw-lapBtn');
  const resetBtn    = document.getElementById('sw-resetBtn');
  const ring        = document.getElementById('sw-ring');
  const bgGlow      = document.getElementById('bgGlow');
  const lapsPanel   = document.getElementById('sw-lapsPanel');
  const lapsList    = document.getElementById('sw-lapsList');
  const lapCount    = document.getElementById('sw-lapCount');
  const saveTrigger = document.getElementById('sw-saveTrigger');
  const saveSection = document.getElementById('sw-saveSection');
  const saveInput   = document.getElementById('sw-saveInput');
  const saveBtn     = document.getElementById('sw-saveBtn');
  const savedToggle = document.getElementById('sw-savedToggle');
  const savedArrow  = document.getElementById('sw-savedArrow');
  const savedList   = document.getElementById('sw-savedList');
  const savedCount  = document.getElementById('sw-savedCount');

  ring.style.strokeDasharray  = CIRC;
  ring.style.strokeDashoffset = CIRC;

  function now() { return running ? elapsed + (Date.now() - startedAt) : elapsed; }

  function updateRing(ms) {
    ring.style.strokeDashoffset = CIRC * (1 - (ms % 60000) / 60000);
  }

  let flashTimer = null;
  function lapFlash() {
    display.classList.add('lap-flash');
    ring.classList.add('lap-flash');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      display.classList.remove('lap-flash');
      ring.classList.remove('lap-flash');
    }, 380);
  }

  function renderLaps() {
    lapsList.innerHTML = '';
    lapCount.textContent = laps.length;
    if (!laps.length) { lapsPanel.style.display='none'; return; }
    lapsPanel.style.display = 'block';

    let fastIdx=-1, slowIdx=-1;
    if (laps.length > 1) {
      let mn=Infinity, mx=-Infinity;
      laps.forEach((l,i) => {
        if (l.lapTime < mn) { mn=l.lapTime; fastIdx=i; }
        if (l.lapTime > mx) { mx=l.lapTime; slowIdx=i; }
      });
    }
    for (let i=laps.length-1; i>=0; i--) {
      const l = laps[i];
      const row = document.createElement('div');
      row.className = 'lap-item' + (i===fastIdx?' fastest':'') + (i===slowIdx?' slowest':'');
      let badge = '';
      if (i===fastIdx) badge = '<span class="lap-badge">Best</span>';
      if (i===slowIdx) badge = '<span class="lap-badge">Slow</span>';
      row.innerHTML =
        `<div class="lap-num">Lap <span class="num">${i+1}</span></div>
         <div class="lap-times">
           <div class="lap-time-block"><div class="lap-time-label">Split</div>
             <div class="lap-time">${fmtSW(l.lapTime)}${badge}</div></div>
           <div class="lap-time-block"><div class="lap-time-label">Total</div>
             <div class="lap-time total">${fmtSW(l.totalTime)}</div></div>
         </div>`;
      lapsList.appendChild(row);
    }
  }

  // --- Saved sessions (localStorage) ---
  function loadSessions() { try { return JSON.parse(localStorage.getItem('chrono-sw') || '[]'); } catch{return[];} }
  function saveSessions(arr) { localStorage.setItem('chrono-sw', JSON.stringify(arr)); }
  function renderSaved() {
    const sessions = loadSessions();
    savedCount.textContent = sessions.length;
    savedList.innerHTML = '';
    if (!sessions.length) { savedList.innerHTML='<div class="empty-state">No saved sessions yet.<br>Complete a run and save it!</div>'; return; }
    sessions.forEach(s => {
      const best = s.laps.length>1 ? Math.min(...s.laps.map(l=>l.lapTime)) : null;
      const el = document.createElement('div'); el.className='saved-item';
      el.innerHTML =
        `<div class="saved-item-left">
           <div class="saved-name">${escHtml(s.name)}</div>
           <div class="saved-meta">
             <span>${s.date}</span>
             <span>${s.laps.length} lap${s.laps.length!==1?'s':''}</span>
             <span>Total: ${fmtSW(s.totalTime)}</span>
             ${best!==null?'<span class="gold">Best: '+fmtSW(best)+'</span>':''}
           </div></div>
         <button class="saved-delete" data-id="${s.id}">×</button>`;
      savedList.appendChild(el);
    });
  }

  function hideSave() { saveTrigger.style.display='none'; saveSection.style.display='none'; saveInput.value=''; }

  // --- Controls ---
  function start() {
    playClick();
    elapsed = now(); startedAt = Date.now(); running = true;
    startBtn.textContent = 'PAUSE';
    startBtn.classList.replace('btn-start','btn-stop');
    lapBtn.disabled = false;
    label.textContent = 'Running';
    bgGlow.classList.add('running');
    hideSave();
    intervalId = setInterval(() => { const t=now(); display.textContent=fmtSW(t); updateRing(t); }, 30);
  }
  function pause() {
    playClick();
    elapsed = now(); running = false; clearInterval(intervalId);
    startBtn.textContent = 'RESUME';
    startBtn.classList.replace('btn-stop','btn-start');
    label.textContent = 'Paused';
    bgGlow.classList.remove('running');
    if (laps.length) saveTrigger.style.display='inline-block';
  }
  function lap() {
    playBeep(); lapFlash();
    const t = now();
    const prev = laps.length ? laps[laps.length-1].totalTime : 0;
    laps.push({ lapTime: t-prev, totalTime: t });
    label.textContent = 'Lap ' + laps.length;
    renderLaps();
  }
  function reset() {
    playClick();
    clearInterval(intervalId); running=false; elapsed=0; laps=[];
    display.textContent = '00:00.00';
    label.textContent = 'Ready';
    ring.style.strokeDashoffset = CIRC;
    startBtn.textContent = 'START';
    startBtn.classList.replace('btn-stop','btn-start');
    lapBtn.disabled = true;
    bgGlow.classList.remove('running');
    hideSave(); renderLaps();
  }

  startBtn.addEventListener('click', () => running ? pause() : start());
  lapBtn.addEventListener('click',   () => { if(running) lap(); });
  resetBtn.addEventListener('click', reset);

  saveTrigger.addEventListener('click', () => {
    playClick();
    saveTrigger.style.display='none';
    saveSection.style.display='inline-flex';
    saveInput.focus();
  });
  saveBtn.addEventListener('click', () => {
    const name = saveInput.value.trim();
    if (!name || !laps.length) return;
    playClick();
    const sessions = loadSessions();
    sessions.unshift({
      id: Date.now(), name,
      laps: [...laps], totalTime: elapsed,
      date: new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})
    });
    saveSessions(sessions);
    hideSave(); renderSaved();
  });
  saveInput.addEventListener('keydown', e => { if(e.key==='Enter') saveBtn.click(); });

  savedToggle.addEventListener('click', () => {
    const open = savedList.style.display !== 'none';
    savedList.style.display = open ? 'none' : 'block';
    savedArrow.classList.toggle('open', !open);
    if (!open) renderSaved();
  });
  savedList.addEventListener('click', e => {
    const btn = e.target.closest('.saved-delete');
    if (!btn) return;
    playClick();
    const sessions = loadSessions().filter(s => s.id !== Number(btn.dataset.id));
    saveSessions(sessions); renderSaved();
  });

  renderSaved();
})();

/* ═══════════════════════════════════════════════════════════════
   COUNTDOWN
   ═══════════════════════════════════════════════════════════════ */
(function initCountdown() {
  let totalMs = 0, remainMs = 0, startedAt = 0, running = false, intervalId = null;

  const picker     = document.getElementById('cd-picker');
  const timerWrap  = document.getElementById('cd-timerWrap');
  const finished   = document.getElementById('cd-finished');
  const display    = document.getElementById('cd-display');
  const label      = document.getElementById('cd-label');
  const ring       = document.getElementById('cd-ring');
  const startBtn   = document.getElementById('cd-startBtn');
  const pauseBtn   = document.getElementById('cd-pauseBtn');
  const resetBtn   = document.getElementById('cd-resetBtn');
  const doneBtn    = document.getElementById('cd-doneBtn');
  const hVal       = document.getElementById('cd-hVal');
  const mVal       = document.getElementById('cd-mVal');
  const sVal       = document.getElementById('cd-sVal');

  ring.style.strokeDasharray  = CIRC;
  ring.style.strokeDashoffset = 0; // full at start

  // Picker state
  let pH=0, pM=5, pS=0;
  function syncPickerUI() { hVal.textContent=pad2(pH); mVal.textContent=pad2(pM); sVal.textContent=pad2(pS); }

  document.querySelectorAll('.cd-arrow').forEach(btn => {
    btn.addEventListener('click', () => {
      playClick();
      const unit = btn.dataset.unit;
      const isUp = btn.classList.contains('up');
      if (unit==='h') { pH = (pH + (isUp?1:-1) + 24) % 24; }
      if (unit==='m') { pM = (pM + (isUp?1:-1) + 60) % 60; }
      if (unit==='s') { pS = (pS + (isUp?1:-1) + 60) % 60; }
      syncPickerUI();
    });
  });

  function getRemainingNow() {
    return running ? remainMs - (Date.now() - startedAt) : remainMs;
  }

  function updateRingAndColors(ms) {
    const pct = totalMs > 0 ? ms / totalMs : 0;
    ring.style.strokeDashoffset = CIRC * (1 - pct);

    // Remove all colour classes first
    ring.classList.remove('cd-mid','cd-low','cd-urgent');
    display.classList.remove('cd-mid','cd-low','cd-urgent');

    if (pct <= 0.1) {
      ring.classList.add('cd-urgent');
      display.classList.add('cd-urgent');
    } else if (pct <= 0.25) {
      ring.classList.add('cd-low');
      display.classList.add('cd-low');
    } else if (pct <= 0.5) {
      ring.classList.add('cd-mid');
      display.classList.add('cd-mid');
    }
  }

  function showPicker()  { picker.style.display='flex'; timerWrap.style.display='none'; finished.style.display='none'; }
  function showTimer()   { picker.style.display='none'; timerWrap.style.display='block'; finished.style.display='none'; }
  function showFinished(){ picker.style.display='none'; timerWrap.style.display='none'; finished.style.display='flex'; }

  function start() {
    playClick();
    totalMs = (pH*3600 + pM*60 + pS) * 1000;
    if (totalMs === 0) return; // don't start at 0
    remainMs  = totalMs;
    startedAt = Date.now();
    running   = true;
    showTimer();
    display.textContent = fmtCD(remainMs);
    updateRingAndColors(remainMs);
    label.textContent = 'Counting down';

    intervalId = setInterval(() => {
      const left = getRemainingNow();
      if (left <= 0) {
        clearInterval(intervalId); running = false;
        display.textContent = '00:00:00';
        updateRingAndColors(0);
        playAlarm();
        setTimeout(showFinished, 600);
        return;
      }
      remainMs = left; startedAt = Date.now();
      display.textContent = fmtCD(left);
      updateRingAndColors(left);
    }, 80);
  }

  function pause() {
    playClick();
    remainMs = getRemainingNow(); running = false; clearInterval(intervalId);
    pauseBtn.textContent = 'RESUME';
    pauseBtn.classList.replace('btn-stop','btn-start');
    label.textContent = 'Paused';
  }
  function resume() {
    playClick();
    startedAt = Date.now(); running = true;
    pauseBtn.textContent = 'PAUSE';
    pauseBtn.classList.replace('btn-start','btn-stop');
    label.textContent = 'Counting down';
    intervalId = setInterval(() => {
      const left = getRemainingNow();
      if (left <= 0) {
        clearInterval(intervalId); running=false;
        display.textContent='00:00:00';
        updateRingAndColors(0);
        playAlarm();
        setTimeout(showFinished,600);
        return;
      }
      remainMs = left; startedAt = Date.now();
      display.textContent = fmtCD(left);
      updateRingAndColors(left);
    }, 80);
  }
  function reset() {
    playClick();
    clearInterval(intervalId); running=false;
    remainMs=0; totalMs=0;
    ring.classList.remove('cd-mid','cd-low','cd-urgent');
    display.classList.remove('cd-mid','cd-low','cd-urgent');
    pauseBtn.textContent = 'PAUSE';
    pauseBtn.classList.replace('btn-start','btn-stop');
    showPicker();
  }

  startBtn.addEventListener('click',  start);
  pauseBtn.addEventListener('click',  () => running ? pause() : resume());
  resetBtn.addEventListener('click',  reset);
  doneBtn.addEventListener('click',   () => { playClick(); showPicker(); });
})();

/* ═══════════════════════════════════════════════════════════════
   ANALOG CLOCK
   ═══════════════════════════════════════════════════════════════ */
(function initClock() {
  const svg        = document.getElementById('clockSvg');
  const markersG   = document.getElementById('clockMarkers');
  const hourHand   = document.getElementById('hourHand');
  const minuteHand = document.getElementById('minuteHand');
  const secondHand = document.getElementById('secondHand');
  const secondTail = document.getElementById('secondTail');
  const digital    = document.getElementById('clockDigital');
  const dateEl     = document.getElementById('clockDate');

  const CX=120, CY=120, R=108;

  // --- Draw markers & numbers ---
  for (let i=0; i<60; i++) {
    const angle = (i / 60) * 2 * Math.PI - Math.PI/2;
    const isMajor = i % 5 === 0;
    const innerR  = isMajor ? R - 10 : R - 5;
    const outerR  = R - 1;
    const x1 = CX + outerR * Math.cos(angle);
    const y1 = CY + outerR * Math.sin(angle);
    const x2 = CX + innerR * Math.cos(angle);
    const y2 = CY + innerR * Math.sin(angle);
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',x1); line.setAttribute('y1',y1);
    line.setAttribute('x2',x2); line.setAttribute('y2',y2);
    line.setAttribute('class', isMajor ? 'clock-marker clock-marker-major' : 'clock-marker');
    markersG.appendChild(line);

    if (isMajor) {
      const num = i===0 ? 12 : i/5;
      const numR = R - 22;
      const text = document.createElementNS('http://www.w3.org/2000/svg','text');
      text.setAttribute('x', CX + numR * Math.cos(angle));
      text.setAttribute('y', CY + numR * Math.sin(angle));
      text.setAttribute('class','clock-number');
      text.textContent = num;
      markersG.appendChild(text);
    }
  }

  // --- Rotate a hand element around centre ---
  function rotateHand(el, angleDeg, length) {
    const rad  = (angleDeg - 90) * Math.PI / 180;
    const x2   = CX + length * Math.cos(rad);
    const y2   = CY + length * Math.sin(rad);
    el.setAttribute('x2', x2);
    el.setAttribute('y2', y2);
  }
  function rotateTail(el, angleDeg, length) {
    const rad  = (angleDeg - 90 + 180) * Math.PI / 180; // opposite direction
    const x2   = CX + length * Math.cos(rad);
    const y2   = CY + length * Math.sin(rad);
    el.setAttribute('x2', x2);
    el.setAttribute('y2', y2);
  }

  function tick() {
    const now    = new Date();
    const h      = now.getHours() % 12;
    const m      = now.getMinutes();
    const s      = now.getSeconds();
    const ms     = now.getMilliseconds();

    // Smooth sweep angles
    const secAngle = (s + ms/1000) * 6;           // 360/60 = 6 deg/sec
    const minAngle = (m + s/60)    * 6;           // 6 deg/min
    const hrAngle  = (h + m/60)    * 30;          // 30 deg/hr

    rotateHand(hourHand,   hrAngle,  58);
    rotateHand(minuteHand, minAngle, 78);
    rotateHand(secondHand, secAngle, 84);
    rotateTail(secondTail, secAngle, 24);

    // Digital + date
    digital.textContent = pad2(now.getHours()) + ':' + pad2(m) + ':' + pad2(s);
    dateEl.textContent  = now.toLocaleDateString('en-IN',{ weekday:'long', day:'numeric', month:'long', year:'numeric' });

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
