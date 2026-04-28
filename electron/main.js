const { app, BrowserWindow, shell, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const { spawn, execSync } = require("child_process");
const net = require("net");
const fs = require("fs");

const BACKEND_PORT = 57100;
const FRONTEND_PORT = 57101;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`;

let mainWindow = null;
let tray = null;
let backendProcess = null;
let frontendProcess = null;

function killPort(port) {
  try {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { shell: "/bin/sh" });
  } catch (_) { }
}

function waitForPort(port, timeout = 90000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      const sock = new net.Socket();
      sock.setTimeout(500);
      sock.on("connect", () => { sock.destroy(); resolve(); });
      sock.on("error", () => {
        sock.destroy();
        if (Date.now() - start > timeout) reject(new Error(`Port ${port} açılamadı`));
        else setTimeout(check, 800);
      });
      sock.on("timeout", () => {
        sock.destroy();
        if (Date.now() - start > timeout) reject(new Error(`Port ${port} timeout`));
        else setTimeout(check, 800);
      });
      sock.connect(port, "127.0.0.1");
    }
    check();
  });
}

function getResourcePath(...parts) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...parts);
  }
  // dev modunda borsa/ klasörü
  return path.join(__dirname, "..", ...parts);
}

function startBackend() {
  killPort(BACKEND_PORT);

  const pythonBin = getResourcePath("backend_bundle", "venv", "bin", "python3.12");
  const backendSrc = getResourcePath("backend_bundle", "src");
  const userData = app.getPath("userData");
  const logsDir = path.join(userData, "logs");

  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

  // .env dosyasını userData'ya kopyala (API key saklanır, ilk kurulumda)
  const envSrc = path.join(backendSrc, ".env");
  const envDst = path.join(userData, ".env");
  if (fs.existsSync(envSrc) && !fs.existsSync(envDst)) {
    fs.copyFileSync(envSrc, envDst);
  }

  const dbPath = path.join(userData, "bist30.db");

  const env = {
    ...process.env,
    PORT: String(BACKEND_PORT),
    DATABASE_URL: `sqlite:///${dbPath}`,
    LOGS_DIR: logsDir,
    DOTENV_PATH: envDst,
  };

  backendProcess = spawn(pythonBin, ["-m", "uvicorn", "main:app",
    "--host", "127.0.0.1",
    "--port", String(BACKEND_PORT),
    "--log-level", "info",
  ], {
    cwd: backendSrc,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const logFile = path.join(logsDir, "backend.log");
  const logStream = fs.createWriteStream(logFile, { flags: "a" });
  backendProcess.stdout.pipe(logStream);
  backendProcess.stderr.pipe(logStream);
  backendProcess.on("exit", (code) => {
    console.log(`Backend exited: ${code}`);
  });
}

function startFrontend() {
  killPort(FRONTEND_PORT);

  const frontendDir = getResourcePath("frontend_standalone");
  const serverJs = path.join(frontendDir, "server.js");
  const userData = app.getPath("userData");
  const logsDir = path.join(userData, "logs");

  // Electron'un kendi Node runtime'ını kullan
  const nodeExec = process.execPath;

  const env = {
    ...process.env,
    PORT: String(FRONTEND_PORT),
    HOSTNAME: "127.0.0.1",
    NEXT_PUBLIC_API_URL: BACKEND_URL,
    NODE_ENV: "production",
  };

  frontendProcess = spawn(nodeExec, [serverJs], {
    cwd: frontendDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const logFile = path.join(logsDir, "frontend.log");
  const logStream = fs.createWriteStream(logFile, { flags: "a" });
  frontendProcess.stdout.pipe(logStream);
  frontendProcess.stderr.pipe(logStream);
  frontendProcess.on("exit", (code) => {
    console.log(`Frontend exited: ${code}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0A0E1A",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, "assets", "icon.icns"),
  });

  mainWindow.loadURL(FRONTEND_URL);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

function createTray() {
  const iconPath = path.join(__dirname, "assets", "tray-icon.png");
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  const menu = Menu.buildFromTemplate([
    { label: "BIST30 AI'ı Aç", click: () => { if (mainWindow) mainWindow.show(); else createWindow(); } },
    { type: "separator" },
    { label: "Çıkış", click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip("BIST30 AI");
}

app.whenReady().then(async () => {
  createTray();

  // Splash ekran
  const splash = new BrowserWindow({
    width: 400,
    height: 240,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: "#0A0E1A",
    webPreferences: { nodeIntegration: false },
  });

  splash.loadURL(`data:text/html;charset=utf-8,<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0A0E1A;display:flex;flex-direction:column;
    align-items:center;justify-content:center;height:100vh;
    font-family:-apple-system,system-ui;color:#f9fafb;-webkit-app-region:drag}
  .logo{font-size:32px;font-weight:900;letter-spacing:-1px;color:#00D4A8}
  .sub{margin-top:6px;font-size:13px;color:#6b7280}
  .bar-wrap{margin-top:28px;width:220px;height:3px;background:#1f2937;border-radius:2px;overflow:hidden}
  .bar{height:100%;width:10%;background:linear-gradient(90deg,#00D4A8,#00a88a);
    border-radius:2px;animation:grow 8s ease-in-out forwards}
  @keyframes grow{0%{width:5%}80%{width:88%}100%{width:90%}}
</style></head>
<body>
  <div class="logo">BIST30 AI</div>
  <div class="sub">Başlatılıyor, lütfen bekleyin...</div>
  <div class="bar-wrap"><div class="bar"></div></div>
</body></html>`);

  try {
    startBackend();
    startFrontend();

    await Promise.all([
      waitForPort(BACKEND_PORT, 90000),
      waitForPort(FRONTEND_PORT, 90000),
    ]);

    splash.close();
    createWindow();
  } catch (err) {
    splash.close();
    const logsDir = path.join(app.getPath("userData"), "logs");
    const errWin = new BrowserWindow({
      width: 520, height: 320,
      backgroundColor: "#0A0E1A",
      webPreferences: { nodeIntegration: false },
    });
    errWin.loadURL(`data:text/html;charset=utf-8,<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body{background:#0A0E1A;color:#f9fafb;font-family:-apple-system,system-ui;padding:32px}
  h2{color:#FF4560;margin-bottom:12px}p{color:#6b7280;font-size:13px;line-height:1.6}
</style></head><body>
  <h2>Başlatma Hatası</h2>
  <p>${String(err)}</p>
  <p style="margin-top:16px">Log dosyaları:<br><code>${logsDir}</code></p>
</body></html>`);
  }

  app.on("activate", () => { if (!mainWindow) createWindow(); });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (backendProcess) backendProcess.kill("SIGTERM");
  if (frontendProcess) frontendProcess.kill("SIGTERM");
  killPort(BACKEND_PORT);
  killPort(FRONTEND_PORT);
});
