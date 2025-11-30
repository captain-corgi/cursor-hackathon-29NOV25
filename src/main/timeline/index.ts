// Timeline module exports and manager

export { CircularBuffer } from './circular-buffer';
export { TimelineAggregator } from './timeline-aggregator';
export { TimelineRenderer } from './timeline-renderer';

import { EventEmitter } from 'events';
import { NormalizedEntry } from '../../shared/types';
import {
  TimelineConfig,
  TimelineVisualization,
  TimelineDataPoint,
  AggregatedTimelinePoint,
  TimelineAnalytics,
  TimelineFilter,
  TimelineExport,
  MemoryStats,
  TimelineUpdateEvent,
  DEFAULT_TIMELINE_CONFIG,
  DEFAULT_TIMELINE_VISUALIZATION,
  TIME_WINDOWS
} from '../../shared/timeline-types';
import { TimelineAggregator } from './timeline-aggregator';
import { TimelineRenderer } from './timeline-renderer';

/**
 * Unified Timeline Manager that coordinates all timeline functionality
 * Provides a single interface for timeline data management and visualization
 */
export class TimelineManager extends EventEmitter {
  private aggregator: TimelineAggregator;
  private renderer: TimelineRenderer;
  private config: TimelineConfig;
  private visualization: TimelineVisualization;
  private isEnabled: boolean = true;

  constructor(config?: Partial<TimelineConfig>, visualization?: Partial<TimelineVisualization>) {
    super();

    this.config = { ...DEFAULT_TIMELINE_CONFIG, ...config };
    this.visualization = { ...DEFAULT_TIMELINE_VISUALIZATION, ...visualization };

    this.aggregator = new TimelineAggregator(this.config);
    this.renderer = new TimelineRenderer(this.visualization);

    // Forward aggregator events
    this.aggregator.on('timeline-updated', (event) => {
      this.emit('timeline-updated', event);
    });

    this.aggregator.on('buffer-overflow', (event) => {
      this.emit('buffer-overflow', event);
    });

    this.aggregator.on('config-updated', (event) => {
      this.emit('config-updated', event);
    });
  }

  /**
   * Initialize the timeline system
   */
  async initialize(): Promise<void> {
    this.aggregator.initialize();
  }

  /**
   * Process raw usage entries and add to timeline
   * @param entries Raw usage entries to process
   */
  processEntries(entries: NormalizedEntry[]): void {
    if (!this.isEnabled || entries.length === 0) return;

    try {
      this.aggregator.processEntries(entries);
    } catch (error) {
      console.error('Error processing entries for timeline:', error);
      this.emit('error', error);
    }
  }

  /**
   * Enable or disable timeline functionality
   * @param enabled Whether timeline should be enabled
   */
  setEnabled(enabled: boolean): void {
    if (this.isEnabled !== enabled) {
      this.isEnabled = enabled;

      if (!enabled) {
        // Clear timeline data when disabled
        this.aggregator.clear();
      }

      this.emit('enabled-changed', enabled);
    }
  }

  /**
   * Check if timeline is enabled
   * @returns True if timeline is enabled
   */
  isTimelineEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Render timeline visualization for system tray (16px constraint)
   * @param timeWindowMs Time window to visualize
   * @returns Buffer containing PNG image data
   */
  renderMicroTimeline(timeWindowMs?: number): Buffer {
    if (!this.isEnabled) {
      return this.renderer.renderMicroTimeline([], timeWindowMs || TIME_WINDOWS.SIX_HOURS);
    }

    try {
      const window = timeWindowMs || TIME_WINDOWS.SIX_HOURS;
      const dataPoints = this.getTimelineData(window, 50); // Limit to 50 points for micro view
      return this.renderer.renderMicroTimeline(dataPoints, window);
    } catch (error) {
      console.error('Error rendering micro timeline:', error);
      return this.renderer.renderMicroTimeline([], timeWindowMs || TIME_WINDOWS.SIX_HOURS);
    }
  }

  /**
   * Get timeline data for a specific time window
   * @param timeWindowMs Time window in milliseconds
   * @param maxPoints Maximum data points to return
   * @returns Timeline data points
   */
  getTimelineData(timeWindowMs: number, maxPoints?: number): TimelineDataPoint[] {
    return this.aggregator.getTimelineData(timeWindowMs, maxPoints);
  }

