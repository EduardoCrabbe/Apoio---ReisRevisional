const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
let backendProcess = null;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

function startBackend() {
  if (isDev) {
    console.log("Modo de desenvolvimento: Certifique-se de que o backend FastAPI esteja rodando manualmente.");
  } else {
    // In production, we bundle the backend executable
    const backendPath = path.join(process.resourcesPath, 'backend', 'backend.exe');
    backendProcess = spawn(backendPath);
    
    backendProcess.stdout.on('data', (data) => {
      console.log(`Backend stdout: ${data}`);
    });
    backendProcess.stderr.on('data', (data) => {
      console.error(`Backend stderr: ${data}`);
    });
  }
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});
