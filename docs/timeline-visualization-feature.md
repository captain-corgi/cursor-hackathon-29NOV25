# Timeline Visualization Feature for AI Usage Monitor

## Overview

The Interactive Usage Timeline feature transforms static usage statistics into an engaging visual narrative that displays real-time AI usage patterns throughout the day. This visualization is integrated directly into the system tray, providing immediate insights into usage behavior without requiring users to open the main application.

## Feature Benefits

1. **Immediate Visual Feedback**: Users can see usage patterns at a glance through the system tray
2. **Behavioral Insights**: Identifies peak usage times and patterns across different AI tools
3. **Proactive Monitoring**: Visual indicators for unusual usage spikes or concerning trends
4. **Historical Context**: Quick switching between daily, weekly, and monthly timeline views
5. **Compact Design**: Optimized for the space constraints of menu bar applications

## Technical Implementation

### Core Components

#### 1. Timeline Data Aggregator

The timeline aggregator processes raw usage data from JSONL files and creates time-series data optimized for visualization:

```typescript
interface TimelineDataPoint {
  timestamp: Date;
  cost: number;
  tokens: number;
  requests: number;
  provider: string;
  model: string;
}

interface AggregatedTimelinePoint {
  timeSlot: Date;
  totalCost: number;
  totalTokens: number;
  requestCount: number;
  providerBreakdown: Record<string, number>;
  modelBreakdown: Record<string, number>;
}
```

#### 2. Circular Buffer for Memory Efficiency

To handle continuous data updates without memory leaks:

```typescript
class CircularBuffer<T> {
  private buffer: T[];
  private capacity: number;
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  // Methods for efficient data insertion and retrieval
}
```

#### 3. Canvas-based Microtimeline Renderer

Lightweight rendering optimized for menu bar constraints:

```typescript
class TimelineRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // Optimized rendering for 16-22px constraints
  renderMiniTimeline(data: TimelineDataPoint[]): void {
    // Efficient pixel manipulation for performance
  }

  // Interactive features for expanded view
  renderFullTimeline(data: TimelineDataPoint[]): void {
    // Detailed visualization with hover interactions
  }
}
```

### Architecture Integration

The timeline feature integrates with existing components:

1. **App State Extension**: Timeline data is added to the centralized state management
2. **Provider Integration**: Existing data providers feed timeline aggregation
3. **Tray Manager Enhancement**: System tray displays timeline visualization
4. **Dashboard Addition**: Full timeline view in main application interface

### Data Flow

```
JSONL Files → Data Loader → Timeline Aggregator → Circular Buffer → Renderer → System Tray
                                              ↓
                                           IPC Handler
                                              ↓
                                          Dashboard UI
```

## Implementation Details

### Phase 1: Data Infrastructure

**Timeline Data Types** (`src/shared/timeline-types.ts`):

```typescript
export interface TimelineConfig {
  timeWindow: '1h' | '6h' | '24h' | '7d' | '30d';
  resolution: number; // Data points per time window
  colorScheme: 'default' | 'high-contrast' | 'colorblind-friendly';
  showProviderBreakdown: boolean;
}

export interface TimelineVisualization {
  data: AggregatedTimelinePoint[];
  config: TimelineConfig;
  lastUpdated: Date;
  isLoading: boolean;
}
```

**Circular Buffer Implementation** (`src/main/timeline/circular-buffer.ts`):

```typescript
export class TimelineBuffer {
  private buffer: AggregatedTimelinePoint[];
  private maxSize: number;
  private currentIndex: number = 0;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
    this.buffer = new Array(maxSize);
  }

  addDataPoint(point: AggregatedTimelinePoint): void {
    this.buffer[this.currentIndex] = point;
    this.currentIndex = (this.currentIndex + 1) % this.maxSize;
  }

  getRecentData(count: number): AggregatedTimelinePoint[] {
    const result: AggregatedTimelinePoint[] = [];
    for (let i = 0; i < Math.min(count, this.buffer.length); i++) {
      const index = (this.currentIndex - 1 - i + this.maxSize) % this.maxSize;
      if (this.buffer[index]) {
        result.unshift(this.buffer[index]);
      }
    }
    return result;
  }
}
```

### Phase 2: Timeline Renderer

**Microtimeline Component** (`src/renderer/components/MicroTimeline.tsx`):

