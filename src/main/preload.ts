import { contextBridge, ipcRenderer } from 'electron';

// IPC Channel names (hardcoded to avoid module imports in preload)
const IPC_CHANNELS = {
  GET_USAGE_DATA: 'get-usage-data',
  GET_DAILY_USAGE: 'get-daily-usage',
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
  REFRESH_DATA: 'refresh-data',
  GET_PROVIDERS: 'get-providers',
  TOGGLE_PROVIDER: 'toggle-provider',
};

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Usage data
  getUsageData: () => ipcRenderer.invoke(IPC_CHANNELS.GET_USAGE_DATA),
  getDailyUsage: () => ipcRenderer.invoke(IPC_CHANNELS.GET_DAILY_USAGE),
  refreshData: () => ipcRenderer.invoke(IPC_CHANNELS.REFRESH_DATA),

  // Settings
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
  saveSettings: (settings: any) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),

  // Providers
  getProviders: () => ipcRenderer.invoke(IPC_CHANNELS.GET_PROVIDERS),
  toggleProvider: (providerId: string, enabled: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.TOGGLE_PROVIDER, providerId, enabled),

  // Events
  onUsageUpdated: (callback: (data: any) => void) => {
    ipcRenderer.on('usage-updated', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('usage-updated');
  },

  onSettingsUpdated: (callback: (data: any) => void) => {
    ipcRenderer.on('settings-updated', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('settings-updated');
  },
});
