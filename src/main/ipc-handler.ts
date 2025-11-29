import { ipcMain, BrowserWindow } from 'electron';
import { appStateManager } from './app-state';
import { settingsManager } from './settings-manager';
import { providerRegistry } from './providers';
import { autoLaunchManager } from './auto-launch';
import { notificationManager } from './notification-manager';
import { IPC_CHANNELS, AppSettings } from '../shared/types';

/**
 * IPC Handler - manages communication between main and renderer processes
 */
export class IPCHandler {
  private windows: Set<BrowserWindow> = new Set();
  private initialized: boolean = false;

  constructor() {
    // Don't initialize in constructor - must wait for app to be ready
  }

  /**
   * Initialize IPC handlers (must be called after app is ready)
   */
  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.setupHandlers();
    this.setupStateListeners();
  }

  /**
   * Setup IPC handlers
   */
  private setupHandlers(): void {
    // Get usage data
    ipcMain.handle(IPC_CHANNELS.GET_USAGE_DATA, async () => {
      return {
        daily: appStateManager.getDailyUsage(),
        weekly: appStateManager.getWeeklyUsage(),
        monthly: appStateManager.getMonthlyUsage(),
        entries: appStateManager.getEntries().slice(0, 100), // Limit for performance
        status: appStateManager.getStatus(),
        lastUpdated: appStateManager.getLastUpdated()?.toISOString(),
        isHighUsage: appStateManager.isHighUsage(),
      };
    });

    // Get daily usage
    ipcMain.handle(IPC_CHANNELS.GET_DAILY_USAGE, async () => {
      return appStateManager.getDailyUsage();
    });

    // Refresh data
    ipcMain.handle(IPC_CHANNELS.REFRESH_DATA, async () => {
      await appStateManager.refreshData();
      return true;
    });

    // Get settings
    ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => {
      const settings = settingsManager.getSettings();
      // Get actual auto-launch status
      settings.launchAtLogin = await autoLaunchManager.isEnabled();
      return settings;
    });

    // Save settings
    ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, async (_, settings: AppSettings) => {
      // Handle auto-launch separately
      const currentSettings = settingsManager.getSettings();
      if (settings.launchAtLogin !== currentSettings.launchAtLogin) {
        await autoLaunchManager.setEnabled(settings.launchAtLogin);
      }

      // Update other settings
      appStateManager.updateSettings(settings);
      return true;
    });

    // Get providers
    ipcMain.handle(IPC_CHANNELS.GET_PROVIDERS, async () => {
      return providerRegistry.getProviderInfo();
    });

    // Toggle provider
    ipcMain.handle(IPC_CHANNELS.TOGGLE_PROVIDER, async (_, providerId: string, enabled: boolean) => {
      providerRegistry.setProviderEnabled(providerId, enabled);
      // Update settings
      const settings = settingsManager.getSettings();
      if (enabled) {
        if (!settings.enabledProviders.includes(providerId)) {
          settings.enabledProviders.push(providerId);
        }
      } else {
        settings.enabledProviders = settings.enabledProviders.filter(
          (id) => id !== providerId
        );
      }
      settingsManager.updateSettings({ enabledProviders: settings.enabledProviders });

      // Refresh data after provider change
      await appStateManager.refreshData();
      return true;
    });

    console.log('IPC handlers registered');
  }

  /**
   * Setup state change listeners
   */
  private setupStateListeners(): void {
    // Forward state changes to all windows
    appStateManager.on('state-changed', (state) => {
      this.broadcast('usage-updated', {
        daily: state.dailyUsage,
        weekly: state.weeklyUsage,
        monthly: state.monthlyUsage,
        status: state.status,
        lastUpdated: state.lastUpdated?.toISOString(),
        isHighUsage: state.isHighUsage,
      });
    });

    // Handle high usage alerts
    appStateManager.on('high-usage-alert', (cost: number) => {
      const settings = settingsManager.getSettings();
      if (settings.usageAlertEnabled) {
        notificationManager.showHighUsageAlert(cost, settings.usageAlertThreshold);
      }
    });

    // Forward settings changes
    appStateManager.on('settings-changed', (settings) => {
      this.broadcast('settings-updated', settings);
    });
  }

  /**
   * Register a window for receiving broadcasts
   */
  registerWindow(window: BrowserWindow): void {
    this.windows.add(window);
    window.on('closed', () => {
      this.windows.delete(window);
    });
  }

  /**
   * Broadcast a message to all windows
   */
  private broadcast(channel: string, data: any): void {
    this.windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, data);
      }
    });
  }
}

// Export singleton instance
export const ipcHandler = new IPCHandler();
