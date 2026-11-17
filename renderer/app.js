/* ============================================================
   Performance Widgets — Application renderer
   Temps réel, thème, alerte sonore de surcharge
   ============================================================ */

const API = window.electronAPI;

/* ---------- État ---------- */
const state = {
  theme: localStorage.getItem('pw-theme') || 'dark',
  accent: localStorage.getItem('pw-accent') || '#4f46e5',
  soundEnabled: localStorage.getItem('pw-sound') === 'true',
  cpuThreshold: Number(localStorage.getItem('pw-cpu-threshold') || 90),
  memThreshold: Number(localStorage.getItem('pw-mem-threshold') || 90),
  refresh: Number(localStorage.getItem('pw-refresh') || 2000),
  overload: false,
  overloadStreak: 0,
  lastSound: 0,
  audioCtx: null,
};

/* ---------- Éléments DOM ---------- */
const els = {
  themeSelect: document.getElementById('themeSelect'),
  accentColor: document.getElementById('accentColor'),
  soundToggle: document.getElementById('soundToggle'),
  soundStatus: document.getElementById('soundStatus'),
  cpuThreshold: document.getElementById('cpuThreshold'),
  cpuThresholdVal: document.getElementById('cpuThresholdVal'),
  memThreshold: document.getElementById('memThreshold'),
  memThresholdVal: document.getElementById('memThresholdVal'),
  refreshSelect: document.getElementById('refreshSelect'),
  settingsBtn: document.getElementById('settingsBtn'),
  closeSettings: document.getElementById('closeSettings'),
  settingsPanel: document.getElementById('settingsPanel'),
  settingsCard: document.querySelector('.settings-card'),
  resetSettings: document.getElementById('resetSettings'),

  overloadBanner: document.getElementById('overloadBanner'),
  overloadDetail: document.getElementById('overloadDetail'),

  valCpu: document.getElementById('valCpu'),
  valMem: document.getElementById('valMem'),
  valDisk: document.getElementById('valDisk'),
  valNet: document.getElementById('valNet'),
  valBattery: document.getElementById('valBattery'),
  valGpu: document.getElementById('valGpu'),
  valOs: document.getElementById('valOs'),
  chipCpu: document.getElementById('chipCpu'),
  chipMem: document.getElementById('chipMem'),
  chipTemp: document.getElementById('chipTemp'),
  chipUp: document.getElementById('chipUp'),
  chipSound: document.getElementById('chipSound'),
  soundChip: document.getElementById('soundChip'),
  clock: document.getElementById('clock'),
  lastUpdate: document.getElementById('lastUpdate'),

  gaugeCpu: document.getElementById('gaugeCpu'),
  gaugeMem: document.getElementById('gaugeMem'),
  gaugeDisk: document.getElementById('gaugeDisk'),
  gaugeNet: document.getElementById('gaugeNet'),
  gaugeBattery: document.getElementById('gaugeBattery'),

  widgetBattery: document.getElementById('widgetBattery'),
  widgetGpu: document.getElementById('widgetGpu'),

  detCpus: document.getElementById('detCpus'),
  detLoad1: document.getElementById('detLoad1'),
  detLoad5: document.getElementById('detLoad5'),
  detLoad15: document.getElementById('detLoad15'),
  detMemUsed: document.getElementById('detMemUsed'),
  detMemTotal: document.getElementById('detMemTotal'),
  detMemFree: document.getElementById('detMemFree'),
  detMemAvailable: document.getElementById('detMemAvailable'),
  detDiskUsed: document.getElementById('detDiskUsed'),
  detDiskTotal: document.getElementById('detDiskTotal'),
  detDiskFree: document.getElementById('detDiskFree'),
  detDiskMount: document.getElementById('detDiskMount'),
  detNetRx: document.getElementById('detNetRx'),
  detNetTx: document.getElementById('detNetTx'),
  detNetIface: document.getElementById('detNetIface'),
  detNetState: document.getElementById('detNetState'),
  detBatteryState: document.getElementById('detBatteryState'),
  detBatteryTime: document.getElementById('detBatteryTime'),
  detGpuModel: document.getElementById('detGpuModel'),
  detGpuVram: document.getElementById('detGpuVram'),
  detCpuTemp: document.getElementById('detCpuTemp'),
  detOs: document.getElementById('detOs'),
  detArch: document.getElementById('detArch'),
  detUser: document.getElementById('detUser'),
  detHostname: document.getElementById('detHostname'),
  detUptime: document.getElementById('detUptime'),
};

