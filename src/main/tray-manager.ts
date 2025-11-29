import { Tray, Menu, nativeImage, MenuItemConstructorOptions } from 'electron';
import path from 'path';

export interface TrayManagerCallbacks {
  onOpenDashboard: () => void;
  onOpenSettings: () => void;
  onRefresh: () => void;
  onQuit: () => void;
}

export class TrayManager {
  private tray: Tray | null = null;
  private callbacks: TrayManagerCallbacks;
  private isAlertState: boolean = false;

  constructor(callbacks: TrayManagerCallbacks) {
    this.callbacks = callbacks;
    this.initialize();
  }

  private initialize(): void {
    // Create tray icon
    const icon = this.createIcon();
    this.tray = new Tray(icon);

    // Set initial tooltip
    this.updateTooltip('AI Usage: $0.00 today');

    // Build context menu
    this.updateContextMenu();

    // Double-click opens dashboard
    this.tray.on('double-click', () => {
      this.callbacks.onOpenDashboard();
    });
  }

  private createIcon(): Electron.NativeImage {
    // Create a simple 16x16 icon programmatically
    // In production, replace with actual icon files
    const size = process.platform === 'darwin' ? 22 : 16;
    
    // Try to load from assets first
    const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
    
    // Create a simple colored icon as fallback
    const icon = nativeImage.createEmpty();
    
    // For now, create a simple template icon
    // This creates a basic circular icon
    const canvas = this.createSimpleIcon(size);
    
    return nativeImage.createFromDataURL(canvas);
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
    const icon = nativeImage.createFromDataURL(this.createSimpleIcon(process.platform === 'darwin' ? 22 : 16));
    this.tray?.setImage(icon);
  }

  private updateContextMenu(): void {
    const menuTemplate: MenuItemConstructorOptions[] = [
      {
        label: 'Open Dashboard',
        click: () => this.callbacks.onOpenDashboard(),
      },
      { type: 'separator' },
      {
        label: 'Refresh',
        click: () => this.callbacks.onRefresh(),
      },
      {
        label: 'Settings...',
        click: () => this.callbacks.onOpenSettings(),
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => this.callbacks.onQuit(),
      },
    ];

    const contextMenu = Menu.buildFromTemplate(menuTemplate);
    this.tray?.setContextMenu(contextMenu);
  }

  public destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}
