export function ViewToggle({ view, onViewChange }) {
  return (
    <div className="toggle-wrap">
      <div className="toggle-container">
        <button
          onClick={() => onViewChange('lottery')}
          className={`toggle-btn ${view === 'lottery' ? 'active' : ''}`}
        >
          <span>🎯</span>
          Client View
        </button>
        <button
          onClick={() => onViewChange('technical')}
          className={`toggle-btn ${view === 'technical' ? 'active' : ''}`}
        >
          <span>📊</span>
          Professional
        </button>
      </div>
    </div>
  );
}
