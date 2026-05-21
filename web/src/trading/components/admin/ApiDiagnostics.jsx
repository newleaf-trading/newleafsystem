/**
 * API Diagnostics Panel - Admin tool to verify market data API configuration
 * Shows which API is being used (mock vs real), test fetching, and diagnostics
 */

import { useState, useEffect } from 'react';
import { usePriceContext } from '../../contexts/PriceContext';
import { getStockPrice, getWatchlistPrices, getMarketStatus } from '../../utils/marketApi';

export function ApiDiagnostics() {
  const {
    prices,
    subscriptionCount,
    lastUpdate,
    marketStatus,
    isPolling,
  } = usePriceContext();

  const [testSymbol, setTestSymbol] = useState('AAPL');
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [apiConfig, setApiConfig] = useState({});

  // Capture API configuration on mount
  useEffect(() => {
    const config = {
      isDev: import.meta.env.DEV,
      mode: import.meta.env.MODE,
      hostname: window.location.hostname,
      protocol: window.location.protocol,
      useMockData: import.meta.env.DEV && window.location.hostname === 'localhost',
      baseUrl: window.location.origin,
    };
    setApiConfig(config);
    addLog('✅ API Configuration loaded', config);
  }, []);

  // Monitor price context changes
  useEffect(() => {
    if (lastUpdate) {
      addLog('💰 Price update received', {
        symbolCount: Object.keys(prices).length,
        symbols: Object.keys(prices),
        timestamp: lastUpdate.toISOString(),
      });
    }
  }, [lastUpdate, prices]);

  const addLog = (message, data = null) => {
    setLogs(prev => [{
      id: Date.now(),
      timestamp: new Date().toISOString(),
      message,
      data,
    }, ...prev].slice(0, 50)); // Keep last 50 logs
  };

  const handleTestFetch = async () => {
    if (!testSymbol) return;

    setTestLoading(true);
    setTestError(null);
    setTestResult(null);
    addLog(`🔄 Testing fetch for ${testSymbol}...`);

    try {
      const result = await getStockPrice(testSymbol);
      setTestResult(result);
      addLog(`✅ Successfully fetched ${testSymbol}`, result);
    } catch (error) {
      setTestError(error.message);
      addLog(`❌ Error fetching ${testSymbol}`, { error: error.message });
    } finally {
      setTestLoading(false);
    }
  };

  const handleBatchTest = async () => {
    const symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA'];
    setTestLoading(true);
    setTestError(null);
    addLog(`🔄 Testing batch fetch for ${symbols.join(', ')}...`);

    try {
      const result = await getWatchlistPrices(symbols);
      setTestResult(result);
      addLog(`✅ Successfully fetched batch`, result);
    } catch (error) {
      setTestError(error.message);
      addLog(`❌ Error fetching batch`, { error: error.message });
    } finally {
      setTestLoading(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    addLog('🧹 Logs cleared');
  };

  const formatTimestamp = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', fontSize: '13px' }}>
      <h2 style={{ marginBottom: '20px', fontFamily: 'system-ui' }}>🔍 API Diagnostics</h2>

      {/* Configuration Section */}
      <div style={{ marginBottom: '30px', padding: '15px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
        <h3 style={{ marginTop: 0, fontFamily: 'system-ui' }}>⚙️ Configuration</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '8px', fontWeight: 'bold', width: '200px' }}>Environment:</td>
              <td style={{ padding: '8px' }}>
                {apiConfig.isDev ? (
                  <span style={{ color: '#ffc107', fontWeight: 'bold' }}>🟡 DEVELOPMENT</span>
                ) : (
                  <span style={{ color: '#28a745', fontWeight: 'bold' }}>🟢 PRODUCTION</span>
                )}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px', fontWeight: 'bold' }}>Mode:</td>
              <td style={{ padding: '8px' }}>{apiConfig.mode}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', fontWeight: 'bold' }}>Hostname:</td>
              <td style={{ padding: '8px' }}>{apiConfig.hostname}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', fontWeight: 'bold' }}>Using Mock Data:</td>
              <td style={{ padding: '8px' }}>
                {apiConfig.useMockData ? (
                  <span style={{ color: '#ffc107', fontWeight: 'bold' }}>⚠️ YES (Mock Data)</span>
                ) : (
                  <span style={{ color: '#28a745', fontWeight: 'bold' }}>✅ NO (Real Yahoo Finance API)</span>
                )}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px', fontWeight: 'bold' }}>Base URL:</td>
              <td style={{ padding: '8px' }}>{apiConfig.baseUrl}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Price Context Status */}
      <div style={{ marginBottom: '30px', padding: '15px', background: '#e7f3ff', borderRadius: '8px', border: '1px solid #b3d9ff' }}>
        <h3 style={{ marginTop: 0, fontFamily: 'system-ui' }}>📊 PriceContext Status</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '8px', fontWeight: 'bold', width: '200px' }}>Active Subscriptions:</td>
              <td style={{ padding: '8px' }}>{subscriptionCount}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', fontWeight: 'bold' }}>Cached Symbols:</td>
              <td style={{ padding: '8px' }}>{Object.keys(prices).join(', ') || 'None'}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', fontWeight: 'bold' }}>Is Polling:</td>
              <td style={{ padding: '8px' }}>
                {isPolling ? (
                  <span style={{ color: '#28a745', fontWeight: 'bold' }}>✅ YES</span>
                ) : (
                  <span style={{ color: '#dc3545', fontWeight: 'bold' }}>❌ NO</span>
                )}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px', fontWeight: 'bold' }}>Last Update:</td>
              <td style={{ padding: '8px' }}>
                {lastUpdate ? lastUpdate.toLocaleString() : 'Never'}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px', fontWeight: 'bold' }}>Market Status:</td>
              <td style={{ padding: '8px' }}>
                {marketStatus?.emoji} {marketStatus?.label}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Test Fetching Section */}
      <div style={{ marginBottom: '30px', padding: '15px', background: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
        <h3 style={{ marginTop: 0, fontFamily: 'system-ui' }}>🧪 Test API Fetching</h3>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Test Symbol:
          </label>
          <input
            type="text"
            value={testSymbol}
            onChange={(e) => setTestSymbol(e.target.value.toUpperCase())}
            placeholder="AAPL"
            style={{
              padding: '8px',
              fontSize: '14px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              width: '200px',
              marginRight: '10px',
            }}
          />
          <button
            onClick={handleTestFetch}
            disabled={testLoading || !testSymbol}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: testLoading ? 'wait' : 'pointer',
              marginRight: '10px',
            }}
          >
            {testLoading ? '⏳ Fetching...' : '🔄 Test Fetch'}
          </button>
          <button
            onClick={handleBatchTest}
            disabled={testLoading}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: testLoading ? 'wait' : 'pointer',
            }}
          >
            {testLoading ? '⏳ Fetching...' : '📦 Test Batch (AAPL, GOOGL, MSFT, TSLA)'}
          </button>
        </div>

        {testError && (
          <div style={{ padding: '10px', background: '#f8d7da', color: '#721c24', borderRadius: '4px', marginBottom: '10px' }}>
            ❌ Error: {testError}
          </div>
        )}

        {testResult && (
          <div style={{ padding: '15px', background: '#d4edda', borderRadius: '4px', border: '1px solid #c3e6cb' }}>
            <h4 style={{ marginTop: 0, color: '#155724' }}>✅ Test Result:</h4>
            <pre style={{ background: 'white', padding: '10px', borderRadius: '4px', overflow: 'auto', fontSize: '12px' }}>
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Activity Logs */}
      <div style={{ marginBottom: '30px', padding: '15px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0, fontFamily: 'system-ui' }}>📜 Activity Logs ({logs.length})</h3>
          <button
            onClick={clearLogs}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            🧹 Clear Logs
          </button>
        </div>

        <div style={{ maxHeight: '400px', overflow: 'auto', background: 'white', padding: '10px', borderRadius: '4px' }}>
          {logs.length === 0 ? (
            <div style={{ color: '#6c757d', textAlign: 'center', padding: '20px' }}>
              No logs yet. Test fetching to see activity.
            </div>
          ) : (
            logs.map(log => (
              <div
                key={log.id}
                style={{
                  padding: '8px',
                  borderBottom: '1px solid #e9ecef',
                  fontSize: '12px',
                }}
              >
                <div style={{ color: '#6c757d', fontSize: '11px', marginBottom: '2px' }}>
                  {formatTimestamp(log.timestamp)}
                </div>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  {log.message}
                </div>
                {log.data && (
                  <pre style={{
                    background: '#f8f9fa',
                    padding: '6px',
                    borderRadius: '3px',
                    fontSize: '11px',
                    overflow: 'auto',
                    margin: 0,
                  }}>
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Current Prices Display */}
      {Object.keys(prices).length > 0 && (
        <div style={{ padding: '15px', background: '#d1ecf1', borderRadius: '8px', border: '1px solid #bee5eb' }}>
          <h3 style={{ marginTop: 0, fontFamily: 'system-ui' }}>💰 Current Cached Prices</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {Object.entries(prices).map(([symbol, data]) => (
              <div
                key={symbol}
                style={{
                  padding: '10px',
                  background: 'white',
                  borderRadius: '4px',
                  border: '1px solid #bee5eb',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>
                  {symbol}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '3px' }}>
                  ${data.price?.toFixed(2)}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: data.change >= 0 ? '#28a745' : '#dc3545',
                }}>
                  {data.change >= 0 ? '+' : ''}{data.change?.toFixed(2)} ({data.changePercent?.toFixed(2)}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
