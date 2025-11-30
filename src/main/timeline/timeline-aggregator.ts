// Timeline data aggregator for processing raw usage entries into time-series data

import { EventEmitter } from 'events';
import { NormalizedEntry } from '../../shared/types';
import {
  TimelineDataPoint,
  TimelineConfig,
  AggregatedTimelinePoint,
  TimelineAnalytics,
  TimelineFilter,
  AggregationStrategy,
  TIME_WINDOWS,
  PROVIDER_COLORS,
  DEFAULT_TIMELINE_CONFIG
} from '../../shared/timeline-types';
import { CircularBuffer } from './circular-buffer';

/**
 * Timeline Aggregator processes raw usage entries into timeline data points
 * Handles different time windows, aggregation strategies, and data filtering
 */
export class TimelineAggregator extends EventEmitter {
  private buffer: CircularBuffer;
  private config: TimelineConfig;
  private aggregationTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<TimelineConfig>) {
    super();
    this.config = { ...DEFAULT_TIMELINE_CONFIG, ...config };
    this.buffer = new CircularBuffer(this.config);

    // Set up buffer event listeners
    this.buffer.on('data-point-added', (event) => {
      this.emit('timeline-updated', event);
    });

    this.buffer.on('buffer-overflow', (event) => {
      this.emit('buffer-overflow', event);
      this.performCleanup();
    });
  }

  /**
   * Initialize the aggregator with automatic aggregation
   */
  initialize(): void {
    this.startAggregationTimer();

    // Perform initial cleanup
    this.performCleanup();
  }

  /**
   * Process raw usage entries and add to timeline
   * @param entries Raw usage entries to process
   */
  processEntries(entries: NormalizedEntry[]): void {
    if (entries.length === 0) return;

    // Group entries by time intervals based on resolution
    const timeGroups = this.groupEntriesByTimeInterval(entries);

    // Convert each time group to a timeline data point
    for (const [timestamp, groupEntries] of timeGroups) {
      const dataPoint = this.createTimelineDataPoint(timestamp, groupEntries);
      this.buffer.add(dataPoint);
    }
  }

  /**
   * Group entries by time intervals based on configured resolution
   * @param entries Entries to group
   * @returns Map of timestamp to grouped entries
   */
  private groupEntriesByTimeInterval(entries: NormalizedEntry[]): Map<number, NormalizedEntry[]> {
    const groups = new Map<number, NormalizedEntry[]>();
    const resolutionMs = this.config.resolutionMs;

    for (const entry of entries) {
      // Round timestamp to nearest interval boundary
      const timestampMs = entry.timestamp.getTime();
      const intervalStart = Math.floor(timestampMs / resolutionMs) * resolutionMs;

      if (!groups.has(intervalStart)) {
        groups.set(intervalStart, []);
      }

      groups.get(intervalStart)!.push(entry);
    }

    return groups;
  }

  /**
   * Create a timeline data point from a group of entries
   * @param timestamp Interval start timestamp
   * @param entries Entries in this interval
   * @returns Timeline data point
   */
  private createTimelineDataPoint(timestamp: number, entries: NormalizedEntry[]): TimelineDataPoint {
    if (entries.length === 0) {
      throw new Error('Cannot create data point from empty entry group');
    }

    // Sort entries by timestamp
    entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const firstEntry = entries[0];
    const lastEntry = entries[entries.length - 1];

    // Aggregate all numeric fields
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheCreationTokens = 0;
    let cacheReadTokens = 0;
    let totalTokens = 0;
    let costUSD = 0;
    let entryCount = entries.length;

    // Track model and provider breakdowns
    const modelBreakdown: Record<string, any> = {};
    const providerBreakdown: Record<string, any> = {};

    for (const entry of entries) {
      inputTokens += entry.inputTokens;
      outputTokens += entry.outputTokens;
      cacheCreationTokens += entry.cacheCreationTokens;
      cacheReadTokens += entry.cacheReadTokens;
      totalTokens += entry.totalTokens;
      costUSD += entry.costUSD;

      // Model breakdown
      if (!modelBreakdown[entry.model]) {
        modelBreakdown[entry.model] = {
          model: entry.model,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costUSD: 0,
          entryCount: 0,
        };
      }

      const modelUsage = modelBreakdown[entry.model];
      modelUsage.inputTokens += entry.inputTokens;
      modelUsage.outputTokens += entry.outputTokens;
      modelUsage.totalTokens += entry.totalTokens;
      modelUsage.costUSD += entry.costUSD;
      modelUsage.entryCount++;

      // Provider breakdown
      if (!providerBreakdown[entry.provider]) {
        providerBreakdown[entry.provider] = {
          providerId: entry.provider,
          providerName: entry.provider,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          totalTokens: 0,
          costUSD: 0,
          entryCount: 0,
        };
      }

      const providerUsage = providerBreakdown[entry.provider];
      providerUsage.inputTokens += entry.inputTokens;
      providerUsage.outputTokens += entry.outputTokens;
      providerUsage.cacheCreationTokens += entry.cacheCreationTokens;
      providerUsage.cacheReadTokens += entry.cacheReadTokens;
      providerUsage.totalTokens += entry.totalTokens;
      providerUsage.costUSD += entry.costUSD;
      providerUsage.entryCount++;
    }

    const intervalStart = new Date(timestamp);
    const intervalEnd = new Date(lastEntry.timestamp.getTime() + 1000); // Add 1 second padding
    const durationMs = intervalEnd.getTime() - intervalStart.getTime();

    return {
      timestamp: intervalStart,
      durationMs,
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      totalTokens,
      costUSD,
      entryCount,
      modelBreakdown,
      providerBreakdown,
    };
  }

  /**
   * Get timeline data for a specific time window
   * @param timeWindowMs Time window in milliseconds
   * @param maxPoints Maximum data points to return (for downsampling)
   * @returns Timeline data points
   */
  getTimelineData(timeWindowMs: number, maxPoints?: number): TimelineDataPoint[] {
    const endTime = Date.now();
    const startTime = endTime - timeWindowMs;
    const actualMaxPoints = maxPoints || this.config.maxDataPoints;

    return this.buffer.getDataWithResolution(startTime, endTime, actualMaxPoints);
  }

  /**
   * Get aggregated timeline data optimized for visualization
   * @param timeWindowMs Time window in milliseconds
   * @param maxPoints Maximum data points
   * @returns Aggregated timeline points
   */
  getAggregatedTimelineData(timeWindowMs: number, maxPoints?: number): AggregatedTimelinePoint[] {
    const dataPoints = this.getTimelineData(timeWindowMs, maxPoints);

    return dataPoints.map(point => ({
      timestamp: point.timestamp,
      totalTokens: point.totalTokens,
      totalCostUSD: point.costUSD,
      entryCount: point.entryCount,
      providerData: Object.entries(point.providerBreakdown).reduce((acc, [providerId, usage]) => ({
        ...acc,
        [providerId]: {
          tokens: usage.totalTokens,
          cost: usage.costUSD,
          color: PROVIDER_COLORS[providerId] || PROVIDER_COLORS.default,
        }
      }), {}),
    }));
  }

  /**
   * Get timeline analytics for a time window
   * @param timeWindowMs Time window in milliseconds
   * @returns Timeline analytics
   */
  getTimelineAnalytics(timeWindowMs: number): TimelineAnalytics {
    const dataPoints = this.getTimelineData(timeWindowMs);

    if (dataPoints.length === 0) {
      return {
        peakUsageTime: null,
        averageUsageRate: 0,
        growthRate: 0,
        prediction: null,
        trends: { direction: 'stable', strength: 0 },
      };
    }

    // Find peak usage time
    const peakPoint = dataPoints.reduce((max, point) =>
      point.totalTokens > max.totalTokens ? point : max
    , dataPoints[0]);

    // Calculate average usage rate (tokens per minute)
    const totalTokens = dataPoints.reduce((sum, point) => sum + point.totalTokens, 0);
    const timeSpanMs = dataPoints[dataPoints.length - 1].timestamp.getTime() -
                      dataPoints[0].timestamp.getTime();
    const timeSpanMinutes = timeSpanMs / (60 * 1000);
    const averageUsageRate = timeSpanMinutes > 0 ? totalTokens / timeSpanMinutes : 0;

    // Calculate growth rate (comparing first half to second half)
    const midpoint = Math.floor(dataPoints.length / 2);
    const firstHalfTokens = dataPoints.slice(0, midpoint).reduce((sum, point) => sum + point.totalTokens, 0);
    const secondHalfTokens = dataPoints.slice(midpoint).reduce((sum, point) => sum + point.totalTokens, 0);
    const growthRate = firstHalfTokens > 0 ? ((secondHalfTokens - firstHalfTokens) / firstHalfTokens) * 100 : 0;

    // Determine trend direction and strength
    let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';
    let strength = 0;

    if (Math.abs(growthRate) > 5) {
      direction = growthRate > 0 ? 'increasing' : 'decreasing';
      strength = Math.min(Math.abs(growthRate) / 100, 1);
    }

    // Simple prediction (extrapolate current trend)
    const prediction = this.config.enablePrediction ? {
      nextHourTokens: Math.round(averageUsageRate * 60),
      nextDayTokens: Math.round(averageUsageRate * 60 * 24),
      confidence: Math.max(0.1, 1 - (dataPoints.length / this.config.maxDataPoints)),
    } : null;

    return {
      peakUsageTime: peakPoint.timestamp,
      averageUsageRate,
      growthRate,
      prediction,
      trends: { direction, strength },
    };
  }

  /**
   * Apply filters to timeline data
   * @param timeWindowMs Time window in milliseconds
   * @param filter Filters to apply
   * @returns Filtered timeline data points
   */
  getFilteredTimelineData(timeWindowMs: number, filter: TimelineFilter): TimelineDataPoint[] {
    const dataPoints = this.getTimelineData(timeWindowMs);

    return dataPoints.filter(point => {
      // Provider filter
      if (filter.providers.length > 0) {
        const pointProviders = Object.keys(point.providerBreakdown);
        if (!pointProviders.some(provider => filter.providers.includes(provider))) {
          return false;
        }
      }

      // Model filter
      if (filter.models.length > 0) {
        const pointModels = Object.keys(point.modelBreakdown);
        if (!pointModels.some(model => filter.models.includes(model))) {
          return false;
        }
      }

      // Min tokens filter
      if (filter.minTokens && point.totalTokens < filter.minTokens) {
        return false;
      }

      // Max cost filter
      if (filter.maxCost && point.costUSD > filter.maxCost) {
        return false;
      }

      // Date range filter
      if (filter.startDate && point.timestamp < filter.startDate) {
        return false;
      }

      if (filter.endDate && point.timestamp > filter.endDate) {
        return false;
      }

      return true;
    });
  }

  /**
   * Update aggregator configuration
   * @param newConfig New configuration
   */
  updateConfig(newConfig: Partial<TimelineConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // Handle buffer resize if capacity changed
    if (newConfig.bufferSize && newConfig.bufferSize !== oldConfig.bufferSize) {
      this.buffer.resize(newConfig.bufferSize);
    }

    // Restart aggregation timer if interval changed
    if (newConfig.aggregationIntervalMs &&
        newConfig.aggregationIntervalMs !== oldConfig.aggregationIntervalMs) {
      this.startAggregationTimer();
    }

    this.emit('config-updated', {
      type: 'configuration-changed',
      timestamp: new Date(),
      metadata: { oldConfig, newConfig: this.config }
    });
  }

  /**
   * Start automatic aggregation timer
   */
  private startAggregationTimer(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }

    this.aggregationTimer = setInterval(() => {
      this.performCleanup();
    }, this.config.aggregationIntervalMs);
  }

  /**
   * Perform periodic cleanup of old data
   */
  private performCleanup(): void {
    this.buffer.cleanup();
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats() {
    return this.buffer.getMemoryStats();
  }

  /**
   * Get buffer statistics
   */
  getBufferStats() {
    return this.buffer.getStats();
  }

  /**
   * Clear all timeline data
   */
  clear(): void {
    this.buffer.clear();
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }
  }
}