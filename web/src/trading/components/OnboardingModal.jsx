import React, { useState } from 'react';
import { usePortfolioSettings } from '../hooks/usePortfolioSettings';

export function OnboardingModal({ onComplete }) {
  const { updateSettings } = usePortfolioSettings();

  const [capital, setCapital] = useState('');
  const [riskTolerance, setRiskTolerance] = useState('moderate');
  const [maxDrawdown, setMaxDrawdown] = useState(10); // Default 10%
  const [investmentGoals, setInvestmentGoals] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const quickSelectAmounts = [
    { label: '$10K', value: 10000 },
    { label: '$25K', value: 25000 },
    { label: '$50K', value: 50000 },
    { label: '$100K', value: 100000 },
    { label: '$250K', value: 250000 }
  ];

  const riskProfiles = [
    {
      id: 'conservative',
      title: 'Conservative',
      description: 'Lower risk strategies, focus on capital preservation',
      maxAllocation: 0.15,
      icon: '🛡️'
    },
    {
      id: 'moderate',
      title: 'Moderate',
      description: 'Balanced approach with moderate risk tolerance',
      maxAllocation: 0.30,
      icon: '⚖️'
    },
    {
      id: 'aggressive',
      title: 'Aggressive',
      description: 'Higher risk tolerance for potentially higher returns',
      maxAllocation: 0.50,
      icon: '🚀'
    }
  ];

  const goalOptions = [
    { id: 'income', label: 'Generate Income', icon: '💰' },
    { id: 'growth', label: 'Capital Growth', icon: '📈' },
    { id: 'hedging', label: 'Portfolio Hedging', icon: '🛡️' },
    { id: 'learning', label: 'Learning & Practice', icon: '📚' }
  ];

  const formatCurrency = (value) => {
    // Remove non-digits
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) return '';

    // Convert to number and format with thousand separators
    const number = parseInt(numericValue, 10);
    return number.toLocaleString('en-US');
  };

  const handleCapitalChange = (e) => {
    const formatted = formatCurrency(e.target.value);
    setCapital(formatted);
  };

  const handleQuickSelect = (amount) => {
    setCapital(amount.toLocaleString('en-US'));
  };

  const toggleGoal = (goalId) => {
    setInvestmentGoals(prev =>
      prev.includes(goalId)
        ? prev.filter(id => id !== goalId)
        : [...prev, goalId]
    );
  };

  const handleSubmit = async () => {
    const numericCapital = parseInt(capital.replace(/,/g, ''), 10);

    if (!numericCapital || numericCapital < 5000 || numericCapital > 10000000) {
      alert('Please enter a capital amount between $5,000 and $10,000,000');
      return;
    }

    if (investmentGoals.length === 0) {
      alert('Please select at least one investment goal');
      return;
    }

    setIsSubmitting(true);

    const selectedProfile = riskProfiles.find(p => p.id === riskTolerance);

    const settings = {
      totalCapital: numericCapital,
      riskTolerance,
      maxAllocation: selectedProfile.maxAllocation,
      maxDrawdown: maxDrawdown / 100, // Convert percentage to decimal
      investmentGoals,
      currency: 'USD'
    };

    const success = await updateSettings(settings);

    if (success && onComplete) {
      onComplete();
    } else {
      setIsSubmitting(false);
      alert('Error saving settings. Please try again.');
    }
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        {/* Header */}
        <div className="onboarding-header">
          <div className="onboarding-title">
            <img src="/logo-icon.png" width="40" height="40" alt="NewLeaf" style={{flexShrink:0,borderRadius:8,display:'block'}} />
            <h1>Welcome to NewLeaf Invest</h1>
          </div>
          <p className="onboarding-subtitle">
            How much capital do you want to allocate to options trading?
          </p>
        </div>

        {/* Section 1: Capital Input */}
        <div className="onboarding-section">
          <div className="capital-input-wrapper">
            <span className="dollar-prefix">$</span>
            <input
              type="text"
              className="capital-input"
              value={capital}
              onChange={handleCapitalChange}
              placeholder="0"
              autoFocus
            />
          </div>
          <p className="capital-range">Min: $5,000 • Max: $10,000,000</p>

          <div className="quick-select-buttons">
            {quickSelectAmounts.map(amt => (
              <button
                key={amt.value}
                className="quick-select-btn"
                onClick={() => handleQuickSelect(amt.value)}
              >
                {amt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Risk Tolerance */}
        <div className="onboarding-section">
          <h3 className="section-title">Risk Tolerance</h3>
          <div className="risk-cards">
            {riskProfiles.map(profile => (
              <button
                key={profile.id}
                className={`risk-card ${riskTolerance === profile.id ? 'selected' : ''}`}
                onClick={() => setRiskTolerance(profile.id)}
              >
                <span className="risk-icon">{profile.icon}</span>
                <h4>{profile.title}</h4>
                <p>{profile.description}</p>
                <div className="risk-allocation">
                  Max allocation: {(profile.maxAllocation * 100).toFixed(0)}%
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Section 3: Max Drawdown */}
        <div className="onboarding-section">
          <h3 className="section-title">Maximum Portfolio Drawdown</h3>
          <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
            What's the maximum loss you're willing to accept if all positions hit max loss?
          </p>
          <div className="drawdown-selector">
            <input
              type="range"
              min="5"
              max="25"
              step="5"
              value={maxDrawdown}
              onChange={(e) => setMaxDrawdown(parseInt(e.target.value))}
              className="drawdown-slider"
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: '#9ca3af' }}>
              <span>5%</span>
              <span>10%</span>
              <span>15%</span>
              <span>20%</span>
              <span>25%</span>
            </div>
            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '24px', fontWeight: '700', color: '#0B2D23' }}>
              {maxDrawdown}%
            </div>
            <div style={{ textAlign: 'center', fontSize: '14px', color: '#6b7280' }}>
              Max risk: ${((capital.replace(/,/g, '') || 0) * maxDrawdown / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        {/* Section 4: Investment Goals */}
        <div className="onboarding-section">
          <h3 className="section-title">Investment Goals (select all that apply)</h3>
          <div className="goals-grid">
            {goalOptions.map(goal => (
              <button
                key={goal.id}
                className={`goal-card ${investmentGoals.includes(goal.id) ? 'selected' : ''}`}
                onClick={() => toggleGoal(goal.id)}
              >
                <span className="goal-icon">{goal.icon}</span>
                <span className="goal-label">{goal.label}</span>
                {investmentGoals.includes(goal.id) && (
                  <span className="checkmark">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="onboarding-footer">
          <button
            className="build-portfolio-btn"
            onClick={handleSubmit}
            disabled={isSubmitting || !capital}
          >
            {isSubmitting ? 'Setting Up...' : 'Build My Portfolio'}
          </button>
        </div>
      </div>
    </div>
  );
}
