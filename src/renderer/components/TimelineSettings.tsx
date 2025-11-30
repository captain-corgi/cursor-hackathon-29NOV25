import React, { useState, useEffect } from 'react';
import { AppSettings } from '../../shared/types';

interface TimelineConfig {
  enabled: boolean;
  timeWindow: number;
  visualizationMode: 'linear' | 'area' | 'bars' | 'sparkline';
  providerColors: Record<string, string>;
}

interface TimelineSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
}

const TIME_WINDOWS = [
  { name: '1h', value: 60 * 60 * 1000, label: '1 Hour' },
  { name: '6h', value: 6 * 60 * 60 * 1000, label: '6 Hours' },
  { name: '24h', value: 24 * 60 * 60 * 1000, label: '1 Day' },
  { name: '7d', value: 7 * 24 * 60 * 60 * 1000, label: '7 Days' },
  { name: '30d', value: 30 * 24 * 60 * 60 * 1000, label: '30 Days' },
];

const VISUALIZATION_MODES = [
  { value: 'area', label: 'Area Chart', description: 'Filled area chart with provider breakdown' },
  { value: 'linear', label: 'Line Chart', description: 'Connected points with smooth lines' },
  { value: 'bars', label: 'Bar Chart', description: 'Vertical bars for each time point' },
  { value: 'sparkline', label: 'Sparkline', description: 'Minimal line chart with peak highlighting' },
];

const DEFAULT_PROVIDER_COLORS = {
  'claude-code': '#FF6B35',
  'cursor': '#0066CC',
  'github-copilot': '#24292E',
  'openai': '#10A37F',
  'anthropic': '#D97757',
  'google': '#4285F4',
  'microsoft': '#00BCF2',
};

