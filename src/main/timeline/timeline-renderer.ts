// Canvas-based timeline renderer optimized for Windows system tray constraints

import { createCanvas } from 'canvas';
import {
  TimelineDataPoint,
  AggregatedTimelinePoint,
  TimelineVisualization,
  TimelineConfig,
  PROVIDER_COLORS,
  DEFAULT_TIMELINE_VISUALIZATION,
} from '../../shared/timeline-types';

/**
 * Timeline Renderer for creating canvas-based visualizations
 * Optimized for Windows system tray (16px constraint) and dashboard display
 */
export class TimelineRenderer {
  private config: TimelineVisualization;
  private canvas: any;
  private ctx: any;

  constructor(config?: Partial<TimelineVisualization>) {
    this.config = { ...DEFAULT_TIMELINE_VISUALIZATION, ...config };
    this.canvas = createCanvas(this.config.width, this.config.height);
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Render timeline visualization for system tray (16px constraint)
   * @param dataPoints Timeline data points to render
   * @param timeWindowMs Time window represented
   * @returns Buffer containing PNG image data
   */
  renderMicroTimeline(dataPoints: TimelineDataPoint[], timeWindowMs: number): Buffer {
    const { width, height, padding } = this.config;

    // Clear canvas
    this.ctx.clearRect(0, 0, width, height);

    if (dataPoints.length === 0) {
      return this.canvas.toBuffer('image/png');
    }

    // Calculate drawing area
    const drawWidth = width - (padding * 2);
    const drawHeight = height - (padding * 2);

    // Find max value for scaling
    const maxValue = Math.max(...dataPoints.map(p => p.totalTokens));
    if (maxValue === 0) {
      return this.canvas.toBuffer('image/png');
    }

    // Render based on visualization mode
    switch (this.config.mode) {
      case 'sparkline':
        this.renderSparkline(dataPoints, maxValue, drawWidth, drawHeight, padding);
        break;
      case 'bars':
        this.renderMicroBars(dataPoints, maxValue, drawWidth, drawHeight, padding);
        break;
      case 'area':
        this.renderMicroArea(dataPoints, maxValue, drawWidth, drawHeight, padding);
        break;
      case 'linear':
      default:
        this.renderMicroLine(dataPoints, maxValue, drawWidth, drawHeight, padding);
        break;
    }

    return this.canvas.toBuffer('image/png');
  }

  /**
   * Render full timeline for dashboard display
   * @param dataPoints Aggregated timeline data points
   * @param width Canvas width
   * @param height Canvas height
   * @returns Buffer containing PNG image data
   */
  renderFullTimeline(
    dataPoints: AggregatedTimelinePoint[],
    width: number,
    height: number
  ): Buffer {
    // Resize canvas for full timeline
    this.canvas = createCanvas(width, height);
    this.ctx = this.canvas.getContext('2d');

    const { padding, showGrid, showLabels } = this.config;

    // Clear canvas with background
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, width, height);

    if (dataPoints.length === 0) {
      return this.canvas.toBuffer('image/png');
    }

    // Calculate drawing area
    const drawWidth = width - (padding * 2);
    const drawHeight = height - (padding * 2);
    const labelHeight = showLabels ? 20 : 0;
    const graphHeight = drawHeight - labelHeight;

    // Find max values for scaling
    const maxTokens = Math.max(...dataPoints.map(p => p.totalTokens));
    const maxCost = Math.max(...dataPoints.map(p => p.totalCostUSD));

    // Draw grid if enabled
    if (showGrid) {
      this.drawGrid(padding, padding + labelHeight, drawWidth, graphHeight);
    }

    // Draw labels if enabled
    if (showLabels) {
      this.drawLabels(dataPoints, maxTokens, maxCost, padding, drawWidth, height);
    }

    // Render main visualization
    switch (this.config.mode) {
      case 'area':
        this.renderFullArea(dataPoints, maxTokens, drawWidth, graphHeight, padding, padding + labelHeight);
        break;
      case 'bars':
        this.renderFullBars(dataPoints, maxTokens, drawWidth, graphHeight, padding, padding + labelHeight);
        break;
      case 'sparkline':
        this.renderFullSparkline(dataPoints, maxTokens, drawWidth, graphHeight, padding, padding + labelHeight);
        break;
      case 'linear':
      default:
        this.renderFullLine(dataPoints, maxTokens, drawWidth, graphHeight, padding, padding + labelHeight);
        break;
    }

    return this.canvas.toBuffer('image/png');
  }

