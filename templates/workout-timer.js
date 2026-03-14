'use strict';

const base = require('./base');

/**
 * Workout Timer template.
 * A polished, fitness-app-quality workout page with rounds, rest timer,
 * checklists for warmup/cooldown, and completion tracking.
 *
 * @param {object} data
 * @param {string} data.title - Workout title
 * @param {string} [data.subtitle] - Subtitle (e.g. day/program)
 * @param {Array} [data.warmup] - [{text}] warmup items
 * @param {Array} data.exercises - [{name, reps, notes}]
 * @param {number} [data.rounds=3] - Number of rounds
 * @param {number} [data.restSeconds=60] - Rest duration between rounds
 * @param {Array} [data.cooldown] - [{text}] cooldown items
 * @param {number} [data.estimatedMinutes] - Estimated duration
 * @param {number} [data.estimatedCalories] - Estimated calories
 * @param {string} [data._pageId] - Injected by template engine
 * @param {object} [data._og] - OG metadata
 * @returns {string} Full HTML page
 */
function workoutTimer(data) {
  const {
    title = 'Workout',
    subtitle = '',
    warmup = [],
    exercises = [],
    rounds = 3,
    restSeconds = 60,
    cooldown = [],
    estimatedMinutes = 0,
    estimatedCalories = 0,
    _pageId = '',
    _og = {},
  } = data;

  const totalExercises = exercises.length * rounds + warmup.length + cooldown.length;
  const accentColor = '#00ff88';
  const accentDim = '#00cc6a';

  // ── Build the HTML body ──

  const body = `
<style>
  .wt-header { margin-bottom: 20px; }
  .wt-header h1 {
    font-size: 1.6rem; font-weight: 800; color: #e0e0e0; margin: 0; line-height: 1.3;
  }
  .wt-header .wt-sub {
    color: #888; font-size: 0.9rem; margin-top: 4px;
  }
  .wt-stats {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
    margin-bottom: 24px;
  }
  .wt-stat {
    background: #1a1a1a; border: 1px solid #333; border-radius: 8px;
    padding: 12px 8px; text-align: center;
  }
  .wt-stat-icon { font-size: 1.2rem; margin-bottom: 2px; }
  .wt-stat-val { font-size: 1.3rem; font-weight: 700; color: #e0e0e0; font-variant-numeric: tabular-nums; }
  .wt-stat-label { font-size: 0.7rem; color: #888; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }

  .wt-section { margin-bottom: 24px; }
  .wt-section-title {
    font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;
    color: #888; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;
  }
  .wt-section-title::after {
    content: ''; flex: 1; height: 1px; background: #333;
  }

  /* Checklist items */
  .wt-check-item {
    display: flex; align-items: center; padding: 12px 14px; margin-bottom: 6px;
    background: #1a1a1a; border: 1px solid #333; border-radius: 8px;
    cursor: pointer; transition: all 0.2s; user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .wt-check-item:active { transform: scale(0.98); }
  .wt-check-item.checked { opacity: 0.5; }
  .wt-check-item.checked .wt-check-text { text-decoration: line-through; }
  .wt-check-circle {
    width: 22px; height: 22px; border-radius: 50%; border: 2px solid #444;
    display: flex; align-items: center; justify-content: center;
    margin-right: 12px; flex-shrink: 0; transition: all 0.2s;
    font-size: 13px; color: transparent;
  }
  .wt-check-item.checked .wt-check-circle {
    border-color: ${accentColor}; color: ${accentColor};
  }
  .wt-check-text { color: #e0e0e0; font-size: 0.95rem; transition: all 0.2s; }

  /* Round counter */
  .wt-round-bar {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    margin-bottom: 16px; padding: 14px; background: #1a1a1a;
    border: 1px solid #333; border-radius: 8px;
  }
  .wt-round-dot {
    width: 32px; height: 32px; border-radius: 50%; border: 2px solid #444;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.85rem; font-weight: 700; color: #888;
    transition: all 0.3s;
  }
  .wt-round-dot.active {
    border-color: ${accentColor}; color: #111; background: ${accentColor};
    box-shadow: 0 0 12px ${accentColor}40;
  }
  .wt-round-dot.done {
    border-color: ${accentDim}; color: ${accentDim}; background: transparent;
  }
  .wt-round-label {
    font-size: 0.85rem; color: #888; margin-left: 8px; font-weight: 600;
  }

  /* Exercise cards */
  .wt-exercise {
    background: #1a1a1a; border: 1px solid #333; border-radius: 8px;
    border-left: 3px solid ${accentColor}; padding: 16px 16px 16px 18px;
    margin-bottom: 8px; transition: all 0.3s;
  }
  .wt-exercise-name {
    font-size: 1.05rem; font-weight: 700; color: #e0e0e0; margin-bottom: 4px;
  }
  .wt-exercise-reps {
    font-size: 0.95rem; color: ${accentColor}; font-weight: 600; margin-bottom: 4px;
  }
  .wt-exercise-notes {
    font-size: 0.85rem; color: #888; font-style: italic;
  }

  /* Rest timer */
  .wt-rest-panel {
    background: #1a1a1a; border: 1px solid #333; border-radius: 12px;
    padding: 24px; text-align: center; margin-bottom: 16px;
    display: none;
  }
  .wt-rest-panel.visible { display: block; animation: wtFadeIn 0.3s ease; }
  .wt-rest-display {
    font-size: 3.5rem; font-weight: 800; font-variant-numeric: tabular-nums;
    color: #e0e0e0; margin: 12px 0;
  }
  .wt-rest-label { font-size: 0.85rem; color: #888; text-transform: uppercase; letter-spacing: 1px; }
  .wt-rest-progress {
    height: 4px; background: #333; border-radius: 2px; margin: 16px 0;
    overflow: hidden;
  }
  .wt-rest-bar {
    height: 100%; background: ${accentColor}; width: 0%; transition: width 1s linear;
  }

  /* Buttons */
  .wt-btn {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 14px 24px; border-radius: 8px; font-size: 1rem;
    font-weight: 600; cursor: pointer; border: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.15s; width: 100%; max-width: 320px;
    -webkit-tap-highlight-color: transparent;
  }
  .wt-btn:active { transform: scale(0.97); }
  .wt-btn-primary { background: ${accentColor}; color: #111; }
  .wt-btn-secondary { background: transparent; color: #e0e0e0; border: 2px solid #444; }
  .wt-btn-danger { background: #ff4444; color: #fff; }
  .wt-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

  .wt-btn-row { display: flex; gap: 10px; justify-content: center; margin-top: 12px; flex-wrap: wrap; }

  /* Complete section */
  .wt-complete-section {
    text-align: center; margin-top: 32px; padding-top: 24px;
    border-top: 1px solid #333;
  }

  /* Elapsed timer */
  .wt-elapsed {
    text-align: center; font-size: 0.85rem; color: #888;
    margin-bottom: 20px; font-variant-numeric: tabular-nums;
  }
  .wt-elapsed-time { color: #e0e0e0; font-weight: 600; font-size: 1rem; }

  /* Animations */
  @keyframes wtFadeIn {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes wtPulse {
    0%, 100% { box-shadow: 0 0 0 0 ${accentColor}40; }
    50% { box-shadow: 0 0 0 8px ${accentColor}00; }
  }

  /* Mobile tweaks */
  @media (max-width: 380px) {
    .wt-stats { grid-template-columns: repeat(2, 1fr); }
    .wt-rest-display { font-size: 2.8rem; }
  }
</style>

<!-- Header -->
<div class="wt-header">
  <h1>🏋️ ${esc(title)}</h1>
  ${subtitle ? `<p class="wt-sub">${esc(subtitle)}</p>` : ''}
</div>

<!-- Stats Bar -->
<div class="wt-stats">
  <div class="wt-stat">
    <div class="wt-stat-icon">⏱️</div>
    <div class="wt-stat-val">${estimatedMinutes || '—'}</div>
    <div class="wt-stat-label">Minutes</div>
  </div>
  <div class="wt-stat">
    <div class="wt-stat-icon">💪</div>
    <div class="wt-stat-val">${exercises.length}</div>
    <div class="wt-stat-label">Exercises</div>
  </div>
  <div class="wt-stat">
    <div class="wt-stat-icon">🔥</div>
    <div class="wt-stat-val">${estimatedCalories || '—'}</div>
    <div class="wt-stat-label">Calories</div>
  </div>
  <div class="wt-stat">
    <div class="wt-stat-icon">🔄</div>
    <div class="wt-stat-val">${rounds}</div>
    <div class="wt-stat-label">Rounds</div>
  </div>
</div>

<!-- Elapsed Timer -->
<div class="wt-elapsed">
  Elapsed: <span class="wt-elapsed-time" id="wt_elapsed">00:00</span>
</div>

<!-- Warm-up Section -->
${warmup.length > 0 ? `
<div class="wt-section" id="wt_warmup">
  <div class="wt-section-title">🔥 Warm-up</div>
  ${warmup.map((w, i) => `
  <div class="wt-check-item" data-group="warmup" data-idx="${i}" onclick="wtToggleCheck(this)">
    <div class="wt-check-circle">✓</div>
    <span class="wt-check-text">${esc(w.text)}</span>
  </div>`).join('')}
</div>` : ''}

<!-- Round Counter -->
<div class="wt-section">
  <div class="wt-section-title">🏋️ Workout</div>
  <div class="wt-round-bar" id="wt_round_bar">
    ${Array.from({ length: rounds }, (_, i) => `
    <div class="wt-round-dot ${i === 0 ? 'active' : ''}" data-round="${i}" id="wt_rdot_${i}">${i + 1}</div>`).join('')}
    <span class="wt-round-label" id="wt_round_label">Round 1 / ${rounds}</span>
  </div>

  <!-- Exercise Cards -->
  <div id="wt_exercises">
    ${exercises.map((ex, i) => `
    <div class="wt-exercise" data-ex="${i}">
      <div class="wt-exercise-name">${esc(ex.name)}</div>
      <div class="wt-exercise-reps">${esc(ex.reps)}</div>
      ${ex.notes ? `<div class="wt-exercise-notes">${esc(ex.notes)}</div>` : ''}
    </div>`).join('')}
  </div>

  <!-- Round Controls -->
  <div class="wt-btn-row" id="wt_round_controls">
    <button class="wt-btn wt-btn-primary" id="wt_next_round" onclick="wtNextRound()">
      Complete Round → Start Rest
    </button>
  </div>
</div>

<!-- Rest Timer -->
<div class="wt-rest-panel" id="wt_rest_panel">
  <div class="wt-rest-label">Rest Period</div>
  <div class="wt-rest-display" id="wt_rest_display">${fmtTime(restSeconds)}</div>
  <div class="wt-rest-progress">
    <div class="wt-rest-bar" id="wt_rest_bar"></div>
  </div>
  <div class="wt-btn-row">
    <button class="wt-btn wt-btn-secondary" id="wt_skip_rest" onclick="wtSkipRest()">Skip Rest</button>
  </div>
</div>

<!-- Cool-down Section -->
${cooldown.length > 0 ? `
<div class="wt-section" id="wt_cooldown" style="display:none">
  <div class="wt-section-title">🧘 Cool-down</div>
  ${cooldown.map((c, i) => `
  <div class="wt-check-item" data-group="cooldown" data-idx="${i}" onclick="wtToggleCheck(this)">
    <div class="wt-check-circle">✓</div>
    <span class="wt-check-text">${esc(c.text)}</span>
  </div>`).join('')}
</div>` : ''}

<!-- Complete Button -->
<div class="wt-complete-section" id="wt_complete_section" style="display:none">
  <button class="wt-btn wt-btn-primary" id="wt_complete_btn" onclick="wtComplete()" style="animation: wtPulse 2s infinite">
    ✅ Complete Workout
  </button>
</div>

<script>
(function() {
  // ── State ──
  var currentRound = 0;
  var totalRounds = ${rounds};
  var restDuration = ${restSeconds};
  var restTimer = null;
  var restRemaining = 0;
  var elapsedTimer = null;
  var elapsedSeconds = 0;
  var startTime = null;
  var exerciseCount = ${exercises.length};
  var warmupCount = ${warmup.length};
  var cooldownCount = ${cooldown.length};
  var totalExercises = ${totalExercises};
  var checkedItems = { warmup: {}, cooldown: {} };
  var workoutTitle = ${JSON.stringify(title)};

  // ── Elapsed timer ──
  function startElapsed() {
    if (elapsedTimer) return;
    startTime = Date.now();
    var el = document.getElementById('wt_elapsed');
    elapsedTimer = setInterval(function() {
      elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      el.textContent = fmtT(elapsedSeconds);
    }, 1000);
  }

  function fmtT(s) {
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    if (h > 0) return h + ':' + (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
    return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  // ── Checklist toggle ──
  window.wtToggleCheck = function(el) {
    startElapsed();
    el.classList.toggle('checked');
  };

  // ── Round management ──
  function updateRoundDots() {
    for (var i = 0; i < totalRounds; i++) {
      var dot = document.getElementById('wt_rdot_' + i);
      dot.className = 'wt-round-dot';
      if (i < currentRound) dot.classList.add('done');
      else if (i === currentRound) dot.classList.add('active');
    }
    var label = document.getElementById('wt_round_label');
    if (currentRound < totalRounds) {
      label.textContent = 'Round ' + (currentRound + 1) + ' / ' + totalRounds;
    } else {
      label.textContent = 'All rounds complete!';
    }
  }

  window.wtNextRound = function() {
    startElapsed();
    currentRound++;
    updateRoundDots();

    if (currentRound >= totalRounds) {
      // All rounds done — show cooldown or complete
      document.getElementById('wt_round_controls').style.display = 'none';
      document.getElementById('wt_rest_panel').className = 'wt-rest-panel';
      var cd = document.getElementById('wt_cooldown');
      if (cd) {
        cd.style.display = 'block';
        cd.style.animation = 'wtFadeIn 0.3s ease';
      }
      document.getElementById('wt_complete_section').style.display = 'block';
      document.getElementById('wt_complete_section').style.animation = 'wtFadeIn 0.3s ease';
      return;
    }

    // Show rest timer
    startRest();
  };

  // ── Rest timer ──
  function startRest() {
    var panel = document.getElementById('wt_rest_panel');
    var display = document.getElementById('wt_rest_display');
    var bar = document.getElementById('wt_rest_bar');

    panel.className = 'wt-rest-panel visible';
    restRemaining = restDuration;
    bar.style.transition = 'none';
    bar.style.width = '0%';

    // Scroll to rest panel
    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });

    clearInterval(restTimer);
    restTimer = setInterval(function() {
      restRemaining--;
      display.textContent = fmtRestTime(restRemaining);
      bar.style.transition = 'width 1s linear';
      bar.style.width = (((restDuration - restRemaining) / restDuration) * 100) + '%';

      if (restRemaining <= 0) {
        clearInterval(restTimer);
        restTimer = null;
        endRest();
      }
    }, 1000);
  }

  function fmtRestTime(s) {
    if (s < 0) s = 0;
    var m = Math.floor(s / 60);
    var sec = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function endRest() {
    var panel = document.getElementById('wt_rest_panel');
    panel.className = 'wt-rest-panel';

    // Update button text for next round
    var btn = document.getElementById('wt_next_round');
    if (currentRound >= totalRounds - 1) {
      btn.textContent = 'Complete Final Round';
    } else {
      btn.textContent = 'Complete Round → Start Rest';
    }

    // Scroll exercises back into view
    document.getElementById('wt_exercises').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  window.wtSkipRest = function() {
    clearInterval(restTimer);
    restTimer = null;
    endRest();
  };

  // ── Completion ──
  window.wtComplete = function() {
    if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null; }

    var warmupChecked = document.querySelectorAll('[data-group="warmup"].checked').length;
    var cooldownChecked = document.querySelectorAll('[data-group="cooldown"].checked').length;
    var exercisesChecked = (currentRound * exerciseCount) + warmupChecked + cooldownChecked;

    var payload = {
      action: 'workout_complete',
      title: workoutTitle,
      roundsCompleted: currentRound,
      exercisesChecked: exercisesChecked,
      totalExercises: totalExercises,
      duration: elapsedSeconds,
      completedAt: new Date().toISOString()
    };

    // Visual feedback
    var btn = document.getElementById('wt_complete_btn');
    btn.textContent = '🎉 Workout Complete!';
    btn.disabled = true;
    btn.style.animation = 'none';
    btn.style.background = '#444';
    btn.style.color = '#e0e0e0';

    if (window.sparkui) {
      window.sparkui.send('completion', payload);
    }
  };

  // ── Init ──
  updateRoundDots();
  var nextBtn = document.getElementById('wt_next_round');
  if (totalRounds <= 1) {
    nextBtn.textContent = 'Complete Final Round';
  }
})();
</script>`;

  return base({
    title: title,
    body: body,
    id: _pageId,
    og: {
      title: _og.title || title,
      description: _og.description || 'Workout powered by SparkUI',
      image: _og.image || '',
      url: _og.url || '',
    },
  });
}

// ── Utility ──
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtTime(s) {
  var m = Math.floor(s / 60);
  var sec = s % 60;
  return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
}

module.exports = workoutTimer;
