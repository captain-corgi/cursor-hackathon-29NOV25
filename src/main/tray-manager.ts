import { Tray, Menu, nativeImage, MenuItemConstructorOptions, app } from 'electron';
import path from 'path';
import { ProviderStats, MenuBarStats } from '../shared/types';
import { appStateManager } from './app-state';

// Helper to get assets path for both dev and production
function getAssetPath(assetName: string): string {
  if (app.isPackaged) {
    // In production, assets are in Resources/assets via extraResources
    return path.join(process.resourcesPath, 'assets', assetName);
  } else {
    // In development, __dirname is dist/main/main/, go up 3 levels to project root
    return path.join(__dirname, '../../../assets', assetName);
  }
}

export interface TrayManagerCallbacks {
  onOpenApp: () => void;
  onRefresh: () => void;
  onQuit: () => void;
}

export class TrayManager {
  private tray: Tray | null = null;
  private callbacks: TrayManagerCallbacks;
  private isAlertState: boolean = false;
  private currentStats: MenuBarStats;
  private useTimelineTray: boolean = true;
  private trayUpdateTimer: NodeJS.Timeout | null = null;

  constructor(callbacks: TrayManagerCallbacks) {
    this.callbacks = callbacks;
    // Initialize with empty data - real data will be loaded via updateStats()
    this.currentStats = {
      providers: [],
      isMockData: false,
      lastUpdated: null,
    };
    this.initialize();
    this.startTimelineUpdates();
  }

  private initialize(): void {
    // Create tray icon
    const icon = this.createIcon();
    this.tray = new Tray(icon);

    // Set initial tooltip
    this.updateTooltip('AI Tool Stats');

    // Build context menu with stats
    this.updateContextMenu();

    // Click opens menu (default behavior on macOS)
    // Double-click opens app
    this.tray.on('double-click', () => {
      this.callbacks.onOpenApp();
    });
  }

  private createIcon(): Electron.NativeImage {
    try {
      // Try to create timeline icon first
      if (this.useTimelineTray) {
        return this.createTimelineIcon();
      }

      // Load the PNG tray icon as fallback
      const iconPath = getAssetPath('tray-icon.png');
      console.log('Loading tray icon from:', iconPath);
      const icon = nativeImage.createFromPath(iconPath);
      console.log('Tray icon loaded, size:', icon.getSize());

      // Check if icon loaded successfully (not empty)
      if (icon.isEmpty()) {
        console.warn('Tray icon is empty, using fallback');
        throw new Error('Icon is empty');
      }

      // Resize for platform-specific requirements
      const size = process.platform === 'darwin' ? 22 : 16;
      if (icon.getSize().width !== size || icon.getSize().height !== size) {
        return icon.resize({ width: size, height: size });
      }

      return icon;
    } catch (error) {
      console.warn('Failed to load tray icon, using fallback:', error);
      // Create a simple colored icon as fallback
      const size = process.platform === 'darwin' ? 22 : 16;
      const canvas = this.createSimpleIcon(size);
      return nativeImage.createFromDataURL(canvas);
    }
  }

  /**
   * Create timeline-based tray icon
   */
  private createTimelineIcon(): Electron.NativeImage {
    try {
      const size = process.platform === 'darwin' ? 22 : 16;
      const timelineBuffer = appStateManager.renderTimelineForTray(6 * 60 * 60 * 1000); // 6 hours
      const icon = nativeImage.createFromBuffer(timelineBuffer);

      if (!icon.isEmpty()) {
        return icon.resize({ width: size, height: size });
      }

      throw new Error('Timeline icon is empty');
    } catch (error) {
      console.warn('Failed to create timeline icon, using simple icon:', error);
      const size = process.platform === 'darwin' ? 22 : 16;
      const canvas = this.createSimpleIcon(size);
      return nativeImage.createFromDataURL(canvas);
    }
  }

  private createSimpleIcon(size: number): string {
    // Create a simple SVG icon and convert to data URL
    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 1}" fill="${this.isAlertState ? '#ef4444' : '#6366f1'}" />
        <text x="${size/2}" y="${size/2 + 1}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="${size * 0.5}" font-family="Arial" font-weight="bold">$</text>
      </svg>
    `;
    
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  public updateTooltip(text: string): void {
    this.tray?.setToolTip(text);
  }

  public setAlertState(isAlert: boolean): void {
    this.isAlertState = isAlert;
    this.updateTrayIcon();
  }

  /**
   * Update tray icon with current state
   */
  private updateTrayIcon(): void {
    try {
      let icon: Electron.NativeImage;

      if (this.useTimelineTray && !this.isAlertState) {
        // Use timeline icon for normal state
        icon = this.createTimelineIcon();
      } else {
        // Use static icon for alert state or fallback
        const iconName = this.isAlertState ? 'tray-icon-alert.png' : 'tray-icon.png';
        const iconPath = getAssetPath(iconName);
        console.log('Loading tray icon from:', iconPath);
        icon = nativeImage.createFromPath(iconPath);

        if (icon.isEmpty()) {
          throw new Error('Icon is empty');
        }
      }

      // Resize for platform-specific requirements
      const size = process.platform === 'darwin' ? 22 : 16;
      if (icon.getSize().width !== size || icon.getSize().height !== size) {
        icon = icon.resize({ width: size, height: size });
      }

      this.tray?.setImage(icon);
    } catch (error) {
      console.warn('Failed to update tray icon, using fallback:', error);
      const size = process.platform === 'darwin' ? 22 : 16;
      const icon = nativeImage.createFromDataURL(this.createSimpleIcon(size));
      this.tray?.setImage(icon);
    }
  }

  /**
   * Start automatic timeline updates for tray icon
   */
  private startTimelineUpdates(): void {
    // Update timeline icon every 30 seconds
    this.trayUpdateTimer = setInterval(() => {
      if (this.useTimelineTray && !this.isAlertState) {
        this.updateTrayIcon();
      }
    }, 30000);
  }

  /**
   * Stop timeline updates
   */
  private stopTimelineUpdates(): void {
    if (this.trayUpdateTimer) {
      clearInterval(this.trayUpdateTimer);
      this.trayUpdateTimer = null;
    }
  }

  /**
   * Enable or disable timeline tray icons
   */
  public setTimelineEnabled(enabled: boolean): void {
    if (this.useTimelineTray !== enabled) {
      this.useTimelineTray = enabled;
      this.updateTrayIcon();
    }
  }

  private updateContextMenu(): void {
    const menuTemplate: MenuItemConstructorOptions[] = [];

    // Add provider stats or show loading message
    if (this.currentStats.providers.length === 0) {
      menuTemplate.push({
        label: '📊  Loading usage data...',
        enabled: false,
      });
      menuTemplate.push({ type: 'separator' });
    } else {
      for (const provider of this.currentStats.providers) {
        // Provider name with icon
        const providerIcon = provider.name === 'Cursor' ? '💻' : '🤖';
        menuTemplate.push({
          label: `${providerIcon}  ${provider.name}`,
          enabled: false,
        });

        // Balance
        menuTemplate.push({
          label: `    Balance: ${provider.balance}`,
          enabled: false,
        });

        // Request used
        menuTemplate.push({
          label: `    Request used: ${provider.requestUsed}`,
          enabled: false,
        });

        // Plan
        menuTemplate.push({
          label: `    Plan: ${provider.plan}`,
          enabled: false,
        });

        // Billing Period
        menuTemplate.push({
          label: `    Billing Period: ${provider.billingPeriod}`,
          enabled: false,
        });

        menuTemplate.push({ type: 'separator' });
      }
    }

    // Action items
    menuTemplate.push({
      label: 'Open AI Usage Monitor',
      click: () => this.callbacks.onOpenApp(),
    });

    menuTemplate.push({
      label: 'Refresh',
      accelerator: 'CmdOrCtrl+R',
      click: () => this.callbacks.onRefresh(),
    });

    menuTemplate.push({ type: 'separator' });

    menuTemplate.push({
      label: 'Quit',
      accelerator: 'CmdOrCtrl+Q',
      click: () => this.callbacks.onQuit(),
    });

    const contextMenu = Menu.buildFromTemplate(menuTemplate);
    this.tray?.setContextMenu(contextMenu);
  }

  /**
   * Update the stats displayed in the menu
   */
  public updateStats(stats: MenuBarStats): void {
    this.currentStats = stats;
    this.updateContextMenu();
  }

  /**
   * Update stats for a specific provider
   */
  public updateProviderStats(providerName: string, stats: Partial<ProviderStats>): void {
    const providerIndex = this.currentStats.providers.findIndex((p: ProviderStats) => p.name === providerName);
    if (providerIndex >= 0) {
      this.currentStats.providers[providerIndex] = {
        ...this.currentStats.providers[providerIndex],
        ...stats,
      };
      this.currentStats.lastUpdated = new Date();
      this.updateContextMenu();
    }
  }

  public destroy(): void {
    this.stopTimelineUpdates();
    this.tray?.destroy();
    this.tray = null;
  }
}
