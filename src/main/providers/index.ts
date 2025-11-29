import { UsageProvider } from './types';
import { ClaudeCodeProvider } from './claude-code-provider';
import { CursorMockProvider } from './cursor-mock-provider';

/**
 * Provider Registry - manages all usage data providers
 */
export class ProviderRegistry {
  private providers: Map<string, UsageProvider> = new Map();
  private enabledProviders: Set<string> = new Set();

  constructor() {
    // Register built-in providers
    this.registerProvider(new ClaudeCodeProvider());
    this.registerProvider(new CursorMockProvider());

    // Enable all by default
    this.providers.forEach((_, id) => this.enabledProviders.add(id));
  }

  /**
   * Register a new provider
   */
  registerProvider(provider: UsageProvider): void {
    this.providers.set(provider.id, provider);
    console.log(`Registered provider: ${provider.name} (${provider.id})`);
  }

  /**
   * Get a provider by ID
   */
  getProvider(id: string): UsageProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Get all enabled providers
   */
  getEnabledProviders(): UsageProvider[] {
    return Array.from(this.providers.values()).filter((p) =>
      this.enabledProviders.has(p.id)
    );
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): UsageProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Check if a provider is enabled
   */
  isProviderEnabled(id: string): boolean {
    return this.enabledProviders.has(id);
  }

  /**
   * Enable or disable a provider
   */
  setProviderEnabled(id: string, enabled: boolean): void {
    if (enabled) {
      this.enabledProviders.add(id);
    } else {
      this.enabledProviders.delete(id);
    }
    console.log(`Provider ${id} ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get provider info for UI display
   */
  getProviderInfo(): Array<{
    id: string;
    name: string;
    type: string;
    enabled: boolean;
    supported: boolean;
  }> {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      enabled: this.enabledProviders.has(p.id),
      supported: p.isSupported(),
    }));
  }

  /**
   * Set enabled providers from settings
   */
  setEnabledProviders(providerIds: string[]): void {
    this.enabledProviders.clear();
    providerIds.forEach((id) => {
      if (this.providers.has(id)) {
        this.enabledProviders.add(id);
      }
    });
  }

  /**
   * Cleanup - stop all file watchers
   */
  cleanup(): void {
    this.providers.forEach((provider) => {
      if (provider.stopWatching) {
        provider.stopWatching();
      }
    });
  }
}

// Export singleton instance
export const providerRegistry = new ProviderRegistry();

// Re-export types
export * from './types';