  /**
   * Get aggregated timeline data optimized for visualization
   * @param timeWindowMs Time window in milliseconds
   * @param maxPoints Maximum data points
   * @returns Aggregated timeline points
   */
  getAggregatedTimelineData(timeWindowMs: number, maxPoints?: number): AggregatedTimelinePoint[] {
    return this.aggregator.getAggregatedTimelineData(timeWindowMs, maxPoints);
  }

  /**
   * Get timeline analytics for a time window
   * @param timeWindowMs Time window in milliseconds
   * @returns Timeline analytics
   */
  getTimelineAnalytics(timeWindowMs: number): TimelineAnalytics {
    return this.aggregator.getTimelineAnalytics(timeWindowMs);
  }

  /**
   * Get filtered timeline data
   * @param timeWindowMs Time window in milliseconds
   * @param filter Filters to apply
   * @returns Filtered timeline data points
   */
  getFilteredTimelineData(timeWindowMs: number, filter: TimelineFilter): TimelineDataPoint[] {
    return this.aggregator.getFilteredTimelineData(timeWindowMs, filter);
  }

  
  /**
   * Render full timeline for dashboard display
   * @param timeWindowMs Time window to visualize
   * @param width Canvas width
   * @param height Canvas height
   * @returns Buffer containing PNG image data
   */
  renderFullTimeline(timeWindowMs: number, width: number, height: number): Buffer {
    const dataPoints = this.getAggregatedTimelineData(timeWindowMs, 200); // Limit to 200 points for full view
    return this.renderer.renderFullTimeline(dataPoints, width, height);
  }

  /**
   * Export timeline data in various formats
   * @param exportConfig Export configuration
   * @returns Exported data or image buffer
   */
  async exportTimeline(exportConfig: TimelineExport): Promise<Buffer | string> {
    const dataPoints = this.getTimelineData(
      exportConfig.timeWindowMs,
      exportConfig.resolution
    );

    switch (exportConfig.format) {
      case 'png':
        return this.renderer.renderFullTimeline(
          this.getAggregatedTimelineData(exportConfig.timeWindowMs, exportConfig.resolution),
          800, // Default export width
          400  // Default export height
        );

      case 'csv':
        return this.exportToCSV(dataPoints, exportConfig.includeBreakdown);

      case 'json':
        return this.exportToJSON(dataPoints, exportConfig.includeBreakdown);

      default:
        throw new Error(`Unsupported export format: ${exportConfig.format}`);
    }
  }

