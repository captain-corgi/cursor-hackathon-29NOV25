// Timeline Manager - coordinates all timeline functionality

import { EventEmitter } from 'events';
import { NormalizedEntry } from '../../shared/types';
import {
  TimelineConfig,
  TimelineVisualization,
  TimelineAnalytics,
  TimelineFilter,
  TimelineExport,
  MemoryStats,
  TimelineDataPoint,
  AggregatedTimelinePoint,
  DEFAULT_TIMELINE_CONFIG,
  DEFAULT_TIMELINE_VISUALIZATION,
  TIME_WINDOWS
} from '../../shared/timeline-types';
import { TimelineAggregator } from './timeline-aggregator';
import { TimelineRenderer } from './timeline-renderer';

/**
 * Timeline Manager - coordinates all timeline functionality
 * Integrates aggregator, renderer, and provides high-level API
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

    // Initialize components
    this.aggregator = new TimelineAggregator(this.config);
    this.renderer = new TimelineRenderer(this.visualization);

    this.setupEventForwarding();
  }

  /**
   * Initialize timeline system
   */
  initialize(): void {
    this.aggregator.initialize();

    console.log('Timeline Manager initialized with config:', {
      bufferSize: this.config.bufferSize,
      resolutionMs: this.config.resolutionMs,
      maxRetentionMs: this.config.maxRetentionMs
    });
  }

  /**
   * Process raw usage entries and update timeline
   * @param entries Raw usage entries from providers
   */
  processEntries(entries: NormalizedEntry[]): void {
    if (!this.isEnabled || entries.length === 0) return;

    try {
      this.aggregator.processEntries(entries);
      console.log(`Processed ${entries.length} entries for timeline`);
    } catch (error) {
      console.error('Error processing entries for timeline:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get timeline data for visualization
   * @param timeWindowMs Time window in milliseconds
   * @param maxPoints Maximum data points to return
   * @returns Timeline data points
   */
  getTimelineData(timeWindowMs: number, maxPoints?: number): TimelineDataPoint[] {
    if (!this.isEnabled) return [];

    return this.aggregator.getTimelineData(timeWindowMs, maxPoints);
  }

  /**
   * Get aggregated timeline data optimized for UI rendering
   * @param timeWindowMs Time window in milliseconds
   * @param maxPoints Maximum data points
   * @returns Aggregated timeline points
   */
  getAggregatedTimelineData(timeWindowMs: number, maxPoints?: number): AggregatedTimelinePoint[] {
    if (!this.isEnabled) return [];

    return this.aggregator.getAggregatedTimelineData(timeWindowMs, maxPoints);
  }

  /**
   * Get timeline analytics for a time window
   * @param timeWindowMs Time window in milliseconds
   * @returns Timeline analytics
   */
  getTimelineAnalytics(timeWindowMs: number): TimelineAnalytics {
    if (!this.isEnabled) {
      return {
        peakUsageTime: null,
        averageUsageRate: 0,
        growthRate: 0,
        prediction: null,
        trends: { direction: 'stable', strength: 0 }
      };
    }

    return this.aggregator.getTimelineAnalytics(timeWindowMs);
  }

  /**
   * Get filtered timeline data
   * @param timeWindowMs Time window in milliseconds
   * @param filter Filter criteria
   * @returns Filtered timeline data points
   */
  getFilteredTimelineData(timeWindowMs: number, filter: TimelineFilter): TimelineDataPoint[] {
    if (!this.isEnabled) return [];

    return this.aggregator.getFilteredTimelineData(timeWindowMs, filter);
  }

  /**
   * Render micro timeline for system tray (16px constraint)
   * @param timeWindowMs Time window to render
   * @returns Buffer containing PNG image
   */
  renderMicroTimeline(timeWindowMs?: number): Buffer {
    if (!this.isEnabled) {
      // Return empty timeline
      return this.renderer.renderMicroTimeline([], timeWindowMs || TIME_WINDOWS.SIX_HOURS);
    }

    const window = timeWindowMs || this.config.timeWindowsMs[1]; // Default to 6 hours
    const dataPoints = this.getTimelineData(window, 50); // Limit points for micro rendering

    return this.renderer.renderMicroTimeline(dataPoints, window);
  }

  /**
   * Render full timeline for dashboard
   * @param width Canvas width
   * @param height Canvas height
   * @param timeWindowMs Time window to render
   * @param maxPoints Maximum data points to render
   * @returns Buffer containing PNG image
   */
  renderFullTimeline(
    width: number,
    height: number,
    timeWindowMs?: number,
    maxPoints?: number
  ): Buffer {
    if (!this.isEnabled) {
      return this.renderer.renderFullTimeline([], width, height);
    }

    const window = timeWindowMs || this.config.timeWindowsMs[1]; // Default to 6 hours
    const dataPoints = this.getAggregatedTimelineData(window, maxPoints);

    return this.renderer.renderFullTimeline(dataPoints, width, height);
  }

  /**
   * Export timeline data
   * @param exportOptions Export configuration
   * @returns Exported data as Buffer or JSON string
   */
  exportTimeline(exportOptions: TimelineExport): Buffer | string {
    const { format, timeWindowMs, includeBreakdown, resolution } = exportOptions;

    if (!this.isEnabled) {
      return format === 'json' ? '[]' : Buffer.alloc(0);
    }

    const dataPoints = this.getTimelineData(timeWindowMs, resolution);

    switch (format) {
      case 'json':
        return JSON.stringify(dataPoints, null, 2);

      case 'csv':
        return this.exportToCSV(dataPoints, includeBreakdown);

      case 'png':
        return this.renderFullTimeline(800, 400, timeWindowMs, resolution);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export timeline data to CSV format
   * @param dataPoints Timeline data points to export
   * @param includeBreakdown Whether to include model/provider breakdown
   * @returns CSV string
   */
  private exportToCSV(dataPoints: TimelineDataPoint[], includeBreakdown: boolean): string {
    const headers = [
      'timestamp',
      'durationMs',
      'inputTokens',
      'outputTokens',
      'cacheCreationTokens',
      'cacheReadTokens',
      'totalTokens',
      'costUSD',
      'entryCount'
    ];

    if (includeBreakdown) {
      headers.push('modelBreakdown', 'providerBreakdown');
    }

    const rows = [headers.join(',')];

    for (const point of dataPoints) {
      const baseData = [
        point.timestamp.toISOString(),
        point.durationMs,
        point.inputTokens,
        point.outputTokens,
        point.cacheCreationTokens,
        point.cacheReadTokens,
        point.totalTokens,
        point.costUSD,
        point.entryCount
      ];

      if (includeBreakdown) {
        baseData.push(
          JSON.stringify(point.modelBreakdown),
          JSON.stringify(point.providerBreakdown)
        );
      }

      rows.push(baseData.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Get memory usage statistics
   * @returns Memory statistics
   */
  getMemoryStats(): MemoryStats {
    return this.aggregator.getMemoryStats();
  }

  /**
   * Update timeline configuration
   * @param newConfig New configuration options
   */
  updateConfig(newConfig: Partial<TimelineConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.aggregator.updateConfig(newConfig);

    this.emit('config-updated', { config: this.config });
  }

  /**
   * Update visualization settings
   * @param newVisualization New visualization configuration
   */
  updateVisualization(newVisualization: Partial<TimelineVisualization>): void {
    this.visualization = { ...this.visualization, ...newVisualization };
    this.renderer.updateConfig(newVisualization);

    this.emit('visualization-updated', { visualization: this.visualization });
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
   * Get current configuration
   * @returns Current timeline configuration
   */
  getConfig(): TimelineConfig {
    return { ...this.config };
  }

  /**
   * Get current visualization settings
   * @returns Current visualization configuration
   */
  getVisualization(): TimelineVisualization {
    return { ...this.visualization };
  }

  /**
   * Get available time windows
   * @returns Array of available time windows
   */
  getAvailableTimeWindows(): Array<{ name: string; value: number; label: string }> {
    return [
      { name: 'ONE_HOUR', value: TIME_WINDOWS.ONE_HOUR, label: '1 Hour' },
      { name: 'SIX_HOURS', value: TIME_WINDOWS.SIX_HOURS, label: '6 Hours' },
      { name: 'ONE_DAY', value: TIME_WINDOWS.ONE_DAY, label: '1 Day' },
      { name: 'SEVEN_DAYS', value: TIME_WINDOWS.SEVEN_DAYS, label: '7 Days' },
      { name: 'THIRTY_DAYS', value: TIME_WINDOWS.THIRTY_DAYS, label: '30 Days' }
    ];
  }

  /**
   * Forward events from aggregator
   */
  private setupEventForwarding(): void {
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
   * Clear all timeline data
   */
  clear(): void {
    this.aggregator.clear();
    this.emit('timeline-cleared');
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.aggregator.cleanup();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const timelineManager = new TimelineManager();