```typescript
import React, { useEffect, useRef } from 'react';
import { TimelineDataPoint } from '@shared/timeline-types';

interface MicroTimelineProps {
  data: TimelineDataPoint[];
  width: number;
  height: number;
  onClick?: () => void;
}

const MicroTimeline: React.FC<MicroTimelineProps> = ({
  data,
  width,
  height,
  onClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Find max value for scaling
    const maxValue = Math.max(...data.map(d => d.cost));

    // Draw timeline visualization
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1;
    ctx.beginPath();

    data.forEach((point, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - (point.cost / maxValue) * height;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Add gradient fill for better visibility
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    ctx.fillStyle = gradient;
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
  }, [data, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    />
  );
};

export default MicroTimeline;
```

### Phase 3: Tray Integration

**Enhanced Tray Manager** (`src/main/tray-manager.ts`):

```typescript
// Extend the existing TrayManager class with timeline functionality
export class TrayManager {
  private timelineRenderer: TimelineRenderer;
  private canvas: HTMLCanvasElement;

  constructor(callbacks: TrayManagerCallbacks) {
    // Existing initialization...
    this.initializeTimelineRenderer();
  }

  private initializeTimelineRenderer(): void {
    this.canvas = document.createElement('canvas');
    this.timelineRenderer = new TimelineRenderer(this.canvas);
  }

  public updateTimelineVisualization(data: TimelineDataPoint[]): void {
    const size = process.platform === 'darwin' ? 22 : 16;
    this.timelineRenderer.renderMiniTimeline(data, size, size);

    // Convert canvas to NativeImage for tray icon
    const imageData = this.canvas.toDataURL('image/png');
    const nativeImage = nativeImage.createFromDataURL(imageData);
    this.tray?.setImage(nativeImage);
  }
}
```

## Performance Optimizations

1. **Data Sampling**: Reduce data points for visualization while preserving patterns
2. **Canvas Rendering**: Use hardware-accelerated Canvas API for smooth animations
3. **Memory Management**: Circular buffer prevents memory growth
4. **Lazy Loading**: Only render timeline when data changes
5. **Debounced Updates**: Batch rapid data changes to reduce rendering frequency

## User Interface Design

### System Tray Integration

The timeline appears as a subtle line graph within the system tray icon, with:

- **Normal State**: Blue line showing usage pattern
- **High Usage Alert**: Red coloring with pulsing animation
- **No Data**: Gray flat line with loading indicator
- **Hover**: Enlarged preview with detailed tooltip

### Dashboard Timeline View

Full timeline component in the main dashboard includes:

- **Time Window Selector**: Switch between 1h, 6h, 24h, 7d, 30d views
- **Provider Overlays**: Toggle different AI providers on/off
- **Interactive Tooltips**: Detailed information on hover
- **Zoom Functionality**: Click and drag to zoom into specific time ranges
- **Export Options**: Save timeline as image or CSV data

## Configuration Options

Users can customize timeline behavior in settings:

```typescript
interface TimelineSettings {
  enabled: boolean;
  defaultTimeWindow: '1h' | '6h' | '24h' | '7d' | '30d';
  updateFrequency: number; // Seconds between updates
  colorScheme: 'default' | 'high-contrast' | 'colorblind-friendly';
  showProviderColors: boolean;
  enableAnimations: boolean;
  alertThreshold: number; // Cost threshold for visual alerts
}
```

## Testing Strategy

### Unit Tests

- Circular buffer operations (add, retrieve, overflow handling)
- Timeline data aggregation accuracy
- Canvas rendering performance benchmarks

### Integration Tests

- Real-time data updates from file system watching
- Cross-platform tray icon rendering
- IPC communication reliability

### Visual Tests

- Timeline appearance across different screen densities
- Animation smoothness on various hardware configurations
- Accessibility compliance (color contrast, screen reader support)

## Future Enhancements

1. **Predictive Analytics**: ML-based usage forecasting
2. **Comparison Views**: Side-by-side timeline comparisons
3. **Advanced Filtering**: Filter by project, model, or cost range
4. **Heat Map Visualization**: 2D heat map showing usage intensity
5. **API Integration**: Support for additional AI service providers

## Conclusion

The Timeline Visualization feature transforms AI Usage Monitor from a passive statistics display into an active, engaging tool that provides immediate insights into AI usage patterns. By leveraging efficient rendering techniques and thoughtful UI design, this feature enhances the user experience while maintaining the application's performance and reliability.