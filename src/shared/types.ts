// Shared types between main and renderer processes

export interface NormalizedEntry {
  timestamp: Date;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  costUSD: number;
  sessionId: string;
  projectId: string;
  provider: string;
}

export interface AggregatedUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCostUSD: number;
  entryCount: number;
  modelBreakdown: Record<string, ModelUsage>;
  providerBreakdown: Record<string, ProviderUsage>;
}

export interface ModelUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUSD: number;
  entryCount: number;
}

export interface ProviderUsage {
  providerId: string;
  providerName: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  costUSD: number;
  entryCount: number;
}

export interface ModelPricing {
  inputPricePerToken: number;
  outputPricePerToken: number;
  cacheCreatePricePerToken: number;
  cacheReadPricePerToken: number;
}

export interface AppSettings {
  refreshIntervalSeconds: number;
  displayFormat: 'cost' | 'tokens';
  usageAlertEnabled: boolean;
  usageAlertThreshold: number;
  launchAtLogin: boolean;
  enabledProviders: string[];
  customDataDirectories: string[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  refreshIntervalSeconds: 60,
  displayFormat: 'cost',
  usageAlertEnabled: false,
  usageAlertThreshold: 10,
  launchAtLogin: false,
  enabledProviders: ['claude-code', 'cursor'],
  customDataDirectories: [],
};

export enum AppStatus {
  Loading = 'loading',
  Success = 'success',
  Stale = 'stale',
  Error = 'error',
}

// IPC Channel names
export const IPC_CHANNELS = {
  GET_USAGE_DATA: 'get-usage-data',
  GET_DAILY_USAGE: 'get-daily-usage',
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
  REFRESH_DATA: 'refresh-data',
  GET_PROVIDERS: 'get-providers',
  TOGGLE_PROVIDER: 'toggle-provider',
} as const;
