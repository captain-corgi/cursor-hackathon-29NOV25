import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AggregatedUsage, NormalizedEntry } from '../shared/types';

interface CacheData {
  lastUpdated: string;
  dailyUsage: AggregatedUsage | null;
  weeklyUsage: AggregatedUsage | null;
  monthlyUsage: AggregatedUsage | null;
  recentEntries: SerializedEntry[];
}

interface SerializedEntry extends Omit<NormalizedEntry, 'timestamp'> {
  timestamp: string;
}

/**
 * Cache Manager - handles data caching for fast startup
 */
export class CacheManager {
  private cachePath: string;
  private cache: CacheData | null = null;

  constructor() {
    this.cachePath = this.getCachePath();
    this.load();
  }

  /**
   * Get platform-appropriate cache directory
   */
  private getCachePath(): string {
    let cacheDir: string;

    if (process.platform === 'darwin') {
      // macOS: ~/Library/Caches/AIUsageMonitor/
      cacheDir = path.join(os.homedir(), 'Library', 'Caches', 'AIUsageMonitor');
    } else {
      // Windows: %LOCALAPPDATA%/AIUsageMonitor/Cache/
      cacheDir = path.join(
        process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
        'AIUsageMonitor',
        'Cache'
      );
    }

    // Ensure directory exists
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    return path.join(cacheDir, 'usage-cache.json');
  }

  /**
   * Load cache from disk
   */
  private load(): void {
    try {
      if (fs.existsSync(this.cachePath)) {
        const content = fs.readFileSync(this.cachePath, 'utf-8');
        this.cache = JSON.parse(content);
        console.log('Cache loaded from disk');
      }
    } catch (e) {
      console.error('Error loading cache:', e);
      this.cache = null;
    }
  }

  /**
   * Save cache to disk (atomic write)
   */
  save(): void {
    if (!this.cache) return;

    try {
      const tempPath = `${this.cachePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.cache), 'utf-8');
      fs.renameSync(tempPath, this.cachePath);
      console.log('Cache saved to disk');
    } catch (e) {
      console.error('Error saving cache:', e);
    }
  }

  /**
   * Update cached usage data
   */
  updateUsage(
    daily: AggregatedUsage | null,
    weekly: AggregatedUsage | null,
    monthly: AggregatedUsage | null,
    recentEntries: NormalizedEntry[]
  ): void {
    // Serialize entries (convert Date to string)
    const serialized: SerializedEntry[] = recentEntries.slice(0, 100).map((entry) => ({
      ...entry,
      timestamp: entry.timestamp.toISOString(),
    }));

    this.cache = {
      lastUpdated: new Date().toISOString(),
      dailyUsage: daily,
      weeklyUsage: weekly,
      monthlyUsage: monthly,
      recentEntries: serialized,
    };

    this.save();
  }

  /**
   * Get cached daily usage
   */
  getDailyUsage(): AggregatedUsage | null {
    return this.cache?.dailyUsage || null;
  }

  /**
   * Get cached weekly usage
   */
  getWeeklyUsage(): AggregatedUsage | null {
    return this.cache?.weeklyUsage || null;
  }

  /**
   * Get cached monthly usage
   */
  getMonthlyUsage(): AggregatedUsage | null {
    return this.cache?.monthlyUsage || null;
  }

  /**
   * Get cached recent entries
   */
  getRecentEntries(): NormalizedEntry[] {
    if (!this.cache?.recentEntries) return [];

    return this.cache.recentEntries.map((entry) => ({
      ...entry,
      timestamp: new Date(entry.timestamp),
    }));
  }

  /**
   * Get last updated timestamp
   */
  getLastUpdated(): Date | null {
    if (!this.cache?.lastUpdated) return null;
    return new Date(this.cache.lastUpdated);
  }

  /**
   * Check if cache is stale (older than maxAge milliseconds)
   */
  isStale(maxAgeMs: number): boolean {
    const lastUpdated = this.getLastUpdated();
    if (!lastUpdated) return true;

    const age = Date.now() - lastUpdated.getTime();
    return age > maxAgeMs;
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache = null;
    try {
      if (fs.existsSync(this.cachePath)) {
        fs.unlinkSync(this.cachePath);
        console.log('Cache cleared');
      }
    } catch (e) {
      console.error('Error clearing cache:', e);
    }
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();
