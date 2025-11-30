import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AggregatedTimelinePoint, TimelineAnalytics, TimelineConfig } from '../../shared/timeline-types';

interface FullTimelineProps {
  className?: string;
}

const TIME_WINDOWS = [
  { name: '1h', value: 60 * 60 * 1000, label: '1 Hour' },
  { name: '6h', value: 6 * 60 * 60 * 1000, label: '6 Hours' },
  { name: '24h', value: 24 * 60 * 60 * 1000, label: '1 Day' },
  { name: '7d', value: 7 * 24 * 60 * 60 * 1000, label: '7 Days' },
  { name: '30d', value: 30 * 24 * 60 * 60 * 1000, label: '30 Days' },
];

const VISUALIZATION_MODES = [
  { value: 'area', label: 'Area Chart' },
  { value: 'linear', label: 'Line Chart' },
  { value: 'bars', label: 'Bar Chart' },
  { value: 'sparkline', label: 'Sparkline' },
];

const FullTimeline: React.FC<FullTimelineProps> = ({ className = '' }) => {
  const [data, setData] = useState<AggregatedTimelinePoint[]>([]);
  const [config, setConfig] = useState<TimelineConfig | null>(null);
  const [analytics, setAnalytics] = useState<TimelineAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTimeWindow, setCurrentTimeWindow] = useState(TIME_WINDOWS[1].value); // 6 hours default
  const [showProviders, setShowProviders] = useState<Record<string, boolean>>({});
  const [hoveredPoint, setHoveredPoint] = useState<AggregatedTimelinePoint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load initial data
  const loadData = useCallback(async () => {
    if (!window.electronAPI) return;

    try {
      setLoading(true);
      setError(null);

      const [timelineData, timelineConfig, timelineAnalytics] = await Promise.all([
        window.electronAPI.getTimelineData(currentTimeWindow, 200),
        window.electronAPI.getTimelineConfig(),
        window.electronAPI.getTimelineAnalytics(currentTimeWindow),
      ]);

      setData(timelineData || []);
      setConfig(timelineConfig);
      setAnalytics(timelineAnalytics);

      // Initialize provider visibility
      if (timelineData.length > 0) {
        const providers = new Set<string>();
        timelineData.forEach(point => {
          Object.keys(point.providerData).forEach(provider => providers.add(provider));
        });

        const initialVisibility: Record<string, boolean> = {};
        providers.forEach(provider => {
          initialVisibility[provider] = true;
        });
        setShowProviders(initialVisibility);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline data');
    } finally {
      setLoading(false);
    }
  }, [currentTimeWindow]);

  // Update configuration
  const updateConfig = useCallback(async (newConfig: Partial<TimelineConfig>) => {
    if (!window.electronAPI || !config) return;

    try {
      const updatedConfig = { ...config, ...newConfig };
      await window.electronAPI.setTimelineConfig(updatedConfig);
      setConfig(updatedConfig);
    } catch (err) {
      // Error updating config
    }
  }, [config]);

  // Export timeline
  const exportTimeline = useCallback(async (format: 'png' | 'csv' | 'json') => {
    if (!window.electronAPI) return;

    try {
      const exportOptions = {
        format,
        timeWindowMs: currentTimeWindow,
        includeBreakdown: true,
        resolution: 200,
        quality: 0.9,
      };

      const result = await window.electronAPI.exportTimeline(exportOptions);

      if (format === 'png') {
        // Handle buffer for PNG export
        const blob = new Blob([result as Buffer], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timeline-${new Date().toISOString().split('T')[0]}.png`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Handle text exports
        const blob = new Blob([result as string], {
          type: format === 'csv' ? 'text/csv' : 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timeline-${new Date().toISOString().split('T')[0]}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Error exporting timeline:', err);
    }
  }, [currentTimeWindow]);

  // Draw timeline on canvas
  const drawTimeline = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = 400;

    const padding = 40;
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Find max values
    const maxTokens = Math.max(...data.map(p => p.totalTokens));
    const maxCost = Math.max(...data.map(p => p.totalCostUSD));

    // Draw grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;

    for (let i = 0; i <= 5; i++) {
      const y = padding + (i / 5) * height;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + width, y);
      ctx.stroke();
    }

    // Get active providers
    const activeProviders = Object.keys(showProviders).filter(p => showProviders[p]);

    // Draw timeline based on visualization mode
    if (config && activeProviders.length > 0) {
      switch (config.visualizationMode) {
        case 'area':
          drawAreaChart(ctx, data, activeProviders, maxTokens, padding, width, height);
          break;
        case 'bars':
          drawBarChart(ctx, data, maxTokens, padding, width, height);
          break;
        case 'linear':
          drawLineChart(ctx, data, maxTokens, padding, width, height);
          break;
        case 'sparkline':
          drawSparkline(ctx, data, maxTokens, padding, width, height);
          break;
      }
    }

    // Draw axes labels
    ctx.fillStyle = '#666666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    // Y-axis labels (tokens)
    for (let i = 0; i <= 5; i++) {
      const value = (maxTokens * (5 - i)) / 5;
      const label = formatNumber(value);
      const y = padding + (i / 5) * height;
      ctx.fillText(label, padding - 5, y);
    }

    // X-axis labels (time)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const timeLabels = 5;
    for (let i = 0; i <= timeLabels; i++) {
      const index = Math.floor((i / timeLabels) * (data.length - 1));
      const point = data[index];
      if (point) {
        const timeStr = formatTime(point.timestamp);
        const x = padding + (i / timeLabels) * width;
        const y = padding + height + 5;
        ctx.fillText(timeStr, x, y);
      }
    }
  }, [data, config, showProviders]);

  // Drawing functions
  const drawAreaChart = (ctx: CanvasRenderingContext2D, data: AggregatedTimelinePoint[],
    providers: string[], maxTokens: number, padding: number, width: number, height: number) => {

    providers.forEach((provider, providerIndex) => {
      ctx.fillStyle = config?.providerColors[provider] || '#0066CC';
      ctx.globalAlpha = 0.6;

      ctx.beginPath();
      ctx.moveTo(padding, padding + height);

      data.forEach((point, index) => {
        const x = padding + (index / (data.length - 1)) * width;
        const providerTokens = point.providerData[provider]?.tokens || 0;
        const y = padding + height - (providerTokens / maxTokens) * height;
        ctx.lineTo(x, y);
      });

      ctx.lineTo(padding + width, padding + height);
      ctx.closePath();
      ctx.fill();
    });

    ctx.globalAlpha = 1.0;
  };

  const drawBarChart = (ctx: CanvasRenderingContext2D, data: AggregatedTimelinePoint[],
    maxTokens: number, padding: number, width: number, height: number) => {

    const barWidth = Math.max(2, (width / data.length) - 1);

    data.forEach((point, index) => {
      const barHeight = (point.totalTokens / maxTokens) * height;
      const x = padding + index * (width / data.length);
      const y = padding + height - barHeight;

      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
      gradient.addColorStop(0, '#0066CC');
      gradient.addColorStop(1, '#004499');

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);
    });
  };

  const drawLineChart = (ctx: CanvasRenderingContext2D, data: AggregatedTimelinePoint[],
    maxTokens: number, padding: number, width: number, height: number) => {

    ctx.strokeStyle = '#0066CC';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    data.forEach((point, index) => {
      const x = padding + (index / (data.length - 1)) * width;
      const y = padding + height - (point.totalTokens / maxTokens) * height;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw data points
    ctx.fillStyle = '#0066CC';
    data.forEach((point, index) => {
      const x = padding + (index / (data.length - 1)) * width;
      const y = padding + height - (point.totalTokens / maxTokens) * height;

      ctx.beginPath();
      ctx.arc(x, y, 2, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  const drawSparkline = (ctx: CanvasRenderingContext2D, data: AggregatedTimelinePoint[],
    maxTokens: number, padding: number, width: number, height: number) => {

    ctx.strokeStyle = '#0066CC';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    data.forEach((point, index) => {
      const x = padding + (index / (data.length - 1)) * width;
      const y = padding + height - (point.totalTokens / maxTokens) * height;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Highlight peak
    const maxPoint = data.reduce((max, point) =>
      point.totalTokens > max.totalTokens ? point : max, data[0]);

    const maxX = padding + (data.indexOf(maxPoint) / (data.length - 1)) * width;
    const maxY = padding + height - (maxPoint.totalTokens / maxTokens) * height;

    ctx.fillStyle = '#00CC66';
    ctx.beginPath();
    ctx.arc(maxX, maxY, 3, 0, 2 * Math.PI);
    ctx.fill();
  };

  // Utility functions
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return Math.round(num).toString();
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatCurrency = (amount: number): string => {
    return `$${amount.toFixed(2)}`;
  };

  // Effects
  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleTimelineUpdate = () => {
      loadData();
    };

    if (window.electronAPI) {
      const unsubscribe = window.electronAPI.onTimelineUpdated(handleTimelineUpdate);
      return unsubscribe;
    }
  }, [loadData]);

  useEffect(() => {
    drawTimeline();
  }, [drawTimeline]);

  useEffect(() => {
    const handleResize = () => {
      drawTimeline();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawTimeline]);

  if (loading) {
    return (
      <div className={`card ${className}`}>
        <div className="card-header">
          <h2>Timeline Visualization</h2>
        </div>
        <div className="card-body">
          <div className="empty-state">
            <div className="empty-state-icon animate-pulse">⏳</div>
            <div className="empty-state-title">Loading timeline...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`card ${className}`}>
        <div className="card-header">
          <h2>Timeline Visualization</h2>
        </div>
        <div className="card-body">
          <div className="empty-state">
            <div className="empty-state-icon">❌</div>
            <div className="empty-state-title">Error loading timeline</div>
            <div className="empty-state-description">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card ${className}`}>
      <div className="card-header">
        <div className="section-header">
          <h2 className="section-title">Timeline Visualization</h2>
          <div className="timeline-controls">
            {/* Time window selector */}
            <div className="timeline-controls-group">
              <label>Time Window:</label>
              <select
                value={currentTimeWindow}
                onChange={(e) => setCurrentTimeWindow(Number(e.target.value))}
                className="select"
              >
                {TIME_WINDOWS.map(window => (
                  <option key={window.name} value={window.value}>
                    {window.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Visualization mode selector */}
            <div className="timeline-controls-group">
              <label>Mode:</label>
              <select
                value={config?.visualizationMode || 'area'}
                onChange={(e) => updateConfig({
                  visualizationMode: e.target.value as TimelineConfig['visualizationMode']
                })}
                className="select"
              >
                {VISUALIZATION_MODES.map(mode => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Export buttons */}
            <div className="timeline-controls-group">
              <label>Export:</label>
              <div className="btn-group">
                <button
                  className="btn btn-secondary"
                  onClick={() => exportTimeline('png')}
                  title="Export as PNG"
                >
                  📷 PNG
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => exportTimeline('csv')}
                  title="Export as CSV"
                >
                  📊 CSV
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => exportTimeline('json')}
                  title="Export as JSON"
                >
                  📄 JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card-body">
        {/* Analytics summary */}
        {analytics && (
          <div className="timeline-analytics">
            <div className="analytics-grid">
              <div className="analytics-item">
                <div className="analytics-label">Avg Usage Rate</div>
                <div className="analytics-value">{formatNumber(analytics.averageUsageRate)} tokens/min</div>
              </div>
              <div className="analytics-item">
                <div className="analytics-label">Growth Rate</div>
                <div className={`analytics-value ${analytics.growthRate > 0 ? 'positive' : analytics.growthRate < 0 ? 'negative' : ''}`}>
                  {analytics.growthRate > 0 ? '+' : ''}{analytics.growthRate.toFixed(1)}%
                </div>
              </div>
              {analytics.prediction && (
                <div className="analytics-item">
                  <div className="analytics-label">Next Hour (est.)</div>
                  <div className="analytics-value">{formatNumber(analytics.prediction.nextHourTokens)} tokens</div>
                </div>
              )}
              <div className="analytics-item">
                <div className="analytics-label">Trend</div>
                <div className={`analytics-value trend-${analytics.trends.direction}`}>
                  {analytics.trends.direction === 'increasing' ? '📈' :
                   analytics.trends.direction === 'decreasing' ? '📉' : '➡️'}
                  {' '}{analytics.trends.direction}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timeline canvas */}
        <div className="timeline-canvas-container" ref={containerRef}>
          <canvas
            ref={canvasRef}
            className="timeline-canvas"
            onMouseMove={(e) => {
              const rect = canvasRef.current?.getBoundingClientRect();
              if (!rect || data.length === 0) return;

              const x = e.clientX - rect.left;
              const index = Math.floor((x / rect.width) * data.length);

              if (index >= 0 && index < data.length) {
                setHoveredPoint(data[index]);
              }
            }}
            onMouseLeave={() => setHoveredPoint(null)}
          />
        </div>

        {/* Provider toggle */}
        {Object.keys(showProviders).length > 1 && (
          <div className="provider-toggles">
            <div className="provider-toggles-title">Show Providers:</div>
            <div className="provider-toggles-list">
              {Object.entries(showProviders).map(([provider, isVisible]) => (
                <label key={provider} className="provider-toggle">
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={(e) => setShowProviders(prev => ({
                      ...prev,
                      [provider]: e.target.checked
                    }))}
                  />
                  <span
                    className="provider-color"
                    style={{ backgroundColor: config?.providerColors[provider] || '#0066CC' }}
                  />
                  {provider}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Hover tooltip */}
        {hoveredPoint && (
          <div className="timeline-tooltip">
            <div className="tooltip-header">
              {formatTime(hoveredPoint.timestamp)}
            </div>
            <div className="tooltip-content">
              <div className="tooltip-row">
                <span>Tokens:</span>
                <span>{formatNumber(hoveredPoint.totalTokens)}</span>
              </div>
              <div className="tooltip-row">
                <span>Cost:</span>
                <span>{formatCurrency(hoveredPoint.totalCostUSD)}</span>
              </div>
              <div className="tooltip-row">
                <span>Requests:</span>
                <span>{hoveredPoint.entryCount}</span>
              </div>
              {Object.entries(hoveredPoint.providerData).map(([provider, data]) => (
                <div key={provider} className="tooltip-row provider-row">
                  <span
                    className="provider-indicator"
                    style={{ backgroundColor: config?.providerColors[provider] || '#0066CC' }}
                  />
                  <span>{provider}:</span>
                  <span>{formatNumber(data.tokens)} tokens</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FullTimeline;