import { UsageProvider, MockConfig, MockDataType } from './types';
import { NormalizedEntry, ModelPricing } from '../../shared/types';

/**
 * Mock data configurations for different Cursor plan types
 */
const MOCK_DATA_CONFIGS: Record<MockDataType, MockConfig> = {
  hobby: {
    entryCount: 50,
    avgInputTokens: 500,
    avgOutputTokens: 200,
    costPerEntry: 0.001,
    model: 'gpt-4',
  },
  pro: {
    entryCount: 200,
    avgInputTokens: 1000,
    avgOutputTokens: 500,
    costPerEntry: 0.003,
    model: 'gpt-4',
  },
  proPlus: {
    entryCount: 500,
    avgInputTokens: 1500,
    avgOutputTokens: 800,
    costPerEntry: 0.005,
    model: 'gpt-4',
  },
  ultra: {
    entryCount: 1000,
    avgInputTokens: 2000,
    avgOutputTokens: 1000,
    costPerEntry: 0.008,
    model: 'gpt-4',
  },
  teams: {
    entryCount: 300,
    avgInputTokens: 1200,
    avgOutputTokens: 600,
    costPerEntry: 0.004,
    model: 'gpt-4',
  },
  enterprise: {
    entryCount: 800,
    avgInputTokens: 1800,
    avgOutputTokens: 900,
    costPerEntry: 0.006,
    model: 'gpt-4',
  },
};

/**
 * Cursor Mock Provider - generates mock usage data for development/testing
 */
export class CursorMockProvider implements UsageProvider {
  public readonly id = 'cursor';
  public readonly name = 'Cursor';
  public readonly type: 'mock' = 'mock';

  private mockDataType: MockDataType = 'pro';

  /**
   * Mock provider doesn't read from directories
   */
  getDataDirectories(): string[] {
    return [];
  }

  /**
   * Mock provider doesn't parse files
   */
  async parseFile(_filePath: string): Promise<NormalizedEntry[]> {
    return [];
  }

  /**
   * Generate and return mock usage data
   */
  async loadUsageData(): Promise<NormalizedEntry[]> {
    return this.generateMockData(this.mockDataType);
  }

  /**
   * Set the mock data type for different plan simulations
   */
  setMockDataType(type: MockDataType): void {
    this.mockDataType = type;
  }

  /**
   * Get current mock data type
   */
  getMockDataType(): MockDataType {
    return this.mockDataType;
  }

  /**
   * Generate mock entries based on configuration
   */
  private generateMockData(type: MockDataType): NormalizedEntry[] {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const entries: NormalizedEntry[] = [];
    const config = MOCK_DATA_CONFIGS[type];

    // Distribute entries across the month up to now
    const daysInMonth = Math.floor(
      (now.getTime() - startOfMonth.getTime()) / (24 * 60 * 60 * 1000)
    ) + 1;
    const entriesPerDay = Math.ceil(config.entryCount / Math.max(daysInMonth, 1));

    for (let day = 0; day < daysInMonth; day++) {
      const dayStart = new Date(startOfMonth.getTime() + day * 24 * 60 * 60 * 1000);

      for (let i = 0; i < entriesPerDay && entries.length < config.entryCount; i++) {
        // Add some randomness to make data more realistic
        const variance = 0.3; // 30% variance
        const inputTokens = Math.round(
          config.avgInputTokens * (1 + (Math.random() - 0.5) * variance)
        );
        const outputTokens = Math.round(
          config.avgOutputTokens * (1 + (Math.random() - 0.5) * variance)
        );
        const cost = config.costPerEntry * (1 + (Math.random() - 0.5) * variance);

        // Random hour of the day
        const hour = Math.floor(Math.random() * 12) + 8; // 8am to 8pm
        const minute = Math.floor(Math.random() * 60);
        const timestamp = new Date(dayStart);
        timestamp.setHours(hour, minute, 0, 0);

        // Only include if timestamp is before now
        if (timestamp <= now) {
          entries.push({
            timestamp,
            model: config.model,
            inputTokens,
            outputTokens,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            totalTokens: inputTokens + outputTokens,
            costUSD: Number(cost.toFixed(4)),
            sessionId: `cursor-session-${day}-${i}`,
            projectId: 'cursor-project',
            provider: this.id,
          });
        }
      }
    }

    // Sort by timestamp descending (most recent first)
    return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Serialize entry to JSON
   */
  serializeEntry(entry: NormalizedEntry): string {
    return JSON.stringify({
      timestamp: entry.timestamp.toISOString(),
      model: entry.model,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      totalTokens: entry.totalTokens,
      costUSD: entry.costUSD,
      sessionId: entry.sessionId,
      projectId: entry.projectId,
      provider: entry.provider,
    });
  }

  /**
   * Mock provider is always supported
   */
  isSupported(): boolean {
    return true;
  }

  /**
   * Get pricing for Cursor (simplified)
   */
  getPricing(): ModelPricing {
    return {
      inputPricePerToken: 0.000001,
      outputPricePerToken: 0.000002,
      cacheCreatePricePerToken: 0,
      cacheReadPricePerToken: 0,
    };
  }
}
