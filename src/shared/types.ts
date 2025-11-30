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

export interface MenuBarStats {
  providers: ProviderStats[];
  isMockData: boolean;
  lastUpdated: Date | null;
}

export interface ProviderStats {
  name: string;
  cost?: number;
  tokens?: number;
  entries?: number;
  balance?: string;
  requestUsed?: string;
  plan?: string;
  billingPeriod?: string;
  isActive?: boolean;
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
  // Timeline settings
  timelineEnabled: boolean;
  timelineTimeWindow: number; // in milliseconds
  timelineVisualizationMode: 'linear' | 'area' | 'bars' | 'sparkline';
  timelineProviderColors: Record<string, string>;
}

export const DEFAULT_SETTINGS: AppSettings = {
  refreshIntervalSeconds: 60,
  displayFormat: 'cost',
  usageAlertEnabled: false,
  usageAlertThreshold: 10,
  launchAtLogin: false,
  enabledProviders: ['claude-code', 'cursor'],
  customDataDirectories: [],
  // Timeline defaults
  timelineEnabled: true,
  timelineTimeWindow: 6 * 60 * 60 * 1000, // 6 hours
  timelineVisualizationMode: 'area',
  timelineProviderColors: {
    'claude-code': '#FF6B35',
    'cursor': '#0066CC',
    'github-copilot': '#24292E',
    'openai': '#10A37F',
    'anthropic': '#D97757',
    'google': '#4285F4',
    'microsoft': '#00BCF2',
  },
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
  // Timeline channels
  GET_TIMELINE_DATA: 'timeline:get-data',
  GET_TIMELINE_CONFIG: 'timeline:get-config',
  SET_TIMELINE_CONFIG: 'timeline:set-config',
  EXPORT_TIMELINE: 'timeline:export',
  GET_TIMELINE_ANALYTICS: 'timeline:get-analytics',
  TIMELINE_DATA_UPDATED: 'timeline:data-updated',
  GET_MEMORY_STATS: 'timeline:get-memory-stats',
} as const;