  /**
   * Render sparkline visualization for system tray
   */
  private renderSparkline(
    dataPoints: TimelineDataPoint[],
    maxValue: number,
    width: number,
    height: number,
    padding: number
  ): void {
    this.ctx.strokeStyle = '#0066CC';
    this.ctx.lineWidth = 1;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Remove anti-aliasing for crisp 16px rendering
    this.ctx.imageSmoothingEnabled = false;

    this.ctx.beginPath();

    dataPoints.forEach((point, index) => {
      const x = padding + (index / (dataPoints.length - 1)) * width;
      const y = padding + height - (point.totalTokens / maxValue) * height;

      if (index === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    });

    this.ctx.stroke();
  }

  /**
   * Render micro bars for system tray
   */
  private renderMicroBars(
    dataPoints: TimelineDataPoint[],
    maxValue: number,
    width: number,
    height: number,
    padding: number
  ): void {
    this.ctx.fillStyle = '#0066CC';
    this.ctx.imageSmoothingEnabled = false;

    const barWidth = Math.max(1, Math.floor(width / dataPoints.length));
    const gap = dataPoints.length > 1 ? 1 : 0;

    dataPoints.forEach((point, index) => {
      const barHeight = Math.max(1, Math.floor((point.totalTokens / maxValue) * height));
      const x = padding + index * (barWidth + gap);
      const y = padding + height - barHeight;

      this.ctx.fillRect(x, y, barWidth, barHeight);
    });
  }

  /**
   * Render micro area chart for system tray
   */
  private renderMicroArea(
    dataPoints: TimelineDataPoint[],
    maxValue: number,
    width: number,
    height: number,
    padding: number
  ): void {
    // Draw area fill
    this.ctx.fillStyle = 'rgba(0, 102, 204, 0.6)';
    this.ctx.imageSmoothingEnabled = false;

    this.ctx.beginPath();
    this.ctx.moveTo(padding, padding + height);

    dataPoints.forEach((point, index) => {
      const x = padding + (index / (dataPoints.length - 1)) * width;
      const y = padding + height - (point.totalTokens / maxValue) * height;

      this.ctx.lineTo(x, y);
    });

    this.ctx.lineTo(padding + width, padding + height);
    this.ctx.closePath();
    this.ctx.fill();

    // Draw line on top
    this.ctx.strokeStyle = '#0066CC';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();

    dataPoints.forEach((point, index) => {
      const x = padding + (index / (dataPoints.length - 1)) * width;
      const y = padding + height - (point.totalTokens / maxValue) * height;

      if (index === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    });

    this.ctx.stroke();
  }

  /**
   * Render micro line chart for system tray
   */
  private renderMicroLine(
    dataPoints: TimelineDataPoint[],
    maxValue: number,
    width: number,
    height: number,
    padding: number
  ): void {
    this.ctx.strokeStyle = '#0066CC';
    this.ctx.lineWidth = 1;
    this.ctx.lineCap = 'round';
    this.ctx.imageSmoothingEnabled = false;

    this.ctx.beginPath();

    dataPoints.forEach((point, index) => {
      const x = padding + (index / (dataPoints.length - 1)) * width;
      const y = padding + height - (point.totalTokens / maxValue) * height;

      if (index === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    });

    this.ctx.stroke();

    // Draw data points if there are few enough
    if (dataPoints.length <= 8) {
      this.ctx.fillStyle = '#0066CC';
      dataPoints.forEach((point, index) => {
        const x = padding + (index / (dataPoints.length - 1)) * width;
        const y = padding + height - (point.totalTokens / maxValue) * height;

        this.ctx.beginPath();
        this.ctx.arc(x, y, 1, 0, 2 * Math.PI);
        this.ctx.fill();
      });
    }
  }

  /**
   * Render full area chart with provider breakdown
   */
  private renderFullArea(
    dataPoints: AggregatedTimelinePoint[],
    maxValue: number,
    width: number,
    height: number,
    x: number,
    y: number
  ): void {
    // Get unique providers
    const providers = new Set<string>();
    dataPoints.forEach(point => {
      Object.keys(point.providerData).forEach(provider => providers.add(provider));
    });

    const providerArray = Array.from(providers);

    // Draw stacked areas
    providerArray.forEach((provider, providerIndex) => {
      this.ctx.fillStyle = PROVIDER_COLORS[provider] || PROVIDER_COLORS.default;
      this.ctx.globalAlpha = 0.7;

      this.ctx.beginPath();
      this.ctx.moveTo(x, y + height);

      dataPoints.forEach((point, index) => {
        const dataX = x + (index / (dataPoints.length - 1)) * width;
        const providerTokens = point.providerData[provider]?.tokens || 0;
        const dataY = y + height - (providerTokens / maxValue) * height;

        this.ctx.lineTo(dataX, dataY);
      });

      this.ctx.lineTo(x + width, y + height);
      this.ctx.closePath();
      this.ctx.fill();
    });

    this.ctx.globalAlpha = 1.0;

    // Draw border line
    this.ctx.strokeStyle = '#333333';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, width, height);
  }

  /**
   * Render full bar chart
   */
  private renderFullBars(
    dataPoints: AggregatedTimelinePoint[],
    maxValue: number,
    width: number,
    height: number,
    x: number,
    y: number
  ): void {
    const barWidth = Math.max(2, Math.floor(width / dataPoints.length) - 1);
    const gap = 1;

    dataPoints.forEach((point, index) => {
      const barHeight = (point.totalTokens / maxValue) * height;
      const barX = x + index * (barWidth + gap);
      const barY = y + height - barHeight;

      // Draw bar with gradient effect
      const gradient = this.ctx.createLinearGradient(0, barY, 0, barY + barHeight);
      gradient.addColorStop(0, '#0066CC');
      gradient.addColorStop(1, '#004499');

      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(barX, barY, barWidth, barHeight);
    });
  }

  /**
   * Render full sparkline
   */
  private renderFullSparkline(
    dataPoints: AggregatedTimelinePoint[],
    maxValue: number,
    width: number,
    height: number,
    x: number,
    y: number
  ): void {
    this.ctx.strokeStyle = '#0066CC';
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.beginPath();

    dataPoints.forEach((point, index) => {
      const dataX = x + (index / (dataPoints.length - 1)) * width;
      const dataY = y + height - (point.totalTokens / maxValue) * height;

      if (index === 0) {
        this.ctx.moveTo(dataX, dataY);
      } else {
        this.ctx.lineTo(dataX, dataY);
      }
    });

    this.ctx.stroke();

    // Highlight peaks and valleys
    const maxPoint = dataPoints.reduce((max, point) =>
      point.totalTokens > max.totalTokens ? point : max, dataPoints[0]);
    const minPoint = dataPoints.reduce((min, point) =>
      point.totalTokens < min.totalTokens ? point : min, dataPoints[0]);

    // Draw max point
    const maxX = x + (dataPoints.indexOf(maxPoint) / (dataPoints.length - 1)) * width;
    const maxY = y + height - (maxPoint.totalTokens / maxValue) * height;

    this.ctx.fillStyle = '#00CC66';
    this.ctx.beginPath();
    this.ctx.arc(maxX, maxY, 3, 0, 2 * Math.PI);
    this.ctx.fill();

    // Draw min point
    const minX = x + (dataPoints.indexOf(minPoint) / (dataPoints.length - 1)) * width;
    const minY = y + height - (minPoint.totalTokens / maxValue) * height;

    this.ctx.fillStyle = '#FF6B6B';
    this.ctx.beginPath();
    this.ctx.arc(minX, minY, 3, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  /**
   * Render full line chart with smoothing
   */
  private renderFullLine(
    dataPoints: AggregatedTimelinePoint[],
    maxValue: number,
    width: number,
    height: number,
    x: number,
    y: number
  ): void {
    this.ctx.strokeStyle = '#0066CC';
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.beginPath();

    if (this.config.smoothing && dataPoints.length > 2) {
      // Smooth curve using quadratic bezier curves
      this.ctx.moveTo(x, y + height - (dataPoints[0].totalTokens / maxValue) * height);

      for (let i = 1; i < dataPoints.length - 1; i++) {
        const xCurrent = x + (i / (dataPoints.length - 1)) * width;
        const yCurrent = y + height - (dataPoints[i].totalTokens / maxValue) * height;
        const xNext = x + ((i + 1) / (dataPoints.length - 1)) * width;
        const yNext = y + height - (dataPoints[i + 1].totalTokens / maxValue) * height;

        const xControl = xCurrent;
        const yControl = yCurrent;

        this.ctx.quadraticCurveTo(xControl, yControl, (xCurrent + xNext) / 2, (yCurrent + yNext) / 2);
      }

      // Draw last point
      const lastIndex = dataPoints.length - 1;
      const lastX = x + (lastIndex / (dataPoints.length - 1)) * width;
      const lastY = y + height - (dataPoints[lastIndex].totalTokens / maxValue) * height;
      this.ctx.lineTo(lastX, lastY);
    } else {
      // Straight lines
      dataPoints.forEach((point, index) => {
        const dataX = x + (index / (dataPoints.length - 1)) * width;
        const dataY = y + height - (point.totalTokens / maxValue) * height;

        if (index === 0) {
          this.ctx.moveTo(dataX, dataY);
        } else {
          this.ctx.lineTo(dataX, dataY);
        }
      });
    }

    this.ctx.stroke();

    // Draw data points
    this.ctx.fillStyle = '#0066CC';
    dataPoints.forEach((point, index) => {
      const dataX = x + (index / (dataPoints.length - 1)) * width;
      const dataY = y + height - (point.totalTokens / maxValue) * height;

      this.ctx.beginPath();
      this.ctx.arc(dataX, dataY, 2, 0, 2 * Math.PI);
      this.ctx.fill();
    });
  }

  /**
   * Draw grid lines
   */
  private drawGrid(x: number, y: number, width: number, height: number): void {
    this.ctx.strokeStyle = '#e0e0e0';
    this.ctx.lineWidth = 0.5;

    // Horizontal lines
    for (let i = 0; i <= 4; i++) {
      const gridY = y + (i / 4) * height;
      this.ctx.beginPath();
      this.ctx.moveTo(x, gridY);
      this.ctx.lineTo(x + width, gridY);
      this.ctx.stroke();
    }

    // Vertical lines
    for (let i = 0; i <= 8; i++) {
      const gridX = x + (i / 8) * width;
      this.ctx.beginPath();
      this.ctx.moveTo(gridX, y);
      this.ctx.lineTo(gridX, y + height);
      this.ctx.stroke();
    }
  }

  /**
   * Draw axis labels
   */
  private drawLabels(
    dataPoints: AggregatedTimelinePoint[],
    maxTokens: number,
    maxCost: number,
    padding: number,
    width: number,
    height: number
  ): void {
    this.ctx.fillStyle = '#666666';
    this.ctx.font = '10px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'bottom';

    // Y-axis labels (tokens)
    const yLabels = 5;
    for (let i = 0; i <= yLabels; i++) {
      const value = (maxTokens * (yLabels - i)) / yLabels;
      const label = this.formatNumber(value);
      const y = padding + 10 + (i / yLabels) * (height - padding * 2 - 10);

      this.ctx.fillText(label, padding - 5, y);
    }

    // X-axis labels (time)
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';

    const timeLabels = 4;
    for (let i = 0; i <= timeLabels; i++) {
      const index = Math.floor((i / timeLabels) * (dataPoints.length - 1));
      const point = dataPoints[index];

      if (point) {
        const timeStr = this.formatTime(point.timestamp);
        const x = padding + (i / timeLabels) * (width - padding * 2);
        const y = height - padding + 5;

        this.ctx.fillText(timeStr, x, y);
      }
    }
  }

  /**
   * Format large numbers with abbreviations
   */
  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    } else {
      return Math.round(num).toString();
    }
  }

  /**
   * Format time for labels
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Update rendering configuration
   */
  updateConfig(newConfig: Partial<TimelineVisualization>): void {
    this.config = { ...this.config, ...newConfig };

    // Recreate canvas if size changed
    if (newConfig.width || newConfig.height) {
      this.canvas = createCanvas(this.config.width, this.config.height);
      this.ctx = this.canvas.getContext('2d');
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): TimelineVisualization {
    return { ...this.config };
  }
}