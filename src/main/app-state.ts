import { EventEmitter } from 'events';
import { NormalizedEntry, AggregatedUsage, AppSettings, AppStatus, MenuBarStats, ProviderStats } from '../shared/types';
import { dataLoader } from './data-loader';
import { costCalculator } from './cost-calculator';
import { settingsManager } from './settings-manager';
import { cacheManager } from './cache-manager';
import { providerRegistry } from './providers';
import { timelineManager } from './timeline';

interface AppStateData {
  entries: NormalizedEntry[];
  dailyUsage: AggregatedUsage | null;
  weeklyUsage: AggregatedUsage | null;
  monthlyUsage: AggregatedUsage | null;
  status: AppStatus;
  isHighUsage: boolean;
  lastUpdated: Date | null;
  error: string | null;
}

/**
 * App State Manager - centralized state management
 */
export class AppStateManager extends EventEmitter {
  private state: AppStateData;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();

    // Initialize with empty state
    this.state = {
      entries: [],
      dailyUsage: null,
      weeklyUsage: null,
      monthlyUsage: null,
      status: AppStatus.Loading,
      isHighUsage: false,
      lastUpdated: null,
      error: null,
    };

    // Load cached data for fast startup
    this.loadFromCache();

    // Apply settings to provider registry
    const settings = settingsManager.getSettings();
    providerRegistry.setEnabledProviders(settings.enabledProviders);
  }

  /**
   * Load initial data from cache
   */
  private loadFromCache(): void {
    const lastUpdated = cacheManager.getLastUpdated();

    if (lastUpdated) {
      this.state = {
        ...this.state,
        dailyUsage: cacheManager.getDailyUsage(),
        weeklyUsage: cacheManager.getWeeklyUsage(),
        monthlyUsage: cacheManager.getMonthlyUsage(),
        entries: cacheManager.getRecentEntries(),
        lastUpdated,
        status: cacheManager.isStale(5 * 60 * 1000)
          ? AppStatus.Stale
          : AppStatus.Success,
      };

      this.checkHighUsage();
      console.log('Loaded state from cache');
    }
  }

  /**
   * Initialize - start data loading and refresh timer
   */
  async initialize(): Promise<void> {
    // Initialize timeline manager
    timelineManager.initialize();

    // Refresh data
    await this.refreshData();

    // Start auto-refresh timer
    this.startAutoRefresh();

    // Start file watching
    dataLoader.watchForChanges(() => {
      console.log('File change detected, refreshing...');
      this.refreshData();
    });

    // Forward timeline events
    this.setupTimelineEventForwarding();
  }

  /**
   * Refresh all data from providers
   */
  async refreshData(): Promise<void> {
    try {
      this.state.status = AppStatus.Loading;
      this.emit('status-changed', this.state.status);

      // Load data
      const [daily, weekly, monthly] = await Promise.all([
        dataLoader.loadDailyData(new Date()),
        dataLoader.loadWeeklyData(),
        dataLoader.loadMonthlyData(),
      ]);

      // Calculate aggregations
      const dailyUsage = costCalculator.aggregateCosts(daily);
      const weeklyUsage = costCalculator.aggregateCosts(weekly);
      const monthlyUsage = costCalculator.aggregateCosts(monthly);

      // Process timeline data
      timelineManager.processEntries(daily);

      // Update state
      this.state = {
        ...this.state,
        entries: daily,
        dailyUsage,
        weeklyUsage,
        monthlyUsage,
        status: AppStatus.Success,
        lastUpdated: new Date(),
        error: null,
      };

      // Check high usage
      this.checkHighUsage();

      // Update cache
      cacheManager.updateUsage(dailyUsage, weeklyUsage, monthlyUsage, daily);

      // Emit events
      this.emit('state-changed', this.getState());

      console.log(
        `Data refreshed: ${daily.length} daily entries, $${dailyUsage.totalCostUSD.toFixed(2)} today`
      );
    } catch (e) {
      console.error('Error refreshing data:', e);
      this.state.status = AppStatus.Error;
      this.state.error = e instanceof Error ? e.message : 'Unknown error';
      this.emit('error', this.state.error);
    }
  }

  /**
   * Check if usage exceeds threshold
   */
  private checkHighUsage(): void {
    const settings = settingsManager.getSettings();

    if (!settings.usageAlertEnabled || !this.state.dailyUsage) {
      this.state.isHighUsage = false;
      return;
    }

    const wasHighUsage = this.state.isHighUsage;
    this.state.isHighUsage =
      this.state.dailyUsage.totalCostUSD > settings.usageAlertThreshold;

    // Emit alert if just crossed threshold
    if (this.state.isHighUsage && !wasHighUsage) {
      this.emit('high-usage-alert', this.state.dailyUsage.totalCostUSD);
    }
  }

  /**
   * Start auto-refresh timer
   */
  startAutoRefresh(): void {
    this.stopAutoRefresh();

    const intervalMs = settingsManager.getRefreshIntervalMs();
    this.refreshTimer = setInterval(() => {
      this.refreshData();
    }, intervalMs);

    console.log(`Auto-refresh started: every ${intervalMs / 1000}s`);
  }

  /**
   * Stop auto-refresh timer
   */
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Get current state
   */
  getState(): AppStateData {
    return { ...this.state };
  }

  /**
   * Get daily usage
   */
  getDailyUsage(): AggregatedUsage | null {
    return this.state.dailyUsage;
  }

  /**
   * Get weekly usage
   */
  getWeeklyUsage(): AggregatedUsage | null {
    return this.state.weeklyUsage;
  }

  /**
   * Get monthly usage
   */
  getMonthlyUsage(): AggregatedUsage | null {
    return this.state.monthlyUsage;
  }

  /**
   * Get recent entries
   */
  getEntries(): NormalizedEntry[] {
    return [...this.state.entries];
  }

  /**
   * Get current status
   */
  getStatus(): AppStatus {
    return this.state.status;
  }

  /**
   * Is high usage alert active?
   */
  isHighUsage(): boolean {
    return this.state.isHighUsage;
  }

  /**
   * Get last updated time
   */
  getLastUpdated(): Date | null {
    return this.state.lastUpdated;
  }

  /**
   * Get tooltip text for tray
   */
  getTooltipText(): string {
    const settings = settingsManager.getSettings();
    const daily = this.state.dailyUsage;

    if (!daily) {
      return 'AI Usage Monitor\nLoading...';
    }

    if (settings.displayFormat === 'tokens') {
      return `AI Usage Monitor\nToday: ${daily.totalTokens.toLocaleString()} tokens\n${daily.entryCount} requests`;
    }

    return `AI Usage Monitor\nToday: $${daily.totalCostUSD.toFixed(2)}\n${daily.totalTokens.toLocaleString()} tokens`;
  }

  /**
   * Get menu bar stats from current state
   * Converts aggregated usage data to MenuBarStats format for tray display
   */
  getMenuBarStats(): MenuBarStats {
    const monthly = this.state.monthlyUsage;

    if (!monthly) {
      return {
        providers: [],
        isMockData: false,
        lastUpdated: this.state.lastUpdated,
      };
    }

    // Get billing period (current month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const formatDate = (d: Date) =>
      `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
    const billingPeriod = `${formatDate(startOfMonth)} - ${formatDate(endOfMonth)}`;

    // Convert provider breakdown to ProviderStats format
    const providers: ProviderStats[] = [];

    // Process each provider from the breakdown
    Object.values(monthly.providerBreakdown).forEach((providerUsage) => {
      const { providerName, entryCount, costUSD, totalTokens, providerId } = providerUsage;

      // Determine plan type based on provider
      let plan = 'Unknown';

      if (providerId === 'cursor') {
        plan = 'Pro';
      } else if (providerId === 'claude-code') {
        plan = 'Pay-As-You-Go';
      } else {
        plan = 'Standard';
      }

      // Format balance to show cost and tokens (matching dashboard display)
      const balance = `$${costUSD.toFixed(2)} (${totalTokens.toLocaleString()} tokens)`;
      const requestUsed = `${entryCount} requests`;

      providers.push({
        name: providerName,
        balance,
        requestUsed,
        plan,
        billingPeriod,
        isActive: true,
      });
    });

    // If no providers in breakdown, show a summary entry
    if (providers.length === 0 && monthly.entryCount > 0) {
      providers.push({
        name: 'All Providers',
        balance: `$${monthly.totalCostUSD.toFixed(2)} spent`,
        requestUsed: `${monthly.entryCount} requests`,
        plan: 'Mixed',
        billingPeriod,
        isActive: true,
      });
    }

    return {
      providers,
      isMockData: false,
      lastUpdated: this.state.lastUpdated,
    };
  }

  /**
   * Update settings and apply changes
   */
  updateSettings(newSettings: Partial<AppSettings>): void {
    settingsManager.updateSettings(newSettings);

    // Apply provider changes
    if (newSettings.enabledProviders) {
      providerRegistry.setEnabledProviders(newSettings.enabledProviders);
    }

    // Restart auto-refresh if interval changed
    if (newSettings.refreshIntervalSeconds) {
      this.startAutoRefresh();
    }

    // Update timeline settings
    if (newSettings.timelineEnabled !== undefined) {
      timelineManager.setEnabled(newSettings.timelineEnabled);
    }

    if (newSettings.timelineTimeWindow) {
      timelineManager.updateConfig({
        timeWindowsMs: [newSettings.timelineTimeWindow, ...timelineManager.getConfig().timeWindowsMs.slice(1)]
      });
    }

    if (newSettings.timelineVisualizationMode) {
      timelineManager.updateVisualization({
        mode: newSettings.timelineVisualizationMode
      });
    }

    if (newSettings.timelineProviderColors) {
      // Provider colors are handled at the renderer level
      console.log('Provider colors updated:', newSettings.timelineProviderColors);
    }

    // Recheck high usage if threshold changed
    this.checkHighUsage();

    // Emit settings changed event
    this.emit('settings-changed', settingsManager.getSettings());
  }

  /**
   * Get timeline data for a specific time window
   * @param timeWindowMs Time window in milliseconds
   * @param maxPoints Maximum data points to return
   * @returns Timeline data points
   */
  getTimelineData(timeWindowMs: number, maxPoints?: number) {
    return timelineManager.getTimelineData(timeWindowMs, maxPoints);
  }

  /**
   * Get aggregated timeline data for UI rendering
   * @param timeWindowMs Time window in milliseconds
   * @param maxPoints Maximum data points
   * @returns Aggregated timeline points
   */
  getAggregatedTimelineData(timeWindowMs: number, maxPoints?: number) {
    return timelineManager.getAggregatedTimelineData(timeWindowMs, maxPoints);
  }

  /**
   * Get timeline analytics for a time window
   * @param timeWindowMs Time window in milliseconds
   * @returns Timeline analytics
   */
  getTimelineAnalytics(timeWindowMs: number) {
    return timelineManager.getTimelineAnalytics(timeWindowMs);
  }

  /**
   * Get memory statistics for timeline
   * @returns Memory statistics
   */
  getTimelineMemoryStats() {
    return timelineManager.getMemoryStats();
  }

  /**
   * Render micro timeline for system tray
   * @param timeWindowMs Time window to render
   * @returns Buffer containing PNG image
   */
  renderTimelineForTray(timeWindowMs?: number) {
    return timelineManager.renderMicroTimeline(timeWindowMs);
  }

  /**
   * Export timeline data
   * @param exportOptions Export configuration
   * @returns Exported data as Buffer or JSON string
   */
  exportTimeline(exportOptions: any) {
    return timelineManager.exportTimeline(exportOptions);
  }

  /**
   * Setup timeline event forwarding
   */
  private setupTimelineEventForwarding(): void {
    // Forward timeline update events to renderer
    timelineManager.on('timeline-updated', (event) => {
      this.broadcast('timeline-updated', event);
    });

    timelineManager.on('timeline-cleared', () => {
      this.broadcast('timeline-cleared', {});
    });

    timelineManager.on('buffer-overflow', (event) => {
      console.warn('Timeline buffer overflow:', event);
      this.broadcast('timeline-buffer-overflow', event);
    });
  }

  /**
   * Broadcast message to all renderer windows
   * @param channel Channel name
   * @param data Data to send
   */
  private broadcast(channel: string, data: any): void {
    // This would be used by IPC handler to broadcast to windows
    // For now, just emit the event
    this.emit('broadcast', { channel, data });
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.stopAutoRefresh();
    dataLoader.stopWatching();
    providerRegistry.cleanup();
    timelineManager.cleanup();
  }
}

// Export singleton instance
export const appStateManager = new AppStateManager();