const TimelineSettings: React.FC<TimelineSettingsProps> = ({ settings, onSettingsChange }) => {
  const [localConfig, setLocalConfig] = useState<TimelineConfig>({
    enabled: settings.timelineEnabled,
    timeWindow: settings.timelineTimeWindow,
    visualizationMode: settings.timelineVisualizationMode,
    providerColors: settings.timelineProviderColors,
  });

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    advanced: false,
    colors: false,
  });

  // Update local config when settings change
  useEffect(() => {
    setLocalConfig({
      enabled: settings.timelineEnabled,
      timeWindow: settings.timelineTimeWindow,
      visualizationMode: settings.timelineVisualizationMode,
      providerColors: settings.timelineProviderColors,
    });
  }, [settings]);

  const handleConfigChange = (updates: Partial<TimelineConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);

    // Convert to AppSettings format and notify parent
    const settingsUpdates: Partial<AppSettings> = {};
    if ('enabled' in updates) settingsUpdates.timelineEnabled = updates.enabled;
    if ('timeWindow' in updates) settingsUpdates.timelineTimeWindow = updates.timeWindow;
    if ('visualizationMode' in updates) settingsUpdates.timelineVisualizationMode = updates.visualizationMode;
    if ('providerColors' in updates) settingsUpdates.timelineProviderColors = updates.providerColors;

    onSettingsChange(settingsUpdates);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const resetToDefaults = () => {
    handleConfigChange({
      enabled: true,
      timeWindow: TIME_WINDOWS[1].value, // 6 hours
      visualizationMode: 'area',
      providerColors: DEFAULT_PROVIDER_COLORS,
    });
  };

  const resetProviderColors = () => {
    handleConfigChange({
      providerColors: DEFAULT_PROVIDER_COLORS,
    });
  };

  return (
    <div className="timeline-settings">
      <div className="settings-section">
        <div className="section-header" onClick={() => toggleSection('basic')}>
          <h3 className="section-title">Basic Timeline Settings</h3>
          <span className={`expand-icon ${expandedSections.basic ? 'expanded' : ''}`}>
            ▼
          </span>
        </div>

        {expandedSections.basic && (
          <div className="section-content">
            {/* Enable Timeline */}
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={localConfig.enabled}
                  onChange={(e) => handleConfigChange({ enabled: e.target.checked })}
                />
                <span className="checkmark"></span>
                <div className="label-content">
                  <span className="label-text">Enable Timeline Visualization</span>
                  <span className="label-description">
                    Show real-time usage timeline in system tray and dashboard
                  </span>
                </div>
              </label>
            </div>

            {/* Time Window */}
            <div className="form-group">
              <label className="label">
                Default Time Window
                <span className="label-description">
                  Time period displayed by default in timeline views
                </span>
              </label>
              <select
                value={localConfig.timeWindow}
                onChange={(e) => handleConfigChange({ timeWindow: Number(e.target.value) })}
                className="select"
                disabled={!localConfig.enabled}
              >
                {TIME_WINDOWS.map(window => (
                  <option key={window.name} value={window.value}>
                    {window.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Visualization Mode */}
            <div className="form-group">
              <label className="label">
                Visualization Mode
                <span className="label-description">
                  Default chart style for timeline visualization
                </span>
              </label>
              <div className="radio-group">
                {VISUALIZATION_MODES.map(mode => (
                  <label key={mode.value} className="radio-label">
                    <input
                      type="radio"
                      name="visualization-mode"
                      value={mode.value}
                      checked={localConfig.visualizationMode === mode.value}
                      onChange={(e) => handleConfigChange({
                        visualizationMode: e.target.value as TimelineConfig['visualizationMode']
                      })}
                      disabled={!localConfig.enabled}
                    />
                    <span className="radio-checkmark"></span>
                    <div className="radio-content">
                      <span className="radio-text">{mode.label}</span>
                      <span className="radio-description">{mode.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="settings-section">
        <div className="section-header" onClick={() => toggleSection('colors')}>
          <h3 className="section-title">Provider Colors</h3>
          <span className={`expand-icon ${expandedSections.colors ? 'expanded' : ''}`}>
            ▼
          </span>
        </div>

        {expandedSections.colors && (
          <div className="section-content">
            <div className="provider-colors-header">
              <span>Customize colors for each AI provider</span>
              <button
                className="btn btn-secondary"
                onClick={resetProviderColors}
                disabled={!localConfig.enabled}
              >
                Reset to Defaults
              </button>
            </div>

            <div className="provider-colors-grid">
              {Object.entries(localConfig.providerColors).map(([provider, color]) => (
                <div key={provider} className="provider-color-item">
                  <label className="color-label">
                    <span className="provider-name">{provider}</span>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => handleConfigChange({
                          providerColors: {
                            ...localConfig.providerColors,
                            [provider]: e.target.value
                          }
                        })}
                        disabled={!localConfig.enabled}
                        className="color-input"
                      />
                      <input
                        type="text"
                        value={color}
                        onChange={(e) => handleConfigChange({
                          providerColors: {
                            ...localConfig.providerColors,
                            [provider]: e.target.value
                          }
                        })}
                        disabled={!localConfig.enabled}
                        className="color-text"
                        placeholder="#000000"
                      />
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="settings-section">
        <div className="section-header" onClick={() => toggleSection('advanced')}>
          <h3 className="section-title">Advanced Options</h3>
          <span className={`expand-icon ${expandedSections.advanced ? 'expanded' : ''}`}>
            ▼
          </span>
        </div>

        {expandedSections.advanced && (
          <div className="section-content">
            <div className="advanced-info">
              <h4>Timeline Performance Information</h4>
              <p>
                Timeline data is stored in memory for fast access. The system automatically manages
                memory usage and removes old data according to retention policies.
              </p>

              <div className="info-grid">
                <div className="info-item">
                  <div className="info-label">Max Data Points</div>
                  <div className="info-value">200 points</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Update Frequency</div>
                  <div className="info-value">Every 60 seconds</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Tray Update</div>
                  <div className="info-value">Every 30 seconds</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Data Retention</div>
                  <div className="info-value">30 days</div>
                </div>
              </div>
            </div>

            <div className="reset-section">
              <h4>Reset Options</h4>
              <div className="reset-buttons">
                <button
                  className="btn btn-secondary"
                  onClick={resetToDefaults}
                >
                  Reset All Settings
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    // Clear timeline data would need to be implemented
                    if (window.electronAPI) {
                      // This would require a new IPC handler for clearing timeline data
                      console.log('Clear timeline data requested');
                    }
                  }}
                  disabled={!localConfig.enabled}
                >
                  Clear Timeline Data
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelineSettings;