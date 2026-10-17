// =========================================================
// WakeUp Pro — Challenge Alarm Clock Engine
// =========================================================

// --- State Management ---
const STORAGE_KEY = 'wakeup_pro_alarms';
const STATS_KEY = 'wakeup_pro_stats';

let alarms = [];
let stats = {
  streak: 5,
  missionsSolved: 24,
  lastCompletedDate: null
};

let activeRingingAlarm = null;
let currentMission = null;
let currentRound = 1;
let totalRounds = 3;
let currentMathAnswer = null;
let shakeScore = 0;
let memorySequence = [];
let userMemoryIndex = 0;
let isPlayingSequence = false;
let wakeupCheckTimer = null;
let wakeupCheckInterval = null;

// Audio Synthesizer
let audioCtx = null;
let activeGainNode = null;
let activeOscillators = [];
let isRinging = false;
let previewTimeout = null;

// --- Initialize App ---
document.addEventListener('DOMContentLoaded', () => {
  loadStoredData();
  renderAlarms();
  updateStatsDisplay();
  startClockLoop();
  bindEventListeners();
});

// --- Storage Handlers ---
function loadStoredData() {
  const savedAlarms = localStorage.getItem(STORAGE_KEY);
  if (savedAlarms) {
    try {
      alarms = JSON.parse(savedAlarms);
    } catch (e) {
      alarms = [];
    }
  }

  if (!alarms || alarms.length === 0) {
    // Default initial alarms
    alarms = [
      {
        id: 'alarm_1',
        time: '06:30',
        label: 'Rise & Conquer',
        days: [1, 2, 3, 4, 5],
        mission: 'math',
        difficulty: 'medium',
        sound: 'siren',
        wakeupCheck: true,
        volumeCreep: true,
        noSnooze: false,
        enabled: true
      },
      {
        id: 'alarm_2',
        time: '08:00',
        label: 'Gym & Cardio',
        days: [1, 3, 5],
        mission: 'shake',
        difficulty: 'medium',
        sound: 'radar',
        wakeupCheck: false,
        volumeCreep: false,
        noSnooze: true,
        enabled: true
      },
      {
        id: 'alarm_3',
        time: '09:00',
        label: 'Weekend Coffee & Study',
        days: [0, 6],
        mission: 'typing',
        difficulty: 'easy',
        sound: 'synth',
        wakeupCheck: true,
        volumeCreep: true,
        noSnooze: false,
        enabled: false
      }
    ];
    saveAlarms();
  }

  const savedStats = localStorage.getItem(STATS_KEY);
  if (savedStats) {
    try {
      stats = JSON.parse(savedStats);
    } catch (e) {}
  }
}

function saveAlarms() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
  updateNextAlarmBanner();
  renderAlarms();
}

function saveStats() {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  updateStatsDisplay();
}

function updateStatsDisplay() {
  document.getElementById('streakCount').textContent = `${stats.streak} Days`;
  document.getElementById('missionsSolved').textContent = `${stats.missionsSolved}`;
}

// --- Live Clock & Scheduler Loop ---
function startClockLoop() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();
  
  // Format Date
  const options = { weekday: 'long', month: 'long', day: 'numeric' };
  document.getElementById('liveDate').textContent = now.toLocaleDateString('en-US', options);

  // Format Time
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const formattedHours = String(hours).padStart(2, '0');

  document.getElementById('clockTime').textContent = `${formattedHours}:${minutes}:${seconds}`;
  document.getElementById('clockAmPm').textContent = ampm;

  // Check Alarms on second 00
  if (now.getSeconds() === 0) {
    checkAlarmsToTrigger(now);
  }
}

function checkAlarmsToTrigger(now) {
  if (isRinging) return; // Already ringing

  const currentDay = now.getDay();
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;

  for (const alarm of alarms) {
    if (alarm.enabled && alarm.time === currentTimeStr) {
      if (alarm.days.length === 0 || alarm.days.includes(currentDay)) {
        triggerAlarm(alarm);
        break;
      }
    }
  }
}

function updateNextAlarmBanner() {
  const activeAlarms = alarms.filter(a => a.enabled);
  if (activeAlarms.length === 0) {
    document.getElementById('nextAlarmText').textContent = 'No upcoming alarms scheduled';
    return;
  }

  const now = new Date();
  let nearestDiff = Infinity;
  let nearestAlarm = null;

  for (const alarm of activeAlarms) {
    const [h, m] = alarm.time.split(':').map(Number);
    
    // Check next 7 days
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const candidateDate = new Date(now);
      candidateDate.setDate(now.getDate() + dayOffset);
      candidateDate.setHours(h, m, 0, 0);

      const dayOfWeek = candidateDate.getDay();
      if (alarm.days.length === 0 || alarm.days.includes(dayOfWeek)) {
        if (candidateDate > now) {
          const diff = candidateDate - now;
          if (diff < nearestDiff) {
            nearestDiff = diff;
            nearestAlarm = { alarm, date: candidateDate };
          }
          break;
        }
      }
    }
  }

  if (nearestAlarm) {
    const totalMinutes = Math.round(nearestDiff / 60000);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    let timeFormatted = '';
    if (hrs > 0) timeFormatted += `${hrs}h `;
    timeFormatted += `${mins}m`;

    document.getElementById('nextAlarmText').textContent = 
      `Next alarm "${nearestAlarm.alarm.label}" in ${timeFormatted} (${formatTimeString(nearestAlarm.alarm.time)})`;
  } else {
    document.getElementById('nextAlarmText').textContent = 'All alarms disabled';
  }
}

// --- Render Alarms ---
function renderAlarms() {
  const container = document.getElementById('alarmsList');
  container.innerHTML = '';
  document.getElementById('alarmCountBadge').textContent = `${alarms.length} Alarms`;

  if (alarms.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
        <p style="font-size: 1.1rem; margin-bottom: 12px;">No challenge alarms set yet.</p>
        <button id="emptyCreateBtn" class="btn btn-primary btn-sm">+ Create Your First Alarm</button>
      </div>
    `;
    const emptyBtn = document.getElementById('emptyCreateBtn');
    if (emptyBtn) emptyBtn.addEventListener('click', openAlarmModal);
    return;
  }

  alarms.forEach(alarm => {
    const card = document.createElement('div');
    card.className = `alarm-card ${alarm.enabled ? '' : 'disabled'}`;

    const missionBadge = getMissionBadgeText(alarm.mission);
    const daysFormatted = formatDaysString(alarm.days);

    card.innerHTML = `
      <div class="alarm-card-left">
        <div class="alarm-time-row">
          <span class="time">${formatTimeString(alarm.time, true).time}</span>
          <span class="ampm">${formatTimeString(alarm.time, true).ampm}</span>
        </div>
        <div class="alarm-label-tag">${escapeHtml(alarm.label)}</div>
        <div class="alarm-meta-row">
          <span class="alarm-mission-tag">${missionBadge}</span>
          <span class="alarm-days-tag">${daysFormatted}</span>
        </div>
      </div>
      <div class="alarm-card-right">
        <button class="btn btn-secondary btn-sm test-alarm-btn" data-id="${alarm.id}">Test Ring</button>
        <label class="switch">
          <input type="checkbox" class="alarm-toggle" data-id="${alarm.id}" ${alarm.enabled ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
        <button class="btn-icon delete-alarm-btn" data-id="${alarm.id}" title="Delete alarm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
        </button>
      </div>
    `;

    container.appendChild(card);
  });

  // Attach card event listeners
  container.querySelectorAll('.alarm-toggle').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      const item = alarms.find(a => a.id === id);
      if (item) {
        item.enabled = e.target.checked;
        saveAlarms();
      }
    });
  });

  container.querySelectorAll('.delete-alarm-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      if (confirm('Delete this alarm?')) {
        alarms = alarms.filter(a => a.id !== id);
        saveAlarms();
      }
    });
  });

  container.querySelectorAll('.test-alarm-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const item = alarms.find(a => a.id === id);
      if (item) {
        triggerAlarm(item);
      }
    });
  });
}

// --- Web Audio Synthesizer ---
function initAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function startAlarmSound(soundType = 'siren', volumeCreep = true) {
  initAudioContext();
  stopAlarmSound();

  isRinging = true;
  activeGainNode = audioCtx.createGain();
  activeGainNode.connect(audioCtx.destination);

  if (volumeCreep) {
    // Gentle volume ramp: 0.15 to 0.9 over 25 seconds
    activeGainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    activeGainNode.gain.linearRampToValueAtTime(0.9, audioCtx.currentTime + 25);
  } else {
    activeGainNode.gain.setValueAtTime(0.85, audioCtx.currentTime);
  }

  playSynthPattern(soundType);
}

function playSynthPattern(soundType) {
  const now = audioCtx.currentTime;

  if (soundType === 'siren') {
    // Modulated emergency siren
    const osc = audioCtx.createOscillator();
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(700, now);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(1.8, now); // 1.8 Hz sweep

    lfoGain.gain.setValueAtTime(320, now);

    lfo.connect(osc.frequency);
    osc.connect(activeGainNode);

    osc.start();
    lfo.start();
    activeOscillators.push(osc, lfo);

  } else if (soundType === 'radar') {
    // Radar repeating ping pulse
    const interval = 0.8;
    for (let i = 0; i < 40; i++) {
      const osc = audioCtx.createOscillator();
      const pGain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now + i * interval);
      osc.frequency.exponentialRampToValueAtTime(440, now + i * interval + 0.35);

      pGain.gain.setValueAtTime(0.8, now + i * interval);
      pGain.gain.exponentialRampToValueAtTime(0.001, now + i * interval + 0.35);

      osc.connect(pGain);
      pGain.connect(activeGainNode);

      osc.start(now + i * interval);
      osc.stop(now + i * interval + 0.4);
      activeOscillators.push(osc);
    }

  } else if (soundType === 'synth') {
    // 80s High Energy Arpeggio
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C chord arpeggio
    const step = 0.16;
    for (let i = 0; i < 120; i++) {
      const osc = audioCtx.createOscillator();
      const pGain = audioCtx.createGain();

      osc.type = 'triangle';
      const freq = notes[i % notes.length];
      osc.frequency.setValueAtTime(freq, now + i * step);

      pGain.gain.setValueAtTime(0.6, now + i * step);
      pGain.gain.exponentialRampToValueAtTime(0.01, now + i * step + step * 0.9);

      osc.connect(pGain);
      pGain.connect(activeGainNode);

      osc.start(now + i * step);
      osc.stop(now + i * step + step);
      activeOscillators.push(osc);
    }

  } else if (soundType === 'beep') {
    // Relentless Double Beep
    const interval = 1.0;
    for (let i = 0; i < 50; i++) {
      [0, 0.2].forEach(offset => {
        const osc = audioCtx.createOscillator();
        const pGain = audioCtx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(960, now + i * interval + offset);

        pGain.gain.setValueAtTime(0.5, now + i * interval + offset);
        pGain.gain.setValueAtTime(0, now + i * interval + offset + 0.12);

        osc.connect(pGain);
        pGain.connect(activeGainNode);

        osc.start(now + i * interval + offset);
        osc.stop(now + i * interval + offset + 0.13);
        activeOscillators.push(osc);
      });
    }

  } else { // bell
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.connect(activeGainNode);
    osc.start();
    activeOscillators.push(osc);
  }
}

function stopAlarmSound() {
  isRinging = false;
  if (activeGainNode && audioCtx) {
    try {
      activeGainNode.gain.setValueAtTime(activeGainNode.gain.value, audioCtx.currentTime);
      activeGainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    } catch (e) {}
  }
  setTimeout(() => {
    activeOscillators.forEach(osc => {
      try { osc.stop(); osc.disconnect(); } catch (e) {}
    });
    activeOscillators = [];
  }, 250);
}

function previewSound(soundType) {
  initAudioContext();
  clearTimeout(previewTimeout);
  startAlarmSound(soundType, false);
  previewTimeout = setTimeout(() => {
    stopAlarmSound();
  }, 2600);
}

// --- Alarm Trigger & Ringing Modal ---
function triggerAlarm(alarm) {
  activeRingingAlarm = alarm;
  const overlay = document.getElementById('alarmRingingOverlay');
  const timeFormatted = formatTimeString(alarm.time, true);

  document.getElementById('ringingTime').textContent = `${timeFormatted.time} ${timeFormatted.ampm}`;
  document.getElementById('ringingLabel').textContent = alarm.label || 'Time to Wake Up!';

  const banner = document.getElementById('ringingMissionBanner');
  const startBtn = document.getElementById('startMissionBtn');
  const snoozeBtn = document.getElementById('snoozeBtn');

  if (alarm.mission && alarm.mission !== 'none') {
    banner.textContent = `🔒 Mission Locked: ${getMissionBadgeText(alarm.mission)} to turn off!`;
    banner.style.display = 'block';
    startBtn.textContent = 'Begin Mission to Silence';
  } else {
    banner.style.display = 'none';
    startBtn.textContent = 'Dismiss Alarm';
  }

  if (alarm.noSnooze) {
    snoozeBtn.style.display = 'none';
  } else {
    snoozeBtn.style.display = 'block';
  }

  overlay.classList.add('active');
  startAlarmSound(alarm.sound || 'siren', alarm.volumeCreep);
}

// --- Mission Engine ---
function launchMission() {
  const alarm = activeRingingAlarm;
  if (!alarm || alarm.mission === 'none') {
    // Simple dismiss
    completeAlarmDismissal();
    return;
  }

  currentMission = alarm.mission;
  currentRound = 1;

  if (alarm.difficulty === 'easy') totalRounds = 1;
  else if (alarm.difficulty === 'hard') totalRounds = 5;
  else totalRounds = 3;

  document.getElementById('alarmRingingOverlay').classList.remove('active');
  document.getElementById('missionOverlay').classList.add('active');

  setupMissionStage();
}

function setupMissionStage() {
  document.querySelectorAll('.challenge-stage').forEach(el => el.classList.add('hidden'));
  document.getElementById('roundCounter').textContent = `Round ${currentRound} / ${totalRounds}`;

  if (currentMission === 'math') {
    document.getElementById('missionTypeBadge').textContent = 'Math Mission';
    document.getElementById('missionTitle').textContent = 'Solve Arithmetic to Silence';
    document.getElementById('mathStage').classList.remove('hidden');
    generateMathProblem();

  } else if (currentMission === 'shake') {
    document.getElementById('missionTypeBadge').textContent = 'Shake Mission';
    document.getElementById('missionTitle').textContent = 'Vigorous Device Shake';
    document.getElementById('shakeStage').classList.remove('hidden');
    initShakeChallenge();

  } else if (currentMission === 'typing') {
    document.getElementById('missionTypeBadge').textContent = 'Typing Mission';
    document.getElementById('missionTitle').textContent = 'Type the Awake Quote';
    document.getElementById('typingStage').classList.remove('hidden');
    setupTypingQuote();

  } else if (currentMission === 'memory') {
    document.getElementById('missionTypeBadge').textContent = 'Memory Matrix';
    document.getElementById('missionTitle').textContent = 'Memorize the Illuminated Pattern';
    document.getElementById('memoryStage').classList.remove('hidden');
    setupMemoryGame();
  }
}

// Math Challenge
function generateMathProblem() {
  const input = document.getElementById('mathAnswerInput');
  input.value = '';
  input.focus();

  let a, b, c;
  let problemText = '';

  if (activeRingingAlarm.difficulty === 'easy') {
    a = Math.floor(Math.random() * 40) + 10;
    b = Math.floor(Math.random() * 40) + 10;
    currentMathAnswer = a + b;
    problemText = `${a} + ${b} = ?`;
  } else if (activeRingingAlarm.difficulty === 'hard') {
    a = Math.floor(Math.random() * 15) + 6;
    b = Math.floor(Math.random() * 14) + 5;
    c = Math.floor(Math.random() * 80) + 20;
    currentMathAnswer = (a * b) + c;
    problemText = `(${a} &times; ${b}) + ${c} = ?`;
  } else {
    // Medium
    a = Math.floor(Math.random() * 12) + 4;
    b = Math.floor(Math.random() * 12) + 3;
    c = Math.floor(Math.random() * 30) + 10;
    currentMathAnswer = (a * b) + c;
    problemText = `${a} &times; ${b} + ${c} = ?`;
  }

  document.getElementById('mathProblem').innerHTML = problemText;
}

function verifyMathAnswer() {
  const input = document.getElementById('mathAnswerInput');
  const val = parseInt(input.value.trim(), 10);

  if (val === currentMathAnswer) {
    if (currentRound < totalRounds) {
      currentRound++;
      setupMissionStage();
    } else {
      completeAlarmDismissal();
    }
  } else {
    input.classList.add('error');
    input.value = '';
    setTimeout(() => input.classList.remove('error'), 400);
    alert('Incorrect answer! Keep thinking...');
  }
}

// Shake Challenge
function initShakeChallenge() {
  shakeScore = 0;
  updateShakeUI();

  if (window.DeviceMotionEvent) {
    window.addEventListener('devicemotion', handleDeviceMotion);
  }
}

function handleDeviceMotion(e) {
  const acc = e.accelerationIncludingGravity;
  if (!acc) return;
  const delta = Math.abs(acc.x || 0) + Math.abs(acc.y || 0) + Math.abs(acc.z || 0);
  if (delta > 22) {
    triggerOneShake(4);
  }
}

function triggerOneShake(points = 6) {
  shakeScore = Math.min(100, shakeScore + points);
  updateShakeUI();

  const icon = document.getElementById('shakePhoneIcon');
  icon.style.transform = `rotate(${(Math.random() - 0.5) * 40}deg) scale(1.15)`;
  setTimeout(() => icon.style.transform = 'rotate(0deg) scale(1)', 100);

  if (shakeScore >= 100) {
    if (window.DeviceMotionEvent) {
      window.removeEventListener('devicemotion', handleDeviceMotion);
    }
    setTimeout(completeAlarmDismissal, 300);
  }
}

function updateShakeUI() {
  document.getElementById('shakeProgressBar').style.width = `${shakeScore}%`;
  document.getElementById('shakePercent').textContent = `${Math.round(shakeScore)}%`;
}

// Typing Challenge
const QUOTES = [
  "Discipline is choosing between what you want now and what you want most.",
  "Your future is created by what you do today not tomorrow.",
  "Wake up with determination and go to bed with satisfaction.",
  "The alarm clock was invented for those who have a mission to achieve."
];

function setupTypingQuote() {
  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  document.getElementById('quoteTargetText').textContent = `"${quote}"`;
  const textarea = document.getElementById('typingInput');
  textarea.value = '';
  textarea.focus();
  document.getElementById('charsLeft').textContent = quote.length;

  textarea.oninput = () => {
    const remaining = Math.max(0, quote.length - textarea.value.length);
    document.getElementById('charsLeft').textContent = remaining;
  };

  document.getElementById('submitTypingBtn').onclick = () => {
    if (textarea.value.trim() === quote) {
      completeAlarmDismissal();
    } else {
      alert('The typed quote does not match exactly! Check spelling and punctuation.');
    }
  };
}

// Memory Matrix Challenge
function setupMemoryGame() {
  userMemoryIndex = 0;
  memorySequence = [];
  const sequenceLength = activeRingingAlarm.difficulty === 'hard' ? 5 : 3;

  for (let i = 0; i < sequenceLength; i++) {
    memorySequence.push(Math.floor(Math.random() * 9));
  }

  playMemorySequence();
}

function playMemorySequence() {
  isPlayingSequence = true;
  document.getElementById('memoryInstruct').textContent = 'Watch the illuminated sequence...';
  const tiles = document.querySelectorAll('.mem-tile');

  let step = 0;
  const interval = setInterval(() => {
    if (step >= memorySequence.length) {
      clearInterval(interval);
      isPlayingSequence = false;
      document.getElementById('memoryInstruct').textContent = 'Your turn! Tap the tiles in order:';
      return;
    }

    const idx = memorySequence[step];
    tiles[idx].classList.add('lit');
    setTimeout(() => tiles[idx].classList.remove('lit'), 450);
    step++;
  }, 750);
}

function handleTileClick(idx) {
  if (isPlayingSequence) return;
  const tiles = document.querySelectorAll('.mem-tile');
  tiles[idx].classList.add('user-click');
  setTimeout(() => tiles[idx].classList.remove('user-click'), 200);

  if (idx === memorySequence[userMemoryIndex]) {
    userMemoryIndex++;
    if (userMemoryIndex === memorySequence.length) {
      setTimeout(completeAlarmDismissal, 300);
    }
  } else {
    alert('Wrong sequence! Try again from the beginning.');
    setupMemoryGame();
  }
}

// --- Dismissal & Pro Wake-Up Check ---
function completeAlarmDismissal() {
  stopAlarmSound();
  document.getElementById('alarmRingingOverlay').classList.remove('active');
  document.getElementById('missionOverlay').classList.remove('active');

  stats.missionsSolved++;
  saveStats();

  const alarm = activeRingingAlarm;
  activeRingingAlarm = null;

  if (alarm && alarm.wakeupCheck) {
    scheduleWakeupCheck();
  } else {
    alert('🎉 Mission Accomplished! Alarm silenced. Have an amazing, productive day!');
  }
}

function scheduleWakeupCheck() {
  clearTimeout(wakeupCheckTimer);
  // Schedule 5-minute wake-up check (for demonstration preview, set to 2 minutes or triggers check popup)
  wakeupCheckTimer = setTimeout(triggerWakeupCheckPrompt, 2 * 60 * 1000);
}

function triggerWakeupCheckPrompt() {
  const overlay = document.getElementById('wakeupCheckOverlay');
  overlay.classList.remove('hidden');

  let secondsLeft = 60;
  const countdownEl = document.getElementById('checkCountdown');
  countdownEl.textContent = `${secondsLeft}s remaining`;

  // Start subtle periodic warning beep
  previewSound('beep');

  clearInterval(wakeupCheckInterval);
  wakeupCheckInterval = setInterval(() => {
    secondsLeft--;
    countdownEl.textContent = `${secondsLeft}s remaining`;

    if (secondsLeft <= 0) {
      clearInterval(wakeupCheckInterval);
      overlay.classList.add('hidden');
      // User failed wake-up check! Sound alarm at full volume!
      triggerAlarm({
        time: 'WAKE-UP CHECK FAILED',
        label: '🚨 EMERGENCY WAKE-UP RETRY',
        mission: 'math',
        difficulty: 'hard',
        sound: 'siren',
        noSnooze: true,
        volumeCreep: false
      });
    }
  }, 1000);

  document.getElementById('confirmAwakeBtn').onclick = () => {
    clearInterval(wakeupCheckInterval);
    overlay.classList.add('hidden');
    alert('✅ Confirmed awake! Streak secured.');
  };
}

// Snooze
function snoozeCurrentAlarm() {
  stopAlarmSound();
  document.getElementById('alarmRingingOverlay').classList.remove('active');

  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  const snoozeHours = String(now.getHours()).padStart(2, '0');
  const snoozeMins = String(now.getMinutes()).padStart(2, '0');

  const snoozedAlarm = {
    ...activeRingingAlarm,
    time: `${snoozeHours}:${snoozeMins}`,
    label: `(Snoozed) ${activeRingingAlarm.label}`
  };

  alarms.push(snoozedAlarm);
  saveAlarms();
  activeRingingAlarm = null;
  alert(`Alarm snoozed for 5 minutes. Rings again at ${snoozeHours}:${snoozeMins}.`);
}

// --- Modal & Form Handlers ---
function openAlarmModal() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 2);
  const defHours = String(now.getHours()).padStart(2, '0');
  const defMins = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('alarmTime').value = `${defHours}:${defMins}`;

  document.getElementById('alarmModal').classList.add('active');
}

function closeAlarmModal() {
  document.getElementById('alarmModal').classList.remove('active');
}

// --- Bind Event Listeners ---
function bindEventListeners() {
  document.getElementById('openNewAlarmBtn').addEventListener('click', openAlarmModal);
  document.getElementById('closeModalBtn').addEventListener('click', closeAlarmModal);
  document.getElementById('cancelModalBtn').addEventListener('click', closeAlarmModal);

  // Sound Check in Header
  document.getElementById('testAudioBtn').addEventListener('click', () => {
    previewSound('radar');
  });

  // Sound Preview in Form
  document.getElementById('previewToneBtn').addEventListener('click', () => {
    const tone = document.getElementById('soundSelect').value;
    previewSound(tone);
  });

  // Days selector buttons in form
  document.querySelectorAll('#daysSelector .day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
    });
  });

  // Difficulty pills
  document.querySelectorAll('#difficultyPills .pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#difficultyPills .pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });

  // Save Alarm Form
  document.getElementById('alarmForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const time = document.getElementById('alarmTime').value;
    const label = document.getElementById('alarmLabel').value.trim() || 'Alarm';
    const mission = document.getElementById('missionSelect').value;
    const sound = document.getElementById('soundSelect').value;
    const wakeupCheck = document.getElementById('wakeupCheckToggle').checked;
    const volumeCreep = document.getElementById('volumeCreepToggle').checked;
    const noSnooze = document.getElementById('noSnoozeToggle').checked;

    const activeDays = [];
    document.querySelectorAll('#daysSelector .day-btn.active').forEach(b => {
      activeDays.push(parseInt(b.getAttribute('data-day'), 10));
    });

    const activePill = document.querySelector('#difficultyPills .pill.active');
    const difficulty = activePill ? activePill.getAttribute('data-level') : 'medium';

    const newAlarm = {
      id: 'alarm_' + Date.now(),
      time,
      label,
      days: activeDays,
      mission,
      difficulty,
      sound,
      wakeupCheck,
      volumeCreep,
      noSnooze,
      enabled: true
    };

    alarms.push(newAlarm);
    saveAlarms();
    closeAlarmModal();
  });

  // Ringing actions
  document.getElementById('startMissionBtn').addEventListener('click', launchMission);
  document.getElementById('snoozeBtn').addEventListener('click', snoozeCurrentAlarm);

  // Math submission
  document.getElementById('submitMathBtn').addEventListener('click', verifyMathAnswer);
  document.getElementById('mathAnswerInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') verifyMathAnswer();
  });

  // Virtual Keypad
  document.querySelectorAll('#virtualKeypad .key-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-key');
      const input = document.getElementById('mathAnswerInput');
      if (key === 'clear') {
        input.value = '';
      } else if (key === 'enter') {
        verifyMathAnswer();
      } else {
        input.value += key;
      }
    });
  });

  // Shake Turbo Button
  document.getElementById('manualShakeBtn').addEventListener('click', () => {
    triggerOneShake(7);
  });

  // Memory Matrix Tiles
  document.querySelectorAll('.mem-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const idx = parseInt(tile.getAttribute('data-idx'), 10);
      handleTileClick(idx);
    });
  });
}

// --- Helper Formatters ---
function formatTimeString(timeStr, returnSplit = false) {
  if (!timeStr || !timeStr.includes(':')) return returnSplit ? { time: timeStr, ampm: '' } : timeStr;
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hours12 = h % 12 || 12;
  const formattedTime = `${String(hours12).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  
  if (returnSplit) {
    return { time: formattedTime, ampm };
  }
  return `${formattedTime} ${ampm}`;
}

function formatDaysString(daysArray) {
  if (!daysArray || daysArray.length === 0) return 'Once';
  if (daysArray.length === 7) return 'Everyday';
  if (daysArray.length === 5 && !daysArray.includes(0) && !daysArray.includes(6)) return 'Weekdays';
  if (daysArray.length === 2 && daysArray.includes(0) && daysArray.includes(6)) return 'Weekends';

  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return daysArray.map(d => names[d]).join(', ');
}

function getMissionBadgeText(missionKey) {
  switch (missionKey) {
    case 'math': return '🧮 Math Challenge';
    case 'shake': return '📱 Shake Challenge';
    case 'typing': return '⌨️ Typing Challenge';
    case 'memory': return '🧠 Memory Matrix';
    default: return '🔔 Standard';
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[s]);
}
