import React, { useState, useEffect, useCallback } from 'react';
import { AggregatedUsage, AppStatus, ModelUsage, ProviderUsage } from '../../shared/types';

interface UsageData {
  daily: AggregatedUsage | null;
  weekly: AggregatedUsage | null;
  monthly: AggregatedUsage | null;
  status: AppStatus;
  lastUpdated: string | null;
  isHighUsage: boolean;
}

type TimePeriod = 'daily' | 'weekly' | 'monthly';

const Dashboard: React.FC = () => {
  const [period, setPeriod] = useState<TimePeriod>('daily');
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      if (window.electronAPI) {
        const usageData = await window.electronAPI.getUsageData();
        setData(usageData);
      }
    } catch (e) {
      console.error('Error loading data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh data
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (window.electronAPI) {
        await window.electronAPI.refreshData();
        await loadData();
      }
    } catch (e) {
      console.error('Error refreshing:', e);
    } finally {
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadData();

    // Listen for updates from main process
    if (window.electronAPI) {
      const unsubscribe = window.electronAPI.onUsageUpdated((newData) => {
        setData(newData);
      });
      return unsubscribe;
    }
  }, [loadData]);

  const usage = data ? data[period] : null;

  const formatCost = (cost: number) => `$${cost.toFixed(2)}`;
  const formatTokens = (tokens: number) => tokens.toLocaleString();
  const formatTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  // Get provider breakdown as array
  const getProviders = (): ProviderUsage[] => {
    if (!usage?.providerBreakdown) return [];
    return Object.values(usage.providerBreakdown);
  };

  // Get model breakdown as array
  const getModels = (): ModelUsage[] => {
    if (!usage?.modelBreakdown) return [];
    return Object.values(usage.modelBreakdown).sort((a, b) => b.costUSD - a.costUSD);
  };

  if (loading) {
    return (
      <div className="dashboard">
        <header className="header">
          <h1>
            <div className="header-icon">$</div>
            AI Usage Monitor
          </h1>
        </header>
        <main className="container">
          <div className="empty-state">
            <div className="empty-state-icon animate-pulse">⏳</div>
            <div className="empty-state-title">Loading...</div>
            <div className="empty-state-description">Fetching usage data from providers</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="header">
        <h1>
          <div className="header-icon">$</div>
          AI Usage Monitor
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="status-indicator">
            <span
              className={`status-dot ${
                data?.status === AppStatus.Stale
                  ? 'stale'
                  : data?.status === AppStatus.Error
                  ? 'error'
                  : ''
              }`}
            ></span>
            Updated {formatTime(data?.lastUpdated || null)}
          </div>
          <button
            className="btn btn-secondary btn-icon"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh"
          >
            {refreshing ? '⏳' : '🔄'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container">
        {/* High Usage Alert */}
        {data?.isHighUsage && (
          <div
            className="card animate-fade-in"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'var(--accent-danger)',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--accent-danger)' }}>
                  High Usage Alert
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Daily cost has exceeded your configured threshold
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Period Tabs */}
        <div className="tabs">
          <button
            className={`tab ${period === 'daily' ? 'active' : ''}`}
            onClick={() => setPeriod('daily')}
          >
            Today
          </button>
          <button
            className={`tab ${period === 'weekly' ? 'active' : ''}`}
            onClick={() => setPeriod('weekly')}
          >
            This Week
          </button>
          <button
            className={`tab ${period === 'monthly' ? 'active' : ''}`}
            onClick={() => setPeriod('monthly')}
          >
            This Month
          </button>
        </div>

        {/* No Data State */}
        {!usage && (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">No usage data</div>
            <div className="empty-state-description">
              No AI usage recorded for this period. Start using Claude Code or Cursor to see
              statistics here.
            </div>
          </div>
        )}

        {/* Stats Grid */}
        {usage && (
          <>
            <div className="stats-grid animate-fade-in" key={period}>
              <div className="stat-card">
                <div className="stat-label">Total Cost</div>
                <div className="stat-value cost">{formatCost(usage.totalCostUSD)}</div>
                <div className="stat-change">{usage.entryCount} requests</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Tokens</div>
                <div className="stat-value tokens">{formatTokens(usage.totalTokens)}</div>
                <div className="stat-change">
                  {Math.round((usage.inputTokens / usage.totalTokens) * 100)}% input
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Input Tokens</div>
                <div className="stat-value">{formatTokens(usage.inputTokens)}</div>
                <div className="stat-change">
                  ~{formatCost(usage.inputTokens * 0.000003)} estimated
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Output Tokens</div>
                <div className="stat-value">{formatTokens(usage.outputTokens)}</div>
                <div className="stat-change">
                  ~{formatCost(usage.outputTokens * 0.000015)} estimated
                </div>
              </div>
            </div>

            {/* Provider Breakdown */}
            <section className="section">
              <div className="section-header">
                <h2 className="section-title">Provider Breakdown</h2>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Provider</th>
                      <th>Requests</th>
                      <th>Tokens</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getProviders().length > 0 ? (
                      getProviders().map((provider) => (
                        <tr key={provider.providerId}>
                          <td>
                            <span
                              className={`provider-badge ${
                                provider.providerId === 'claude-code' ? 'claude' : 'cursor'
                              }`}
                            >
                              {provider.providerName}
                            </span>
                          </td>
                          <td>{provider.entryCount}</td>
                          <td>{formatTokens(provider.totalTokens)}</td>
                          <td style={{ color: 'var(--accent-success)' }}>
                            {formatCost(provider.costUSD)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          No provider data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Model Breakdown */}
            <section className="section">
              <div className="section-header">
                <h2 className="section-title">Model Breakdown</h2>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>Requests</th>
                      <th>Tokens</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getModels().length > 0 ? (
                      getModels().map((model) => (
                        <tr key={model.model}>
                          <td
                            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                          >
                            {model.model}
                          </td>
                          <td>{model.entryCount}</td>
                          <td>{formatTokens(model.totalTokens)}</td>
                          <td style={{ color: 'var(--accent-success)' }}>
                            {formatCost(model.costUSD)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          No model data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Cache Stats */}
            {(usage.cacheCreationTokens > 0 || usage.cacheReadTokens > 0) && (
              <section className="section">
                <div className="section-header">
                  <h2 className="section-title">Cache Statistics</h2>
                </div>
                <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  <div className="stat-card">
                    <div className="stat-label">Cache Creation</div>
                    <div className="stat-value">{formatTokens(usage.cacheCreationTokens)}</div>
                    <div className="stat-change">tokens created</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Cache Read</div>
                    <div className="stat-value">{formatTokens(usage.cacheReadTokens)}</div>
                    <div className="stat-change">tokens read</div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
