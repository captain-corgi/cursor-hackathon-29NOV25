// Memory-efficient circular buffer for timeline data points

import { EventEmitter } from 'events';
import { TimelineDataPoint, MemoryStats, TimelineUpdateEvent, TimelineConfig } from '../../shared/timeline-types';

/**
 * Circular Buffer for efficient storage and retrieval of timeline data points
 * Provides O(1) insertion and retrieval with automatic overflow handling
 */
export class CircularBuffer extends EventEmitter {
  private buffer: TimelineDataPoint[];
  private head: number = 0; // Next write position
  private tail: number = 0; // Oldest data position
  private size: number = 0; // Current number of elements
  private capacity: number;
  private config: TimelineConfig;

  constructor(config: TimelineConfig) {
    super();
    this.capacity = config.bufferSize;
    this.config = config;
    this.buffer = new Array(this.capacity);
  }

  /**
   * Add a new data point to the buffer
   * @param dataPoint Timeline data point to add
   * @returns True if buffer overwrote old data
   */
  add(dataPoint: TimelineDataPoint): boolean {
    const overwritten = this.size === this.capacity;

    // Add data at head position
    this.buffer[this.head] = dataPoint;

    // Move head forward (with wrap-around)
    this.head = (this.head + 1) % this.capacity;

    // Update size and tail
    if (this.size < this.capacity) {
      this.size++;
    } else {
      // Buffer is full, move tail forward (oldest data is overwritten)
      this.tail = (this.tail + 1) % this.capacity;

      // Emit overflow event
      this.emit('buffer-overflow', {
        type: 'buffer-overflow',
        timestamp: new Date(),
        metadata: {
          overwrittenPoint: this.buffer[this.tail],
          bufferSize: this.size
        }
      } as TimelineUpdateEvent);
    }

    // Emit data point added event
    this.emit('data-point-added', {
      type: 'data-point-added',
      timestamp: new Date(),
      data: dataPoint
    } as TimelineUpdateEvent);

    return overwritten;
  }

  /**
   * Get the most recent N data points
   * @param count Number of recent data points to retrieve
   * @returns Array of recent data points (newest first)
   */
  getRecent(count: number): TimelineDataPoint[] {
    const result: TimelineDataPoint[] = [];
    const actualCount = Math.min(count, this.size);

    for (let i = 0; i < actualCount; i++) {
      const index = (this.head - 1 - i + this.capacity) % this.capacity;
      const point = this.buffer[index];
      if (point) {
        result.push(point);
      }
    }

    return result;
  }

  /**
   * Get data points within a time window
   * @param startTimeMs Start time in milliseconds
   * @param endTimeMs End time in milliseconds
   * @returns Array of data points within time range (chronological order)
   */
  getDataInTimeWindow(startTimeMs: number, endTimeMs: number): TimelineDataPoint[] {
    const result: TimelineDataPoint[] = [];

    for (let i = 0; i < this.size; i++) {
      const index = (this.tail + i) % this.capacity;
      const point = this.buffer[index];

      if (point) {
        const pointTime = point.timestamp.getTime();
        if (pointTime >= startTimeMs && pointTime <= endTimeMs) {
          result.push(point);
        }
      }
    }

    return result;
  }

  /**
   * Get data points from a time window with specified resolution
   * @param startTimeMs Start time in milliseconds
   * @param endTimeMs End time in milliseconds
   * @param maxPoints Maximum number of points to return (for downsampling)
   * @returns Array of data points with downsampling if needed
   */
  getDataWithResolution(
    startTimeMs: number,
    endTimeMs: number,
    maxPoints: number
  ): TimelineDataPoint[] {
    const allPoints = this.getDataInTimeWindow(startTimeMs, endTimeMs);

    if (allPoints.length <= maxPoints) {
      return allPoints;
    }

    // Downsample using aggregation
    const step = Math.ceil(allPoints.length / maxPoints);
    const result: TimelineDataPoint[] = [];

    for (let i = 0; i < allPoints.length; i += step) {
      const batch = allPoints.slice(i, Math.min(i + step, allPoints.length));

      if (batch.length === 1) {
        result.push(batch[0]);
      } else {
        // Aggregate the batch
        const aggregated = this.aggregateBatch(batch);
        result.push(aggregated);
      }
    }

    return result;
  }

