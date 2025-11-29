import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { UsageProvider, RawClaudeEntry } from './types';
import { NormalizedEntry, ModelPricing } from '../../shared/types';

// Optional: Use chokidar for file watching if available
let chokidar: any = null;
try {
  chokidar = require('chokidar');
} catch {
  console.log('chokidar not available, file watching disabled');
}

/**
 * Claude Code Provider - reads usage data from local JSONL files
 */
export class ClaudeCodeProvider implements UsageProvider {
  public readonly id = 'claude-code';
  public readonly name = 'Claude Code';
  public readonly type: 'file' = 'file';

  private fileWatcher: any = null;
  private customDirectories: string[] = [];

  /**
   * Get platform-specific data directories
   */
  getDataDirectories(): string[] {
    const home = os.homedir();
    const defaultDirs = [
      path.join(home, '.config', 'claude', 'projects'),
      path.join(home, '.claude', 'projects'),
    ];

    return [...defaultDirs, ...this.customDirectories];
  }

  /**
   * Set custom data directories
   */
  setCustomDirectories(directories: string[]): void {
    this.customDirectories = directories;
  }

  /**
   * Parse a single JSONL file
   */
  async parseFile(filePath: string): Promise<NormalizedEntry[]> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());
      const entries: NormalizedEntry[] = [];

      for (const line of lines) {
        try {
          const raw: RawClaudeEntry = JSON.parse(line);
          // Only include entries that have usage data (normalizeEntry returns null for non-assistant entries)
          const normalized = this.normalizeEntry(raw, filePath);
          if (normalized) {
            entries.push(normalized);
          }
        } catch (e) {
          // Skip malformed lines, log warning
          console.warn(`Skipping malformed line in ${filePath}: ${e}`);
        }
      }

      return entries;
    } catch (e) {
      console.error(`Error reading file ${filePath}: ${e}`);
      return [];
    }
  }

  /**
   * Load all usage data from all directories
   */
  async loadUsageData(): Promise<NormalizedEntry[]> {
    const allEntries: NormalizedEntry[] = [];

    for (const dir of this.getDataDirectories()) {
      if (await this.directoryExists(dir)) {
        try {
          const files = await this.findJSONLFiles(dir);
          for (const file of files) {
            const entries = await this.parseFile(file);
            allEntries.push(...entries);
          }
        } catch (e) {
          console.error(`Error loading data from ${dir}: ${e}`);
        }
      }
    }

    // Sort by timestamp descending (most recent first)
    return allEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Normalize raw Claude entry to common format
   * Returns null if entry has no usage data (e.g., user messages)
   */
  private normalizeEntry(raw: RawClaudeEntry, filePath: string): NormalizedEntry | null {
    // Only assistant messages have usage data
    if (!raw.message?.usage) {
      return null;
    }

    const usage = raw.message.usage;
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cacheCreationTokens = usage.cache_creation_input_tokens || 0;
    const cacheReadTokens = usage.cache_read_input_tokens || 0;

    // Extract project and session from file path
    const sessionId = raw.sessionId || path.basename(filePath, '.jsonl');
    const projectId = path.basename(path.dirname(filePath));

    return {
      timestamp: new Date(raw.timestamp),
      model: raw.message.model || 'unknown',
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      totalTokens: inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens,
      costUSD: raw.costUSD ?? this.calculateCost(usage),
      sessionId,
      projectId,
      provider: this.id,
    };
  }

  /**
   * Calculate cost from tokens using pricing
   */
  private calculateCost(usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  }): number {
    const pricing = this.getPricing();
    const cost =
      (usage.input_tokens || 0) * pricing.inputPricePerToken +
      (usage.output_tokens || 0) * pricing.outputPricePerToken +
      (usage.cache_creation_input_tokens || 0) * pricing.cacheCreatePricePerToken +
      (usage.cache_read_input_tokens || 0) * pricing.cacheReadPricePerToken;

    return Number(cost.toFixed(6));
  }

  /**
   * Get Claude pricing (per token) - Claude Sonnet 4 pricing
   */
  getPricing(): ModelPricing {
    return {
      inputPricePerToken: 0.000003, // $3 per 1M tokens
      outputPricePerToken: 0.000015, // $15 per 1M tokens
      cacheCreatePricePerToken: 0.00000375, // $3.75 per 1M tokens
      cacheReadPricePerToken: 0.0000003, // $0.30 per 1M tokens
    };
  }

  /**
   * Serialize entry back to original JSONL format
   */
  serializeEntry(entry: NormalizedEntry): string {
    const raw: RawClaudeEntry = {
      type: 'assistant',
      timestamp: entry.timestamp.toISOString(),
      sessionId: entry.sessionId,
      message: {
        model: entry.model,
        role: 'assistant',
        usage: {
          input_tokens: entry.inputTokens,
          output_tokens: entry.outputTokens,
          cache_creation_input_tokens: entry.cacheCreationTokens,
          cache_read_input_tokens: entry.cacheReadTokens,
        },
      },
      costUSD: entry.costUSD,
    };
    return JSON.stringify(raw);
  }

  /**
   * Check if provider is supported (data directories exist)
   */
  isSupported(): boolean {
    return this.getDataDirectories().some((dir) => {
      try {
        return fs.existsSync(dir);
      } catch {
        return false;
      }
    });
  }

  /**
   * Watch for file changes
   */
  watchForChanges(callback: () => void): void {
    if (!chokidar) {
      console.log('File watching not available - chokidar not installed');
      return;
    }

    const dirs = this.getDataDirectories().filter((dir) => {
      try {
        return fs.existsSync(dir);
      } catch {
        return false;
      }
    });

    if (dirs.length === 0) {
      console.log('No directories to watch');
      return;
    }

    this.fileWatcher = chokidar.watch(dirs, {
      ignored: /^\./,
      persistent: true,
      ignoreInitial: true,
      depth: 2, // Watch project directories
    });

    this.fileWatcher.on('add', (filePath: string) => {
      if (filePath.endsWith('.jsonl')) {
        console.log(`New file detected: ${filePath}`);
        callback();
      }
    });

    this.fileWatcher.on('change', (filePath: string) => {
      if (filePath.endsWith('.jsonl')) {
        console.log(`File changed: ${filePath}`);
        callback();
      }
    });

    console.log(`Watching directories: ${dirs.join(', ')}`);
  }

  /**
   * Stop watching for file changes
   */
  stopWatching(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
      console.log('Stopped watching for file changes');
    }
  }

  /**
   * Check if a directory exists
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Find all JSONL files in a directory (recursively)
   */
  private async findJSONLFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Recurse into subdirectories (project folders)
          const subFiles = await this.findJSONLFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          files.push(fullPath);
        }
      }
    } catch (e) {
      console.error(`Error reading directory ${dirPath}: ${e}`);
    }

    return files;
  }
}