/* ---------- Helpers ---------- */
function formatBytes(bytes, decimals = 2) {
  if (!bytes && bytes !== 0) return '0 o';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
  if (!seconds && seconds !== 0) return '--';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d} j`);
  if (h > 0) parts.push(`${h} h`);
  if (m > 0 || parts.length === 0) parts.push(`${m} min`);
  return parts.join(' ');
}

function gb(bytes) {
  return (bytes / (1024 ** 3)).toFixed(2);
}

function setGauge(el, pct) {
  if (!el) return;
  el.style.setProperty('--pct', Math.max(0, Math.min(100, pct)));
}

/* ---------- Thème ---------- */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  document.documentElement.style.setProperty('--accent', state.accent);
  els.accentColor.value = state.accent;
  els.themeSelect.value = state.theme;
  localStorage.setItem('pw-theme', state.theme);
  localStorage.setItem('pw-accent', state.accent);

  // Respect du thème système
  if (state.theme === 'system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } else {
    document.documentElement.style.colorScheme = state.theme;
  }
}

function saveSetting(key, value) {
  localStorage.setItem(key, value);
}

/* ---------- Son d'alerte (Web Audio API, sans fichier externe) ---------- */
function ensureAudio() {
  if (!state.audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) state.audioCtx = new AC();
  }
  return !!state.audioCtx;
}

async function playAlert() {
  if (!state.soundEnabled) return;
  const now = Date.now();
  if (now - state.lastSound < 30000) return; // anti-spam : 30 s minimum
  state.lastSound = now;

  if (!ensureAudio()) return;
  if (state.audioCtx.state === 'suspended') {
    try {
      await state.audioCtx.resume();
    } catch (e) {
      console.warn('Impossible de démarrer l\'AudioContext', e);
      return;
    }
  }

  const t = state.audioCtx.currentTime;
  const osc = state.audioCtx.createOscillator();
  const gain = state.audioCtx.createGain();

  osc.type = 'square';
  // bip montant puis descendant (alarme)
  osc.frequency.setValueAtTime(580, t);
  osc.frequency.exponentialRampToValueAtTime(1100, t + 0.12);
  osc.frequency.setValueAtTime(580, t + 0.12);
  osc.frequency.exponentialRampToValueAtTime(1050, t + 0.28);

  gain.gain.setValueAtTime(0.14, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

  osc.connect(gain);
  gain.connect(state.audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.7);
}

/* ---------- Détection de surcharge ---------- */
function evaluateOverload(cpuLoad, memPct) {
  const overCpu = cpuLoad > state.cpuThreshold;
  const overMem = memPct > state.memThreshold;

  if (overCpu || overMem) {
    state.overloadStreak += 1;
  } else {
    state.overloadStreak = 0;
    if (state.overload) {
      state.overload = false;
      setOverloadUI(false);
    }
    return;
  }

  // Surcharge confirmée après 3 relevés consécutifs
  if (state.overloadStreak >= 3 && !state.overload) {
    state.overload = true;
    setOverloadUI(true);
    playAlert();
  }
}

function setOverloadUI(active) {
  const banner = els.overloadBanner;
  const html = document.documentElement;
  const widgets = document.querySelectorAll('.widget');

  if (active) {
    banner.classList.remove('hidden');
    html.classList.add('overloaded');
    widgets.forEach((w) => w.classList.add('widget-overloaded'));
  } else {
    banner.classList.add('hidden');
    html.classList.remove('overloaded');
    widgets.forEach((w) => w.classList.remove('widget-overloaded'));
  }
}

/* ---------- Mise à jour de l'affichage ---------- */
async function update() {
  let data;
  try {
    data = await API.systemInfo();
  } catch (err) {
    console.error('Erreur récupération métriques:', err);
    scheduleNext();
    return;
  }

  // Horloge
  const now = new Date();
  els.clock.textContent = now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  els.lastUpdate.textContent = now.toLocaleString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // CPU
  const cpuLoad = data.cpu.load || 0;
  els.valCpu.textContent = cpuLoad + '%';
  setGauge(els.gaugeCpu, cpuLoad);
  els.chipCpu.querySelector('span').textContent = cpuLoad + '%';
  if (els.detCpus) els.detCpus.textContent = (data.cpu.cpus && data.cpu.cpus.length) || '--';
  if (els.detLoad1) els.detLoad1.textContent = (data.cpu.loadavg && data.cpu.loadavg[0]) || '--';
  if (els.detLoad5) els.detLoad5.textContent = (data.cpu.loadavg && data.cpu.loadavg[1]) || '--';
  if (els.detLoad15) els.detLoad15.textContent = (data.cpu.loadavg && data.cpu.loadavg[2]) || '--';

  // Température CPU
  const temp = data.cpu.temp;
  if (els.chipTemp) {
    els.chipTemp.querySelector('span').textContent =
      temp != null ? temp + '°C' : '--°C';
  }
  if (els.detCpuTemp) {
    els.detCpuTemp.textContent = temp != null ? temp + ' °C' : '--';
  }

  // Mémoire
  const memPct = data.mem.usedPct || 0;
  els.valMem.textContent = memPct + '%';
  setGauge(els.gaugeMem, memPct);
  els.chipMem.querySelector('span').textContent = memPct + '%';
  if (els.detMemUsed) els.detMemUsed.textContent = gb(data.mem.used) + ' Go';
  if (els.detMemTotal) els.detMemTotal.textContent = gb(data.mem.total) + ' Go';
  if (els.detMemFree) els.detMemFree.textContent = gb(data.mem.free) + ' Go';
  if (els.detMemAvailable) {
    els.detMemAvailable.textContent =
      data.mem.available != null ? gb(data.mem.available) + ' Go' : '--';
  }

  // Disque (partition principale / racine préférée)
  const mainFs =
    (data.disk.fs && data.disk.fs.find((f) => f.mount === '/' || f.mount === 'C:\\')) ||
    (data.disk.fs && data.disk.fs[0]) ||
    {};
  els.valDisk.textContent = (mainFs.usedPct || data.disk.usedPct || 0) + '%';
  setGauge(els.gaugeDisk, mainFs.usedPct || data.disk.usedPct || 0);
  if (els.detDiskUsed) els.detDiskUsed.textContent = gb(mainFs.used || 0) + ' Go';
  if (els.detDiskTotal) els.detDiskTotal.textContent = gb(mainFs.total || 0) + ' Go';
  if (els.detDiskFree) els.detDiskFree.textContent = gb(mainFs.free || 0) + ' Go';
  if (els.detDiskMount) els.detDiskMount.textContent = mainFs.mount || '/';

  // Réseau (débit instantané)
  const rxBps = data.net.rxBps || 0;
  const txBps = data.net.txBps || 0;
  const totalBps = rxBps + txBps;
  els.valNet.textContent = formatBytes(totalBps) + '/s';
  setGauge(els.gaugeNet, Math.min(100, (totalBps / (125 * 1024)) * 100)); // échelle 1 Mo/s = 100%
  if (els.detNetRx) els.detNetRx.textContent = formatBytes(rxBps) + '/s';
  if (els.detNetTx) els.detNetTx.textContent = formatBytes(txBps) + '/s';
  const activeIface =
    (data.net.interfaces && data.net.interfaces.find((i) => i.operstate === 'up')) ||
    (data.net.interfaces && data.net.interfaces[0]) ||
    {};
  if (els.detNetIface) els.detNetIface.textContent = activeIface.name || '--';
  if (els.detNetState)
    els.detNetState.textContent = activeIface.operstate ? activeIface.operstate : '--';

  // Batterie
  const hasBattery = data.battery && data.battery.percent != null;
  if (els.widgetBattery) {
    if (hasBattery) {
      els.widgetBattery.classList.remove('hidden');
      const batPct = data.battery.percent;
      els.valBattery.textContent = batPct + '%';
      setGauge(els.gaugeBattery, batPct);
      if (els.detBatteryState)
        els.detBatteryState.textContent = data.battery.isCharging ? 'En charge' : 'Déconnecté';
      if (els.detBatteryTime)
        els.detBatteryTime.textContent =
          data.battery.timeRemaining != null && data.battery.timeRemaining > 0
            ? formatUptime(data.battery.timeRemaining * 60)
            : '--';
    } else {
      els.widgetBattery.classList.add('hidden');
    }
  }

  // GPU / Infos système
  if (els.widgetGpu) {
    if (data.gpu) {
      els.widgetGpu.classList.remove('hidden');
      els.valGpu.textContent = (data.gpu.model || 'GPU').length > 20
        ? (data.gpu.model || 'GPU').slice(0, 20) + '…'
        : data.gpu.model || 'GPU';
      if (els.detGpuModel) els.detGpuModel.textContent = data.gpu.model || '--';
      if (els.detGpuVram) els.detGpuVram.textContent = data.gpu.vram ? gb(data.gpu.vram) + ' Go' : '--';
    } else {
      els.widgetGpu.classList.add('hidden');
    }
  }

  if (els.valOs) {
    els.valOs.textContent = data.os.distro || data.os.platform || '--';
  }
  if (els.detOs) els.detOs.textContent = `${data.os.distro || data.os.platform || '--'} ${data.os.release || ''}`.trim() || '--';
  if (els.detArch) els.detArch.textContent = data.os.arch || '--';
  if (els.detUser) els.detUser.textContent = data.os.user || '--';
  if (els.detHostname) els.detHostname.textContent = data.os.hostname || '--';
  if (els.detUptime) els.detUptime.textContent = formatUptime(data.os.uptime || data.time.uptime || 0);

  // Son chip
  if (els.soundChip) {
    els.soundChip.textContent = state.soundEnabled ? 'ON' : 'OFF';
  }

  // Surcharge
  evaluateOverload(cpuLoad, memPct);

  scheduleNext();
}

let timer = null;
function scheduleNext() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(update, state.refresh);
}

function start() {
  scheduleNext();
}

/* ---------- Paramètres : écouteurs ---------- */
function bindSettings() {
  // Thème
  els.themeSelect.addEventListener('change', (e) => {
    state.theme = e.target.value;
    applyTheme();
  });

  // Couleur d'accent
  els.accentColor.addEventListener('input', (e) => {
    state.accent = e.target.value;
    applyTheme();
  });

  // Son
  els.soundToggle.checked = state.soundEnabled;
  els.soundToggle.addEventListener('change', (e) => {
    state.soundEnabled = e.target.checked;
    saveSetting('pw-sound', String(state.soundEnabled));
    els.soundStatus.textContent = state.soundEnabled ? 'Activé' : 'Désactivé';
    document.documentElement.classList.toggle('sound-on', state.soundEnabled);
  });

  // Seuils
  els.cpuThreshold.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    state.cpuThreshold = v;
    els.cpuThresholdVal.textContent = v + '%';
    saveSetting('pw-cpu-threshold', String(v));
  });
  els.memThreshold.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    state.memThreshold = v;
    els.memThresholdVal.textContent = v + '%';
    saveSetting('pw-mem-threshold', String(v));
  });

  // Rafraîchissement
  els.refreshSelect.addEventListener('change', (e) => {
    state.refresh = Number(e.target.value);
    saveSetting('pw-refresh', String(state.refresh));
    scheduleNext();
  });

  // Ouvrir / fermer le panneau
  els.settingsBtn.addEventListener('click', () => {
    els.settingsPanel.classList.add('open');
  });
  els.closeSettings.addEventListener('click', () => {
    els.settingsPanel.classList.remove('open');
  });
  els.settingsPanel.addEventListener('click', (e) => {
    if (e.target === els.settingsPanel) els.settingsPanel.classList.remove('open');
  });

  // Réinitialiser
  els.resetSettings.addEventListener('click', () => {
    if (!confirm('Réinitialiser tous les paramètres ?')) return;
    localStorage.removeItem('pw-theme');
    localStorage.removeItem('pw-accent');
    localStorage.removeItem('pw-sound');
    localStorage.removeItem('pw-cpu-threshold');
    localStorage.removeItem('pw-mem-threshold');
    localStorage.removeItem('pw-refresh');
    location.reload();
  });
}

/* ---------- Initialisation ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // Valeurs initiales des contrôles
  els.cpuThresholdVal.textContent = state.cpuThreshold + '%';
  els.memThresholdVal.textContent = state.memThreshold + '%';
  els.soundStatus.textContent = state.soundEnabled ? 'Activé' : 'Désactivé';
  document.documentElement.classList.toggle('sound-on', state.soundEnabled);

  applyTheme();
  bindSettings();
  start();
});
