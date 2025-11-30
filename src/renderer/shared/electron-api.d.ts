import { AggregatedUsage, AppSettings, AppStatus } from '../../shared/types';

export interface UsageData {
  daily: AggregatedUsage | null;
  weekly: AggregatedUsage | null;
  monthly: AggregatedUsage | null;
  entries: any[];
  status: AppStatus;
  lastUpdated: string | null;
  isHighUsage: boolean;
}

export interface ProviderInfo {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  supported: boolean;
}

export interface ElectronAPI {
  getUsageData: () => Promise<UsageData>;
  getDailyUsage: () => Promise<AggregatedUsage | null>;
  refreshData: () => Promise<void>;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  getProviders: () => Promise<ProviderInfo[]>;
  toggleProvider: (providerId: string, enabled: boolean) => Promise<void>;
  onUsageUpdated: (callback: (data: UsageData) => void) => () => void;

  // Timeline methods
  getTimelineData: (timeWindowMs: number, maxPoints?: number) => Promise<any[]>;
  getTimelineConfig: () => Promise<any>;
  setTimelineConfig: (config: any) => Promise<void>;
  exportTimeline: (exportOptions: any) => Promise<Buffer | string>;
  getTimelineAnalytics: (timeWindowMs: number) => Promise<any>;
  getMemoryStats: () => Promise<any>;
  onTimelineUpdated: (callback: (data: any) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
