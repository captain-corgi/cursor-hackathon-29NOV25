import React, { useState, useEffect, useCallback } from 'react';
import { AppSettings, DEFAULT_SETTINGS } from '../../shared/types';

interface ProviderInfo {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  supported: boolean;
}

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load settings and providers
  const loadData = useCallback(async () => {
    try {
      if (window.electronAPI) {
        const [loadedSettings, loadedProviders] = await Promise.all([
          window.electronAPI.getSettings(),
          window.electronAPI.getProviders(),
        ]);
        setSettings(loadedSettings);
        setProviders(loadedProviders);
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save settings
  const handleSave = async () => {
    setSaving(true);
    try {
      if (window.electronAPI) {
        await window.electronAPI.saveSettings(settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e) {
      console.error('Error saving settings:', e);
    } finally {
      setSaving(false);
    }
  };

  // Toggle provider
  const toggleProvider = async (providerId: string) => {
    const newEnabled = settings.enabledProviders.includes(providerId)
      ? settings.enabledProviders.filter((id) => id !== providerId)
      : [...settings.enabledProviders, providerId];

    setSettings((prev) => ({
      ...prev,
      enabledProviders: newEnabled,
    }));

    // Also update provider in main process
    if (window.electronAPI) {
      await window.electronAPI.toggleProvider(
        providerId,
        newEnabled.includes(providerId)
      );
    }
  };

  if (loading) {
    return (
      <div className="settings">
        <header className="header">
          <h1>
            <div className="header-icon">⚙</div>
            Settings
          </h1>
        </header>
        <main className="container">
          <div className="empty-state">
            <div className="empty-state-icon animate-pulse">⏳</div>
            <div className="empty-state-title">Loading...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="settings">
      {/* Header */}
      <header className="header">
        <h1>
          <div className="header-icon">⚙</div>
          Settings
        </h1>
      </header>

      {/* Main Content */}
      <main className="container">
        {/* General Settings */}
        <section className="section">
          <h2 className="section-title" style={{ marginBottom: '1rem' }}>
            General
          </h2>

          {/* Refresh Interval */}
          <div className="form-group">
            <label className="form-label">Refresh Interval</label>
            <select
              className="form-input"
              value={settings.refreshIntervalSeconds}
              onChange={(e) =>
                setSettings({ ...settings, refreshIntervalSeconds: Number(e.target.value) })
              }
            >
              <option value={60}>Every minute</option>
              <option value={120}>Every 2 minutes</option>
              <option value={300}>Every 5 minutes</option>
              <option value={600}>Every 10 minutes</option>
              <option value={1800}>Every 30 minutes</option>
              <option value={3600}>Every hour</option>
            </select>
            <p className="form-description">How often to refresh usage data from files</p>
          </div>

          {/* Display Format */}
          <div className="form-group">
            <label className="form-label">Display Format</label>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button
                className={`tab ${settings.displayFormat === 'cost' ? 'active' : ''}`}
                onClick={() => setSettings({ ...settings, displayFormat: 'cost' })}
              >
                💰 Cost (USD)
              </button>
              <button
                className={`tab ${settings.displayFormat === 'tokens' ? 'active' : ''}`}
                onClick={() => setSettings({ ...settings, displayFormat: 'tokens' })}
              >
                🔢 Tokens
              </button>
            </div>
            <p className="form-description">What to show in the menu bar tooltip</p>
          </div>

          {/* Launch at Login */}
          <div
            className="toggle"
            onClick={() => setSettings({ ...settings, launchAtLogin: !settings.launchAtLogin })}
          >
            <div className="toggle-info">
              <div className="toggle-label">Launch at Login</div>
              <div className="toggle-description">Start automatically when you log in</div>
            </div>
            <div className={`toggle-switch ${settings.launchAtLogin ? 'active' : ''}`}></div>
          </div>
        </section>

        {/* Alerts */}
        <section className="section">
          <h2 className="section-title" style={{ marginBottom: '1rem' }}>
            Alerts
          </h2>

          {/* Enable Alerts */}
          <div
            className="toggle"
            onClick={() =>
              setSettings({ ...settings, usageAlertEnabled: !settings.usageAlertEnabled })
            }
            style={{ marginBottom: settings.usageAlertEnabled ? '1rem' : 0 }}
          >
            <div className="toggle-info">
              <div className="toggle-label">Usage Alerts</div>
              <div className="toggle-description">
                Get notified when daily cost exceeds threshold
              </div>
            </div>
            <div
              className={`toggle-switch ${settings.usageAlertEnabled ? 'active' : ''}`}
            ></div>
          </div>

          {/* Threshold */}
          {settings.usageAlertEnabled && (
            <div className="form-group animate-fade-in">
              <label className="form-label">Daily Cost Threshold</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--accent-success)', fontWeight: 600 }}>$</span>
                <input
                  type="number"
                  className="form-input"
                  value={settings.usageAlertThreshold}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      usageAlertThreshold: Math.max(1, Number(e.target.value)),
                    })
                  }
                  min={1}
                  max={1000}
                  step={1}
                  style={{ width: '120px' }}
                />
              </div>
              <p className="form-description">Alert when daily usage exceeds this amount</p>
            </div>
          )}
        </section>

        {/* Providers */}
        <section className="section">
          <h2 className="section-title" style={{ marginBottom: '1rem' }}>
            Providers
          </h2>

          {providers.map((provider) => (
            <div
              key={provider.id}
              className="toggle"
              onClick={() => toggleProvider(provider.id)}
              style={{ marginBottom: '0.75rem', opacity: provider.supported ? 1 : 0.6 }}
            >
              <div className="toggle-info">
                <div className="toggle-label">
                  <span
                    className={`provider-badge ${
                      provider.id === 'claude-code' ? 'claude' : 'cursor'
                    }`}
                    style={{ marginRight: '0.5rem' }}
                  >
                    {provider.name}
                  </span>
                  {!provider.supported && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        marginLeft: '0.25rem',
                      }}
                    >
                      (not available)
                    </span>
                  )}
                </div>
                <div className="toggle-description">
                  {provider.id === 'claude-code'
                    ? 'Read usage from ~/.config/claude/projects/'
                    : provider.id === 'cursor'
                    ? 'Mock data for development'
                    : `Type: ${provider.type}`}
                </div>
              </div>
              <div
                className={`toggle-switch ${
                  settings.enabledProviders.includes(provider.id) ? 'active' : ''
                }`}
              ></div>
            </div>
          ))}
        </section>

        {/* Save Button */}
        <div style={{ paddingTop: '1rem', paddingBottom: '1rem' }}>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ width: '100%' }}
          >
            {saving ? '⏳ Saving...' : saved ? '✓ Saved!' : 'Save Settings'}
          </button>
        </div>
      </main>
    </div>
  );
};

export default Settings;
