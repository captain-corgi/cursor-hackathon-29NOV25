import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Auto Launch Manager - handles launch at login functionality
 */
export class AutoLaunchManager {
  private appName: string;
  private appPath: string;

  constructor() {
    this.appName = 'AIUsageMonitor';
    this.appPath = app.getPath('exe');
  }

  /**
   * Check if auto-launch is currently enabled
   */
  async isEnabled(): Promise<boolean> {
    if (process.platform === 'darwin') {
      return this.isEnabledMac();
    } else if (process.platform === 'win32') {
      return this.isEnabledWindows();
    }
    return false;
  }

  /**
   * Enable auto-launch at login
   */
  async enable(): Promise<boolean> {
    try {
      if (process.platform === 'darwin') {
        return this.enableMac();
      } else if (process.platform === 'win32') {
        return this.enableWindows();
      }
      return false;
    } catch (e) {
      console.error('Error enabling auto-launch:', e);
      return false;
    }
  }

  /**
   * Disable auto-launch at login
   */
  async disable(): Promise<boolean> {
    try {
      if (process.platform === 'darwin') {
        return this.disableMac();
      } else if (process.platform === 'win32') {
        return this.disableWindows();
      }
      return false;
    } catch (e) {
      console.error('Error disabling auto-launch:', e);
      return false;
    }
  }

  // ============ macOS Implementation ============

  private getMacPlistPath(): string {
    return path.join(
      os.homedir(),
      'Library',
      'LaunchAgents',
      `com.${this.appName.toLowerCase()}.plist`
    );
  }

  private isEnabledMac(): boolean {
    return fs.existsSync(this.getMacPlistPath());
  }

  private enableMac(): boolean {
    const plistPath = this.getMacPlistPath();
    const plistDir = path.dirname(plistPath);

    // Ensure LaunchAgents directory exists
    if (!fs.existsSync(plistDir)) {
      fs.mkdirSync(plistDir, { recursive: true });
    }

    // Create plist content
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.${this.appName.toLowerCase()}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${this.appPath}</string>
        <string>--hidden</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>`;

    fs.writeFileSync(plistPath, plistContent, 'utf-8');
    console.log('macOS auto-launch enabled');
    return true;
  }

  private disableMac(): boolean {
    const plistPath = this.getMacPlistPath();
    if (fs.existsSync(plistPath)) {
      fs.unlinkSync(plistPath);
      console.log('macOS auto-launch disabled');
    }
    return true;
  }

  // ============ Windows Implementation ============

  private getWindowsStartupPath(): string {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'Microsoft',
      'Windows',
      'Start Menu',
      'Programs',
      'Startup',
      `${this.appName}.lnk`
    );
  }

  private isEnabledWindows(): boolean {
    // Check startup folder
    const startupPath = this.getWindowsStartupPath();
    if (fs.existsSync(startupPath)) {
      return true;
    }

    // Also check registry (more reliable)
    // Using Electron's built-in login item settings
    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
  }

  private enableWindows(): boolean {
    // Use Electron's built-in API for Windows
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true,
      args: ['--hidden'],
    });

    console.log('Windows auto-launch enabled');
    return true;
  }

  private disableWindows(): boolean {
    app.setLoginItemSettings({
      openAtLogin: false,
    });

    // Also remove shortcut from startup folder if it exists
    const startupPath = this.getWindowsStartupPath();
    if (fs.existsSync(startupPath)) {
      try {
        fs.unlinkSync(startupPath);
      } catch (e) {
        console.warn('Could not remove startup shortcut:', e);
      }
    }

    console.log('Windows auto-launch disabled');
    return true;
  }

  /**
   * Set auto-launch state
   */
  async setEnabled(enabled: boolean): Promise<boolean> {
    if (enabled) {
      return this.enable();
    } else {
      return this.disable();
    }
  }
}

// Export singleton instance
export const autoLaunchManager = new AutoLaunchManager();
