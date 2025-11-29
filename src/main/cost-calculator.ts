import {
  NormalizedEntry,
  AggregatedUsage,
  ModelUsage,
  ProviderUsage,
  ModelPricing,
} from '../shared/types';
import { providerRegistry } from './providers';

/**
 * Cost Calculator - handles cost aggregation and formatting
 */
export class CostCalculator {
  /**
   * Calculate cost for a single entry using provider pricing
   */
  calculateEntryCost(entry: NormalizedEntry, pricing: ModelPricing): number {
    const cost =
      entry.inputTokens * pricing.inputPricePerToken +
      entry.outputTokens * pricing.outputPricePerToken +
      entry.cacheCreationTokens * pricing.cacheCreatePricePerToken +
      entry.cacheReadTokens * pricing.cacheReadPricePerToken;

    return Number(cost.toFixed(6));
  }

  /**
   * Aggregate costs from multiple entries
   */
  aggregateCosts(entries: NormalizedEntry[]): AggregatedUsage {
    const modelBreakdown: Record<string, ModelUsage> = {};
    const providerBreakdown: Record<string, ProviderUsage> = {};

    let inputTokens = 0;
    let outputTokens = 0;
    let cacheCreationTokens = 0;
    let cacheReadTokens = 0;
    let totalCostUSD = 0;

    for (const entry of entries) {
      // Aggregate totals
      inputTokens += entry.inputTokens;
      outputTokens += entry.outputTokens;
      cacheCreationTokens += entry.cacheCreationTokens;
      cacheReadTokens += entry.cacheReadTokens;
      totalCostUSD += entry.costUSD;

      // Model breakdown
      if (!modelBreakdown[entry.model]) {
        modelBreakdown[entry.model] = {
          model: entry.model,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costUSD: 0,
          entryCount: 0,
        };
      }
      modelBreakdown[entry.model].inputTokens += entry.inputTokens;
      modelBreakdown[entry.model].outputTokens += entry.outputTokens;
      modelBreakdown[entry.model].totalTokens += entry.totalTokens;
      modelBreakdown[entry.model].costUSD += entry.costUSD;
      modelBreakdown[entry.model].entryCount += 1;

      // Provider breakdown
      const provider = providerRegistry.getProvider(entry.provider);
      if (!providerBreakdown[entry.provider]) {
        providerBreakdown[entry.provider] = {
          providerId: entry.provider,
          providerName: provider?.name || entry.provider,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          totalTokens: 0,
          costUSD: 0,
          entryCount: 0,
        };
      }
      providerBreakdown[entry.provider].inputTokens += entry.inputTokens;
      providerBreakdown[entry.provider].outputTokens += entry.outputTokens;
      providerBreakdown[entry.provider].cacheCreationTokens += entry.cacheCreationTokens;
      providerBreakdown[entry.provider].cacheReadTokens += entry.cacheReadTokens;
      providerBreakdown[entry.provider].totalTokens += entry.totalTokens;
      providerBreakdown[entry.provider].costUSD += entry.costUSD;
      providerBreakdown[entry.provider].entryCount += 1;
    }

    return {
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      totalTokens: inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens,
      totalCostUSD: Number(totalCostUSD.toFixed(4)),
      entryCount: entries.length,
      modelBreakdown,
      providerBreakdown,
    };
  }

  /**
   * Aggregate costs grouped by provider
   */
  aggregateByProvider(
    entries: NormalizedEntry[]
  ): Map<string, AggregatedUsage> {
    const grouped = new Map<string, NormalizedEntry[]>();

    for (const entry of entries) {
      if (!grouped.has(entry.provider)) {
        grouped.set(entry.provider, []);
      }
      grouped.get(entry.provider)!.push(entry);
    }

    const result = new Map<string, AggregatedUsage>();
    for (const [providerId, providerEntries] of grouped) {
      result.set(providerId, this.aggregateCosts(providerEntries));
    }

    return result;
  }

  /**
   * Format cost as USD string
   */
  formatCostUSD(cost: number): string {
    return `$${cost.toFixed(2)}`;
  }

  /**
   * Format token count with thousands separator
   */
  formatTokens(tokens: number): string {
    return tokens.toLocaleString();
  }
}

// Export singleton instance
export const costCalculator = new CostCalculator();
