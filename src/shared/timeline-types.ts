// Timeline visualization types for AI Usage Monitor

import { NormalizedEntry, ModelUsage, ProviderUsage } from './types';

// Timeline Data Point represents a single time slice with aggregated usage data
export interface TimelineDataPoint {
  timestamp: Date;
  durationMs: number; // Duration this data point represents
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  costUSD: number;
  entryCount: number;
  modelBreakdown: Record<string, ModelUsage>;
  providerBreakdown: Record<string, ProviderUsage>;
}

// Aggregated Timeline Point for optimized rendering
export interface AggregatedTimelinePoint {
  timestamp: Date;
  totalTokens: number;
  totalCostUSD: number;
  entryCount: number;
  providerData: Record<string, {
    tokens: number;
    cost: number;
    color: string;
  }>;
}

// Timeline configuration options
export interface TimelineConfig {
  bufferSize: number; // Number of data points to keep in memory
  maxRetentionMs: number; // Maximum age of data points to keep
  aggregationIntervalMs: number; // How often to aggregate data
  timeWindowsMs: number[]; // Available time windows (1h, 6h, 24h, 7d, 30d)
  resolutionMs: number; // Minimum resolution for data points
  enablePrediction: boolean; // Whether to show usage prediction
  maxDataPoints: number; // Maximum data points for visualization
}

// Timeline visualization rendering options
export interface TimelineVisualization {
  mode: 'linear' | 'area' | 'bars' | 'sparkline';
  showGrid: boolean;
  showLabels: boolean;
  showTooltip: boolean;
  colorScheme: 'provider' | 'model' | 'cost' | 'tokens';
  smoothing: boolean;
  animationDuration: number;
  height: number;
  width: number;
  padding: number;
}

// Time window presets (in milliseconds)
export const TIME_WINDOWS = {
  ONE_HOUR: 60 * 60 * 1000,
  SIX_HOURS: 6 * 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  SEVEN_DAYS: 7 * 24 * 60 * 60 * 1000,
  THIRTY_DAYS: 30 * 24 * 60 * 60 * 1000,
} as const;

// Default timeline configuration
export const DEFAULT_TIMELINE_CONFIG: TimelineConfig = {
  bufferSize: 1000,
  maxRetentionMs: TIME_WINDOWS.THIRTY_DAYS,
  aggregationIntervalMs: 60 * 1000, // 1 minute
  timeWindowsMs: [
    TIME_WINDOWS.ONE_HOUR,
    TIME_WINDOWS.SIX_HOURS,
    TIME_WINDOWS.ONE_DAY,
    TIME_WINDOWS.SEVEN_DAYS,
    TIME_WINDOWS.THIRTY_DAYS,
  ],
  resolutionMs: 60 * 1000, // 1 minute minimum resolution
  enablePrediction: false,
  maxDataPoints: 200,
};

// Default visualization settings
export const DEFAULT_TIMELINE_VISUALIZATION: TimelineVisualization = {
  mode: 'area',
  showGrid: false,
  showLabels: false,
  showTooltip: true,
  colorScheme: 'provider',
  smoothing: true,
  animationDuration: 300,
  height: 16, // Windows tray constraint
  width: 16,
  padding: 2,
};

// Provider color mappings for consistent visualization
export const PROVIDER_COLORS: Record<string, string> = {
  'claude-code': '#FF6B35', // Orange
  'cursor': '#0066CC', // Blue
  'github-copilot': '#24292E', // Dark gray
  'openai': '#10A37F', // Green
  'anthropic': '#D97757', // Brown
  'google': '#4285F4', // Google blue
  'microsoft': '#00BCF2', // Cyan
  'default': '#6B7280', // Gray
};

// Memory management types
export interface MemoryStats {
  bufferSize: number;
  usedSlots: number;
  memoryUsageMB: number;
  oldestDataPoint: Date | null;
  newestDataPoint: Date | null;
  dataPointsInTimeWindow: number;
}

// Timeline export options
export interface TimelineExport {
  format: 'png' | 'csv' | 'json';
  timeWindowMs: number;
  includeBreakdown: boolean;
  resolution: number; // Data points per export
  quality?: number; // For PNG exports (0-1)
}

// Timeline aggregation strategy
export type AggregationStrategy = 'sum' | 'average' | 'max' | 'min' | 'weighted';

// Timeline data filters
export interface TimelineFilter {
  providers: string[];
  models: string[];
  minTokens?: number;
  maxCost?: number;
  startDate?: Date;
  endDate?: Date;
}

// Timeline analytics
export interface TimelineAnalytics {
  peakUsageTime: Date | null;
  averageUsageRate: number; // tokens per minute
  growthRate: number; // percentage change
  prediction: {
    nextHourTokens: number;
    nextDayTokens: number;
    confidence: number;
  } | null;
  trends: {
    direction: 'increasing' | 'decreasing' | 'stable';
    strength: number; // 0-1
  };
}

// Real-time update events
export interface TimelineUpdateEvent {
  type: 'data-point-added' | 'buffer-overflow' | 'configuration-changed' | 'memory-cleanup';
  timestamp: Date;
  data?: TimelineDataPoint;
  metadata?: Record<string, any>;
}

// IPC Channel extensions for timeline
export const TIMELINE_IPC_CHANNELS = {
  GET_TIMELINE_DATA: 'timeline:get-data',
  GET_TIMELINE_CONFIG: 'timeline:get-config',
  SET_TIMELINE_CONFIG: 'timeline:set-config',
  EXPORT_TIMELINE: 'timeline:export',
  GET_TIMELINE_ANALYTICS: 'timeline:get-analytics',
  TIMELINE_DATA_UPDATED: 'timeline:data-updated',
  GET_MEMORY_STATS: 'timeline:get-memory-stats',
} as const;