  /**
   * Aggregate a batch of timeline data points
   * @param batch Array of data points to aggregate
   * @returns Aggregated data point
   */
  private aggregateBatch(batch: TimelineDataPoint[]): TimelineDataPoint {
    if (batch.length === 0) {
      throw new Error('Cannot aggregate empty batch');
    }

    const first = batch[0];
    const last = batch[batch.length - 1];

    // Sum all numeric fields
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheCreationTokens = 0;
    let cacheReadTokens = 0;
    let totalTokens = 0;
    let costUSD = 0;
    let entryCount = 0;

    // Aggregate model and provider breakdowns
    const modelBreakdown: Record<string, any> = {};
    const providerBreakdown: Record<string, any> = {};

    for (const point of batch) {
      inputTokens += point.inputTokens;
      outputTokens += point.outputTokens;
      cacheCreationTokens += point.cacheCreationTokens;
      cacheReadTokens += point.cacheReadTokens;
      totalTokens += point.totalTokens;
      costUSD += point.costUSD;
      entryCount += point.entryCount;

      // Aggregate model breakdown
      for (const [model, usage] of Object.entries(point.modelBreakdown)) {
        if (!modelBreakdown[model]) {
          modelBreakdown[model] = {
            model,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            costUSD: 0,
            entryCount: 0,
          };
        }

        modelBreakdown[model].inputTokens += usage.inputTokens;
        modelBreakdown[model].outputTokens += usage.outputTokens;
        modelBreakdown[model].totalTokens += usage.totalTokens;
        modelBreakdown[model].costUSD += usage.costUSD;
        modelBreakdown[model].entryCount += usage.entryCount;
      }

      // Aggregate provider breakdown
      for (const [provider, usage] of Object.entries(point.providerBreakdown)) {
        if (!providerBreakdown[provider]) {
          providerBreakdown[provider] = {
            providerId: usage.providerId,
            providerName: usage.providerName,
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            totalTokens: 0,
            costUSD: 0,
            entryCount: 0,
          };
        }

        providerBreakdown[provider].inputTokens += usage.inputTokens;
        providerBreakdown[provider].outputTokens += usage.outputTokens;
        providerBreakdown[provider].cacheCreationTokens += usage.cacheCreationTokens;
        providerBreakdown[provider].cacheReadTokens += usage.cacheReadTokens;
        providerBreakdown[provider].totalTokens += usage.totalTokens;
        providerBreakdown[provider].costUSD += usage.costUSD;
        providerBreakdown[provider].entryCount += usage.entryCount;
      }
    }

    return {
      timestamp: first.timestamp,
      durationMs: last.timestamp.getTime() - first.timestamp.getTime() + last.durationMs,
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      totalTokens,
      costUSD,
      entryCount,
      modelBreakdown,
      providerBreakdown,
    };
  }

  /**
   * Get the oldest data point in the buffer
   */
  getOldest(): TimelineDataPoint | null {
    if (this.size === 0) return null;
    return this.buffer[this.tail] || null;
  }

  /**
   * Get the newest data point in the buffer
   */
  getNewest(): TimelineDataPoint | null {
    if (this.size === 0) return null;
    const newestIndex = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[newestIndex] || null;
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): MemoryStats {
    const oldest = this.getOldest();
    const newest = this.getNewest();

    // Estimate memory usage (rough calculation)
    const estimatedSizePerPoint = 512; // bytes per data point (rough estimate)
    const memoryUsageMB = (this.size * estimatedSizePerPoint) / (1024 * 1024);

    return {
      bufferSize: this.capacity,
      usedSlots: this.size,
      memoryUsageMB,
      oldestDataPoint: oldest?.timestamp || null,
      newestDataPoint: newest?.timestamp || null,
      dataPointsInTimeWindow: this.size,
    };
  }

  /**
   * Clean up old data points based on retention policy
   * @param maxAgeMs Maximum age of data points to keep
   * @returns Number of data points removed
   */
  cleanup(maxAgeMs?: number): number {
    const retentionMs = maxAgeMs || this.config.maxRetentionMs;
    const cutoffTime = Date.now() - retentionMs;
    let removed = 0;

    // Remove old data points from the tail
    while (this.size > 0) {
      const oldest = this.getOldest();
      if (oldest && oldest.timestamp.getTime() < cutoffTime) {
        // Remove this data point by moving tail forward
        this.buffer[this.tail] = undefined as any;
        this.tail = (this.tail + 1) % this.capacity;
        this.size--;
        removed++;
      } else {
        break;
      }
    }

    if (removed > 0) {
      this.emit('memory-cleanup', {
        type: 'memory-cleanup',
        timestamp: new Date(),
        metadata: { removed, remaining: this.size }
      } as TimelineUpdateEvent);
    }

    return removed;
  }

  /**
   * Clear all data from the buffer
   */
  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.size = 0;

    this.emit('buffer-cleared', {
      type: 'configuration-changed',
      timestamp: new Date(),
      metadata: { action: 'clear' }
    } as TimelineUpdateEvent);
  }

  /**
   * Resize the buffer capacity
   * @param newCapacity New buffer capacity
   */
  resize(newCapacity: number): void {
    if (newCapacity < this.size) {
      throw new Error(`Cannot resize to ${newCapacity}: buffer contains ${this.size} items`);
    }

    const newBuffer = new Array(newCapacity);

    // Copy existing data to new buffer
    for (let i = 0; i < this.size; i++) {
      const oldIndex = (this.tail + i) % this.capacity;
      newBuffer[i] = this.buffer[oldIndex];
    }

    // Update buffer and indices
    this.buffer = newBuffer;
    this.capacity = newCapacity;
    this.head = this.size;
    this.tail = 0;

    this.emit('buffer-resized', {
      type: 'configuration-changed',
      timestamp: new Date(),
      metadata: { oldCapacity: this.capacity, newCapacity }
    } as TimelineUpdateEvent);
  }

  /**
   * Get current buffer statistics
   */
  getStats(): { capacity: number; size: number; usagePercent: number; isFull: boolean } {
    return {
      capacity: this.capacity,
      size: this.size,
      usagePercent: (this.size / this.capacity) * 100,
      isFull: this.size === this.capacity,
    };
  }

  /**
   * Check if buffer is full
   */
  isFull(): boolean {
    return this.size === this.capacity;
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.size === 0;
  }
}