import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';
import { AppSettings, DEFAULT_SETTINGS } from '../shared/types';

/**
 * Settings Manager - handles persistent settings storage
 */
export class SettingsManager {
  private settings: AppSettings;
  private configPath: string;

  constructor() {
    this.configPath = this.getConfigPath();
    this.settings = this.load();
  }

  /**
   * Get platform-appropriate config directory
   */
  private getConfigPath(): string {
    let configDir: string;

    if (process.platform === 'darwin') {
      // macOS: ~/Library/Application Support/AIUsageMonitor/
      configDir = path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'AIUsageMonitor'
      );
    } else {
      // Windows: %APPDATA%/AIUsageMonitor/
      configDir = path.join(
        process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
        'AIUsageMonitor'
      );
    }

    // Ensure directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    return path.join(configDir, 'settings.json');
  }

  /**
   * Load settings from disk
   */
  load(): AppSettings {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const loaded = JSON.parse(content) as Partial<AppSettings>;

        // Merge with defaults to handle new settings
        return { ...DEFAULT_SETTINGS, ...loaded };
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }

    return { ...DEFAULT_SETTINGS };
  }

  /**
   * Save settings to disk
   */
  save(): void {
    try {
      // Atomic write: write to temp file, then rename
      const tempPath = `${this.configPath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.settings, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.configPath);
      console.log('Settings saved');
    } catch (e) {
      console.error('Error saving settings:', e);
    }
  }

  /**
   * Get current settings
   */
  getSettings(): AppSettings {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  updateSettings(newSettings: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.save();
  }

  /**
   * Get a specific setting value
   */
  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settings[key];
  }

  /**
   * Set a specific setting value
   */
  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.settings[key] = value;
    this.save();
  }

  /**
   * Reset settings to defaults
   */
  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
  }

  /**
   * Get refresh interval in milliseconds
   */
  getRefreshIntervalMs(): number {
    return this.settings.refreshIntervalSeconds * 1000;
  }
}

// Export singleton instance
export const settingsManager = new SettingsManager();
