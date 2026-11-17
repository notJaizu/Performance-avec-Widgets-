const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const si = require('systeminformation');

const WINDOW_WIDTH = 1200;
const WINDOW_HEIGHT = 800;

// Historique des octets réseau pour calculer le débit en temps réel
const netHistory = {};

function createWindow() {
  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
  });

  // Ouvrir les outils dev en développement (décommenter si besoin)
  // win.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

/**
 * Rassemble toutes les métriques système en une seule réponse.
 * Chaque métrique est entourée de try/catch pour qu'un capteur indisponible
 * (GPU, température, batterie...) ne fasse pas échouer l'ensemble.
 */
ipcMain.handle('system-info', async () => {
  const now = Date.now();
  const result = {
    timestamp: now,
    cpu: { load: 0, cpus: [], loadavg: [0, 0, 0], temp: null },
    mem: { total: 0, free: 0, used: 0, usedPct: 0 },
    disk: { total: 0, used: 0, free: 0, usedPct: 0, fs: [] },
    net: { interfaces: [], totalRx: 0, totalTx: 0, rxBps: 0, txBps: 0 },
    os: { platform: '', distro: '', release: '', arch: '', uptime: 0, user: '', hostname: '' },
    battery: null,
    gpu: null,
    time: { now: new Date().toISOString(), uptime: 0 },
  };

  try {
    const [load, mem, fsSize, osInfo, battery, network, graphics, timeInfo] =
      await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.osInfo(),
        si.battery(),
        si.networkStats(),
        si.graphics(),
        si.time(),
      ]);

    result.cpu.load = Math.round(load.currentload * 10) / 10;
    result.cpu.cpus = load.cpus.map((c) => ({
      load: Math.round(c.load * 10) / 10,
      speed: c.speed,
    }));
    result.cpu.loadavg = load.loadavg || [0, 0, 0];

    try {
      const temp = await si.cpuTemperature();
      result.cpu.temp = temp.main != null ? Math.round(temp.main * 10) / 10 : null;
    } catch (e) {
      result.cpu.temp = null;
    }

    result.mem.total = mem.total;
    result.mem.free = mem.free;
    result.mem.used = mem.used;
    result.mem.usedPct = Math.round((mem.used / mem.total) * 1000) / 10;

    let diskTotal = 0;
    let diskUsed = 0;
    result.disk.fs = (fsSize || []).map((f) => {
      const t = f.size || 0;
      const u = f.used || 0;
      diskTotal += t;
      diskUsed += u;
      return {
        fs: f.fs,
        mount: f.mount,
        total: t,
        used: u,
        free: f.free || 0,
        usedPct: t > 0 ? Math.round((u / t) * 1000) / 10 : 0,
      };
    });
    result.disk.total = diskTotal;
    result.disk.used = diskUsed;
    result.disk.free = diskTotal - diskUsed;
    result.disk.usedPct = diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 1000) / 10 : 0;

    const ifaces = (network || []).map((n) => {
      const name = n.iface || 'unknown';
      const prev = netHistory[name];
      let rxBps = 0;
      let txBps = 0;
      if (prev && now > prev.time) {
        const dt = (now - prev.time) / 1000;
        rxBps = Math.max(0, (n.rx_bytes - prev.rx_bytes) / dt);
        txBps = Math.max(0, (n.tx_bytes - prev.tx_bytes) / dt);
      }
      netHistory[name] = { time: now, rx_bytes: n.rx_bytes, tx_bytes: n.tx_bytes };
      return {
        name,
        rx_bytes: n.rx_bytes,
        tx_bytes: n.tx_bytes,
        rxBps,
        txBps,
        operstate: n.operstate,
      };
    });
    result.net.interfaces = ifaces;
    result.net.totalRx = ifaces.reduce((s, i) => s + i.rx_bytes, 0);
    result.net.totalTx = ifaces.reduce((s, i) => s + i.tx_bytes, 0);
    result.net.rxBps = ifaces.reduce((s, i) => s + i.rxBps, 0);
    result.net.txBps = ifaces.reduce((s, i) => s + i.txBps, 0);

    result.os.platform = osInfo.platform;
    result.os.distro = osInfo.distro || osInfo.release;
    result.os.release = osInfo.release;
    result.os.arch = osInfo.arch;
    result.os.uptime = osInfo.uptime;
    result.os.user = osInfo.user;
    result.os.hostname = osInfo.hostname;

    if (battery) {
      result.battery = {
        percent: battery.percent != null ? Math.round(battery.percent) : null,
        isCharging: battery.isCharging,
        timeRemaining: battery.timeRemaining,
        powerPlugged: battery.power_plugged,
      };
    }

    if (graphics && graphics.controllers && graphics.controllers.length) {
      const g = graphics.controllers[0];
      result.gpu = {
        model: g.model || 'GPU',
        vram: g.vram,
        bus: g.bus,
      };
    }

    result.time.now = new Date().toISOString();
    result.time.uptime = timeInfo.uptime;
  } catch (err) {
    console.error('Erreur collecte métriques:', err.message);
  }

  return result;
});
