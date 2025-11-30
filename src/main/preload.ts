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

const TIMELINE_IPC_CHANNELS = {
  GET_TIMELINE_DATA: 'timeline:get-data',
  GET_TIMELINE_CONFIG: 'timeline:get-config',
  SET_TIMELINE_CONFIG: 'timeline:set-config',
  EXPORT_TIMELINE: 'timeline:export',
  GET_TIMELINE_ANALYTICS: 'timeline:get-analytics',
  TIMELINE_DATA_UPDATED: 'timeline:data-updated',
  GET_MEMORY_STATS: 'timeline:get-memory-stats',
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

  // Timeline methods
  getTimelineData: (timeWindowMs: number, maxPoints?: number) =>
    ipcRenderer.invoke(TIMELINE_IPC_CHANNELS.GET_TIMELINE_DATA, timeWindowMs, maxPoints),

  getTimelineConfig: () =>
    ipcRenderer.invoke(TIMELINE_IPC_CHANNELS.GET_TIMELINE_CONFIG),

  setTimelineConfig: (config: any) =>
    ipcRenderer.invoke(TIMELINE_IPC_CHANNELS.SET_TIMELINE_CONFIG, config),

  exportTimeline: (exportOptions: any) =>
    ipcRenderer.invoke(TIMELINE_IPC_CHANNELS.EXPORT_TIMELINE, exportOptions),

  getTimelineAnalytics: (timeWindowMs: number) =>
    ipcRenderer.invoke(TIMELINE_IPC_CHANNELS.GET_TIMELINE_ANALYTICS, timeWindowMs),

  getMemoryStats: () =>
    ipcRenderer.invoke(TIMELINE_IPC_CHANNELS.GET_MEMORY_STATS),

  // Events
  onUsageUpdated: (callback: (data: any) => void) => {
    ipcRenderer.on('usage-updated', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('usage-updated');
  },

  onSettingsUpdated: (callback: (data: any) => void) => {
    ipcRenderer.on('settings-updated', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('settings-updated');
  },

  onTimelineUpdated: (callback: (data: any) => void) => {
    ipcRenderer.on(TIMELINE_IPC_CHANNELS.TIMELINE_DATA_UPDATED, (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners(TIMELINE_IPC_CHANNELS.TIMELINE_DATA_UPDATED);
  },
});
