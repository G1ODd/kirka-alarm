(() => {
  if (window.__alarmHUDSetup) return;
  window.__alarmHUDSetup = true;

  // === CONFIG (set to true/false) ===
  const SHOW_INFO_BY_DEFAULT = true;  // Whether bottom help text is visible on init

  let initialized = false;

  function initAlarmHUD() {
    if (initialized) return;
    initialized = true;

    const info = document.createElement('div');
    info.textContent = 'Delete = init | U = start/stop | L = restart | I = reset | Arrows = set time | Ins = hide/show | Home = lock | PgUp = toggle help';
    Object.assign(info.style, {
      position: 'fixed',
      left: '10px',
      bottom: '10px',
      fontSize: '14px',
      color: '#fff',
      opacity: '0.8',
      zIndex: 999999,
      pointerEvents: 'none',
      fontFamily: 'sans-serif',
    });
    info.style.display = SHOW_INFO_BY_DEFAULT ? 'block' : 'none';
    document.body.appendChild(info);

    const hud = document.createElement('div');
    hud.id = 'alarm-hud';
    Object.assign(hud.style, {
      position: 'fixed',
      top: '10px',
      left: '10px',
      padding: '8px 12px',
      background: 'rgba(0, 0, 0, 0.75)',
      color: '#0f0',
      fontFamily: 'monospace',
      fontSize: '20px',
      borderRadius: '4px',
      zIndex: 999999,
      userSelect: 'none',
      cursor: 'move',
    });

    const display = document.createElement('span');
    display.textContent = '00:00';
    hud.appendChild(display);

    const alarmPanel = document.createElement('div');
    alarmPanel.id = 'alarm-panel';
    alarmPanel.innerHTML = `
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.2);font-size:12px;">
        <div style="color:#888;margin-bottom:4px;">↑↓ change value | ←→ switch field</div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="color:#0af;">Alarm:</span>
          <span id="alarm-min">00</span>:<span id="alarm-sec">00</span>
          <span id="alarm-status" style="margin-left:6px;font-size:11px;">—</span>
        </div>
      </div>
    `;
    alarmPanel.style.display = 'block';
    hud.appendChild(alarmPanel);
    document.body.appendChild(hud);

    let targetMinutes = 0;
    let targetSeconds = 0;
    let remainingSec = 0;
    let running = false;
    let activeField = 'min';
    let intervalId = null;
    let hudHidden = false;
    let hudLocked = false;
    let infoVisible = SHOW_INFO_BY_DEFAULT;
    let dragStartX = 0;
    let dragStartY = 0;
    let hudStartX = 0;
    let hudStartY = 0;

    const minEl = () => alarmPanel.querySelector('#alarm-min');
    const secEl = () => alarmPanel.querySelector('#alarm-sec');
    const statusEl = () => alarmPanel.querySelector('#alarm-status');

    function pad(n) {
      return String(n).padStart(2, '0');
    }

    function formatTime(seconds) {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return pad(m) + ':' + pad(s);
    }

    function updateDisplay() {
      display.textContent = formatTime(remainingSec);
      hud.style.color = remainingSec <= 10 ? '#f00' : '#0f0';
    }

    function updatePanel() {
      const m = minEl();
      const s = secEl();
      const st = statusEl();
      if (m) m.textContent = pad(targetMinutes);
      if (s) s.textContent = pad(targetSeconds);
      if (st) {
        st.textContent = running ? 'ON' : '—';
        st.style.color = running ? '#0f0' : '#888';
      }
      if (m) m.style.background = activeField === 'min' ? 'rgba(0,170,255,0.3)' : 'transparent';
      if (s) s.style.background = activeField === 'sec' ? 'rgba(0,170,255,0.3)' : 'transparent';
    }

    function updateLockCursor() {
      hud.style.cursor = hudLocked ? 'default' : 'move';
      hud.style.pointerEvents = hudLocked ? 'none' : 'auto';
    }

    function beep() {
      hud.style.color = '#ff0';
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.stop(ctx.currentTime + 0.5);
      } catch (_) {}
      setTimeout(() => {
        hud.style.color = remainingSec <= 10 ? '#f00' : '#0f0';
      }, 500);
    }

    function start() {
      if (running) return;
      const target = targetMinutes * 60 + targetSeconds;
      if (target <= 0) return;
      if (remainingSec <= 0 || remainingSec > target) remainingSec = target;
      running = true;
      updateDisplay();
      updatePanel();
      intervalId = setInterval(() => {
        remainingSec = Math.max(0, remainingSec - 1);
        updateDisplay();
        updatePanel();
        if (remainingSec <= 0) {
          stop();
          beep();
        }
      }, 1000);
    }

    function stop() {
      if (!running) return;
      clearInterval(intervalId);
      intervalId = null;
      running = false;
      updatePanel();
    }

    function reset() {
      stop();
      remainingSec = targetMinutes * 60 + targetSeconds;
      if (remainingSec < 0) remainingSec = 0;
      updateDisplay();
      updatePanel();
    }

    function restart() {
      stop();
      remainingSec = 0;
      start();
    }

    function toggleHUD() {
      hudHidden = !hudHidden;
      hud.style.display = hudHidden ? 'none' : 'block';
      info.style.display = hudHidden ? 'none' : (infoVisible ? 'block' : 'none');
    }

    function toggleInfo() {
      infoVisible = !infoVisible;
      if (!hudHidden) info.style.display = infoVisible ? 'block' : 'none';
    }

    function toggleLock() {
      hudLocked = !hudLocked;
      updateLockCursor();
    }

    hud.addEventListener('mousedown', (e) => {
      if (hudLocked || hudHidden) return;
      if (e.target !== hud && !hud.contains(e.target)) return;
      e.preventDefault();
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const rect = hud.getBoundingClientRect();
      hudStartX = rect.left;
      hudStartY = rect.top;

      function onMouseMove(e) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        hud.style.left = (hudStartX + dx) + 'px';
        hud.style.top = (hudStartY + dy) + 'px';
        hud.style.right = 'auto';
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    updateLockCursor();

    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Insert') {
        e.preventDefault();
        toggleHUD();
        return;
      }

      if (e.code === 'Home') {
        e.preventDefault();
        toggleLock();
        return;
      }

      if (e.code === 'PageUp') {
        e.preventDefault();
        toggleInfo();
        return;
      }

      if (hudHidden) return;

      if (e.code === 'KeyU') {
        e.preventDefault();
        running ? stop() : start();
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        restart();
      } else if (e.code === 'KeyI') {
        e.preventDefault();
        reset();
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        if (activeField === 'min') targetMinutes = Math.min(99, targetMinutes + 1);
        else targetSeconds = Math.min(59, targetSeconds + 1);
        updatePanel();
        if (!running) {
          remainingSec = targetMinutes * 60 + targetSeconds;
          updateDisplay();
        }
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        if (activeField === 'min') targetMinutes = Math.max(0, targetMinutes - 1);
        else targetSeconds = Math.max(0, targetSeconds - 1);
        updatePanel();
        if (!running) {
          remainingSec = targetMinutes * 60 + targetSeconds;
          updateDisplay();
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        activeField = 'min';
        updatePanel();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        activeField = 'sec';
        updatePanel();
      }
    });

    remainingSec = targetMinutes * 60 + targetSeconds;
    updateDisplay();
    updatePanel();
  }

  window.addEventListener('keydown', (e) => {
    if (initialized) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.code === 'Delete') {
      e.preventDefault();
      initAlarmHUD();
    }
  });
})();