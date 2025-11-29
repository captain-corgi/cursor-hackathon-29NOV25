import { Notification, nativeImage, app } from 'electron';
import path from 'path';

/**
 * Notification Manager - handles system notifications
 */
export class NotificationManager {
  private lastNotificationTime: number = 0;
  private notificationCooldown: number = 60000; // 1 minute cooldown

  /**
   * Check if notifications are supported
   */
  isSupported(): boolean {
    return Notification.isSupported();
  }

  /**
   * Show a high usage alert notification
   */
  showHighUsageAlert(dailyCost: number, threshold: number): void {
    if (!this.canShowNotification()) {
      return;
    }

    this.showNotification({
      title: '⚠️ High Usage Alert',
      body: `Daily AI usage ($${dailyCost.toFixed(2)}) has exceeded your threshold ($${threshold.toFixed(2)})`,
      urgency: 'critical',
    });
  }

  /**
   * Show a generic notification
   */
  showNotification(options: {
    title: string;
    body: string;
    urgency?: 'normal' | 'critical' | 'low';
    silent?: boolean;
  }): void {
    if (!this.isSupported()) {
      console.log('Notifications not supported');
      return;
    }

    if (!this.canShowNotification()) {
      console.log('Notification on cooldown');
      return;
    }

    const notification = new Notification({
      title: options.title,
      body: options.body,
      urgency: options.urgency || 'normal',
      silent: options.silent || false,
      icon: this.getIcon(),
    });

    notification.on('click', () => {
      // Could open dashboard here
      console.log('Notification clicked');
    });

    notification.show();
    this.lastNotificationTime = Date.now();

    console.log(`Notification shown: ${options.title}`);
  }

  /**
   * Check if we can show a notification (cooldown)
   */
  private canShowNotification(): boolean {
    const now = Date.now();
    return now - this.lastNotificationTime > this.notificationCooldown;
  }

  /**
   * Get notification icon
   */
  private getIcon(): Electron.NativeImage | undefined {
    try {
      // Try to load app icon
      const iconPath = path.join(__dirname, '../../assets/icon.png');
      return nativeImage.createFromPath(iconPath);
    } catch {
      return undefined;
    }
  }

  /**
   * Set notification cooldown in milliseconds
   */
  setCooldown(ms: number): void {
    this.notificationCooldown = ms;
  }
}

// Export singleton instance
export const notificationManager = new NotificationManager();
