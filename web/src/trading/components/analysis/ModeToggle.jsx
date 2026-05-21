import "../../styles/ai-analysis-light.css";
import { useState, useEffect } from 'react';

/**
 * ModeToggle - Beginner/Advanced mode switcher
 * Controls visibility of advanced technical details
 */
export function ModeToggle() {
  const [mode, setMode] = useState('beginner');

  useEffect(() => {
    // Apply mode class to body
    if (mode === 'advanced') {
      document.body.classList.add('advanced-mode');
    } else {
      document.body.classList.remove('advanced-mode');
    }

    return () => {
      document.body.classList.remove('advanced-mode');
    };
  }, [mode]);

  return (
    <div className="ai-mode-toggle">
      <button
        className={`ai-mode-btn ${mode === 'beginner' ? 'active' : ''}`}
        onClick={() => setMode('beginner')}
      >
        Beginner
      </button>
      <button
        className={`ai-mode-btn ${mode === 'advanced' ? 'active' : ''}`}
        onClick={() => setMode('advanced')}
      >
        Advanced
      </button>
    </div>
  );
}

export default ModeToggle;
