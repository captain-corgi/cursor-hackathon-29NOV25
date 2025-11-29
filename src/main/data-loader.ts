import { NormalizedEntry } from '../shared/types';
import { providerRegistry } from './providers';

/**
 * Data Loader - orchestrates loading data from all providers
 */
export class DataLoader {
  private refreshCallback: (() => void) | null = null;

  /**
   * Load all data from enabled providers
   */
  async loadAllData(): Promise<NormalizedEntry[]> {
    const allEntries: NormalizedEntry[] = [];
    const providers = providerRegistry.getEnabledProviders();

    for (const provider of providers) {
      try {
        console.log(`Loading data from ${provider.name}...`);
        const entries = await provider.loadUsageData();
        console.log(`Loaded ${entries.length} entries from ${provider.name}`);
        allEntries.push(...entries);
      } catch (e) {
        console.error(`Failed to load data from ${provider.name}: ${e}`);
        // Continue with other providers
      }
    }

    // Sort by timestamp descending (most recent first)
    return allEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Load data for a specific provider
   */
  async loadDataByProvider(providerId: string): Promise<NormalizedEntry[]> {
    const provider = providerRegistry.getProvider(providerId);
    if (!provider) {
      console.error(`Provider not found: ${providerId}`);
      return [];
    }

    try {
      return await provider.loadUsageData();
    } catch (e) {
      console.error(`Failed to load data from ${provider.name}: ${e}`);
      return [];
    }
  }

  /**
   * Load data for a specific date
   */
  async loadDailyData(date: Date): Promise<NormalizedEntry[]> {
    const allData = await this.loadAllData();
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    return allData.filter(
      (entry) => entry.timestamp >= startOfDay && entry.timestamp < endOfDay
    );
  }

  /**
   * Load data for a date range
   */
  async loadDataForRange(startDate: Date, endDate: Date): Promise<NormalizedEntry[]> {
    const allData = await this.loadAllData();
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() + 1);

    return allData.filter(
      (entry) => entry.timestamp >= start && entry.timestamp < end
    );
  }

  /**
   * Load data for the current week
   */
  async loadWeeklyData(): Promise<NormalizedEntry[]> {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    return this.loadDataForRange(startOfWeek, now);
  }

  /**
   * Load data for the current month
   */
  async loadMonthlyData(): Promise<NormalizedEntry[]> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return this.loadDataForRange(startOfMonth, now);
  }

  /**
   * Start watching for file changes from all file-based providers
   */
  watchForChanges(callback: () => void): void {
    this.refreshCallback = callback;

    const providers = providerRegistry.getEnabledProviders();
    for (const provider of providers) {
      if (provider.watchForChanges) {
        provider.watchForChanges(() => {
          console.log(`Data changed in ${provider.name}`);
          this.refreshCallback?.();
        });
      }
    }
  }

  /**
   * Stop watching for changes
   */
  stopWatching(): void {
    providerRegistry.cleanup();
    this.refreshCallback = null;
  }
}

// Export singleton instance
export const dataLoader = new DataLoader();
