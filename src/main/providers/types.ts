import { NormalizedEntry, ModelPricing } from '../../shared/types';

/**
 * Base interface for all usage data providers
 */
export interface UsageProvider {
  /** Unique identifier for the provider */
  id: string;

  /** Display name for the provider */
  name: string;

  /** Provider type: file-based, API-based, or mock */
  type: 'file' | 'api' | 'mock';

  /**
   * Get directories to search for usage data (file-based providers)
   */
  getDataDirectories(): string[];

  /**
   * Parse a single file and return normalized entries
   */
  parseFile(filePath: string): Promise<NormalizedEntry[]>;

  /**
   * Load all usage data from this provider
   */
  loadUsageData(): Promise<NormalizedEntry[]>;

  /**
   * Serialize an entry back to its original format (for round-trip testing)
   */
  serializeEntry(entry: NormalizedEntry): string;

  /**
   * Check if this provider is available/supported on the current system
   */
  isSupported(): boolean;

  /**
   * Get pricing information for cost calculations
   */
  getPricing(): ModelPricing;

  /**
   * Start watching for file changes (file-based providers)
   */
  watchForChanges?(callback: () => void): void;

  /**
   * Stop watching for file changes
   */
  stopWatching?(): void;
}

/**
 * Configuration for mock data generation
 */
export interface MockConfig {
  entryCount: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  costPerEntry: number;
  model: string;
}

/**
 * Mock data type presets
 */
export type MockDataType = 'hobby' | 'pro' | 'proPlus' | 'ultra' | 'teams' | 'enterprise';

/**
 * Raw entry format from Claude Code JSONL files
 * Claude Code stores conversation data with usage info nested inside a message object
 */
export interface RawClaudeEntry {
  type: string;
  timestamp: string;
  sessionId?: string;
  uuid?: string;
  message: {
    model: string;
    role: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  costUSD?: number;
}