  /**
   * Export timeline data to CSV format
   */
  private exportToCSV(dataPoints: TimelineDataPoint[], includeBreakdown: boolean): string {
    const headers = [
      'timestamp',
      'durationMs',
      'totalTokens',
      'inputTokens',
      'outputTokens',
      'cacheCreationTokens',
      'cacheReadTokens',
      'costUSD',
      'entryCount'
    ];

    if (includeBreakdown) {
      headers.push('modelBreakdown', 'providerBreakdown');
    }

    const rows = dataPoints.map(point => {
      const row = [
        point.timestamp.toISOString(),
        point.durationMs.toString(),
        point.totalTokens.toString(),
        point.inputTokens.toString(),
        point.outputTokens.toString(),
        point.cacheCreationTokens.toString(),
        point.cacheReadTokens.toString(),
        point.costUSD.toFixed(6),
        point.entryCount.toString()
      ];

      if (includeBreakdown) {
        row.push(JSON.stringify(point.modelBreakdown));
        row.push(JSON.stringify(point.providerBreakdown));
      }

      return row.join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Export timeline data to JSON format
   */
  private exportToJSON(dataPoints: TimelineDataPoint[], includeBreakdown: boolean): string {
    const exportData = {
      exportedAt: new Date().toISOString(),
      dataPoints: dataPoints.map(point => {
        const baseData = {
          timestamp: point.timestamp.toISOString(),
          durationMs: point.durationMs,
          totalTokens: point.totalTokens,
          inputTokens: point.inputTokens,
          outputTokens: point.outputTokens,
          cacheCreationTokens: point.cacheCreationTokens,
          cacheReadTokens: point.cacheReadTokens,
          costUSD: point.costUSD,
          entryCount: point.entryCount,
        };

        if (includeBreakdown) {
          return {
            ...baseData,
            modelBreakdown: point.modelBreakdown,
            providerBreakdown: point.providerBreakdown,
          };
        }

        return baseData;
      })
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Update timeline configuration
   * @param newConfig New configuration
   */
  updateConfig(newConfig: Partial<TimelineConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.aggregator.updateConfig(newConfig);
  }

  /**
   * Update visualization configuration
   * @param newVisualization New visualization configuration
   */
  updateVisualization(newVisualization: Partial<TimelineVisualization>): void {
    this.visualization = { ...this.visualization, ...newVisualization };
    this.renderer.updateConfig(this.visualization);
  }

  /**
   * Get current configuration
   */
  getConfig(): TimelineConfig {
    return { ...this.config };
  }

  /**
   * Get current visualization configuration
   */
  getVisualization(): TimelineVisualization {
    return { ...this.visualization };
  }

  /**
   * Get memory statistics
   */
  getMemoryStats(): MemoryStats {
    return this.aggregator.getMemoryStats();
  }

  /**
   * Get buffer statistics
   */
  getBufferStats() {
    return this.aggregator.getBufferStats();
  }

  /**
   * Get available time windows
   */
  getTimeWindows(): Record<string, number> {
    return {
      '1h': TIME_WINDOWS.ONE_HOUR,
      '6h': TIME_WINDOWS.SIX_HOURS,
      '24h': TIME_WINDOWS.ONE_DAY,
      '7d': TIME_WINDOWS.SEVEN_DAYS,
      '30d': TIME_WINDOWS.THIRTY_DAYS,
    };
  }

  /**
   * Clear all timeline data
   */
  clear(): void {
    this.aggregator.clear();
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.aggregator.cleanup();
  }

  /**
   * Get timeline health status
   */
  getHealthStatus(): {
    isHealthy: boolean;
    bufferUsage: number;
    oldestDataAge: number | null;
    recentDataPoints: number;
  } {
    const bufferStats = this.getBufferStats();
    const memoryStats = this.getMemoryStats();
    const recentData = this.getTimelineData(TIME_WINDOWS.ONE_HOUR);

    const oldestDataAge = memoryStats.oldestDataPoint
      ? Date.now() - memoryStats.oldestDataPoint.getTime()
      : null;

    return {
      isHealthy: bufferStats.usagePercent < 90 && recentData.length > 0,
      bufferUsage: bufferStats.usagePercent,
      oldestDataAge,
      recentDataPoints: recentData.length,
    };
  }

  /**
   * Get summary statistics for all time windows
   */
  getAllTimeWindowStats(): Record<string, {
    dataPoints: number;
    totalTokens: number;
    totalCost: number;
    entryCount: number;
  }> {
    const timeWindows = this.getTimeWindows();
    const stats: Record<string, any> = {};

    Object.entries(timeWindows).forEach(([name, timeWindowMs]) => {
      const dataPoints = this.getTimelineData(timeWindowMs);

      if (dataPoints.length > 0) {
        const totals = dataPoints.reduce(
          (acc, point) => ({
            totalTokens: acc.totalTokens + point.totalTokens,
            totalCost: acc.totalCost + point.costUSD,
            entryCount: acc.entryCount + point.entryCount,
          }),
          { totalTokens: 0, totalCost: 0, entryCount: 0 }
        );

        stats[name] = {
          dataPoints: dataPoints.length,
          totalTokens: totals.totalTokens,
          totalCost: totals.totalCost,
          entryCount: totals.entryCount,
        };
      } else {
        stats[name] = {
          dataPoints: 0,
          totalTokens: 0,
          totalCost: 0,
          entryCount: 0,
        };
      }
    });

    return stats;
  }
}

/**
 * Create and configure a timeline manager instance
 * @param config Timeline configuration
 * @param visualization Visualization configuration
 * @returns Configured timeline manager
 */
export function createTimelineManager(
  config?: Partial<TimelineConfig>,
  visualization?: Partial<TimelineVisualization>
): TimelineManager {
  return new TimelineManager(config, visualization);
}

// Export time windows for easy access
export { TIME_WINDOWS };

// Export default timeline manager instance
export const timelineManager = new TimelineManager();