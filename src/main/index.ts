import { app, BrowserWindow } from 'electron';
import { TrayManager } from './tray-manager';
import { appStateManager } from './app-state';
import { ipcHandler } from './ipc-handler';
import { settingsManager } from './settings-manager';
import path from 'path';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch {
  // electron-squirrel-startup not available
}

class Application {
  private trayManager: TrayManager | null = null;
  private dashboardWindow: BrowserWindow | null = null;
  private settingsWindow: BrowserWindow | null = null;

  constructor() {
    this.setupAppEvents();
  }

  private setupAppEvents(): void {
    app.whenReady().then(() => {
      this.initialize();
    });

    app.on('window-all-closed', () => {
      // Don't quit - we're a tray app
    });

    app.on('activate', () => {
      // On macOS, re-create window if dock icon clicked
      if (BrowserWindow.getAllWindows().length === 0) {
        this.openDashboard();
      }
    });

    app.on('before-quit', () => {
      this.cleanup();
    });
  }

  private async initialize(): Promise<void> {
    // Hide dock icon on macOS (we're a menu bar app)
    if (process.platform === 'darwin') {
      app.dock?.hide();
    }

    // Initialize IPC handlers (must be done after app is ready)
    ipcHandler.initialize();

    // Initialize tray
    this.trayManager = new TrayManager({
      onOpenDashboard: () => this.openDashboard(),
      onOpenSettings: () => this.openSettings(),
      onRefresh: () => this.refreshData(),
      onQuit: () => this.quit(),
    });

    // Initialize app state and start data loading
    await appStateManager.initialize();

    // Update tray tooltip when state changes
    appStateManager.on('state-changed', () => {
      this.trayManager?.updateTooltip(appStateManager.getTooltipText());
    });

    // Update tray icon on high usage
    appStateManager.on('high-usage-alert', () => {
      this.trayManager?.setAlertState(true);
    });

    // Reset alert state when usage drops below threshold
    appStateManager.on('state-changed', () => {
      if (!appStateManager.isHighUsage()) {
        this.trayManager?.setAlertState(false);
      }
    });

    // Initial tooltip update
    this.trayManager.updateTooltip(appStateManager.getTooltipText());

    console.log('AI Usage Monitor started');
  }

  public openDashboard(): void {
    if (this.dashboardWindow) {
      this.dashboardWindow.show();
      this.dashboardWindow.focus();
      return;
    }

    this.dashboardWindow = new BrowserWindow({
      width: 1000,
      height: 750,
      title: 'AI Usage Monitor - Dashboard',
      backgroundColor: '#0f0f23',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, './preload.js'),
      },
      show: false,
    });

    // Register for IPC broadcasts
    ipcHandler.registerWindow(this.dashboardWindow);

    // Load the dashboard page
    const isDev = !app.isPackaged;
    if (isDev) {
      // In dev mode, load from source files directly
      // __dirname is dist/main/main/, so go up 3 levels to project root
      this.dashboardWindow.loadFile(path.join(__dirname, '../../../src/renderer/dashboard.html'));
    } else {
      this.dashboardWindow.loadFile(path.join(__dirname, '../renderer/dashboard.html'));
    }

    this.dashboardWindow.once('ready-to-show', () => {
      this.dashboardWindow?.show();
    });

    this.dashboardWindow.on('closed', () => {
      this.dashboardWindow = null;
    });

    // Minimize to tray instead of closing
    this.dashboardWindow.on('close', (event) => {
      if (!(app as any).isQuitting) {
        event.preventDefault();
        this.dashboardWindow?.hide();
      }
    });
  }

  public openSettings(): void {
    if (this.settingsWindow) {
      this.settingsWindow.show();
      this.settingsWindow.focus();
      return;
    }

    this.settingsWindow = new BrowserWindow({
      width: 500,
      height: 650,
      title: 'AI Usage Monitor - Settings',
      backgroundColor: '#0f0f23',
      resizable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, './preload.js'),
      },
      show: false,
    });

    // Register for IPC broadcasts
    ipcHandler.registerWindow(this.settingsWindow);

    // Load the settings page
    const isDev = !app.isPackaged;
    if (isDev) {
      // __dirname is dist/main/main/, so go up 3 levels to project root
      this.settingsWindow.loadFile(path.join(__dirname, '../../../src/renderer/settings.html'));
    } else {
      this.settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));
    }

    this.settingsWindow.once('ready-to-show', () => {
      this.settingsWindow?.show();
    });

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });
  }

  private async refreshData(): Promise<void> {
    console.log('Refreshing data...');
    await appStateManager.refreshData();
  }

  private cleanup(): void {
    appStateManager.cleanup();
    this.trayManager?.destroy();
  }

  private quit(): void {
    (app as any).isQuitting = true;
    app.quit();
  }
}

// Note: Using (app as any).isQuitting for the quit flag

// Start the application
new Application();
