import { EventEmitter } from 'events';
import { NormalizedEntry, AggregatedUsage, AppSettings, AppStatus } from '../shared/types';
import { dataLoader } from './data-loader';
import { costCalculator } from './cost-calculator';
import { settingsManager } from './settings-manager';
import { cacheManager } from './cache-manager';
import { providerRegistry } from './providers';

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
    // Refresh data
    await this.refreshData();

    // Start auto-refresh timer
    this.startAutoRefresh();

    // Start file watching
    dataLoader.watchForChanges(() => {
      console.log('File change detected, refreshing...');
      this.refreshData();
    });
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

    // Recheck high usage if threshold changed
    this.checkHighUsage();

    // Emit settings changed event
    this.emit('settings-changed', settingsManager.getSettings());
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.stopAutoRefresh();
    dataLoader.stopWatching();
    providerRegistry.cleanup();
  }
}

// Export singleton instance
export const appStateManager = new AppStateManager();
