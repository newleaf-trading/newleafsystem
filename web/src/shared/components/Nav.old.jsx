import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Nav() {
  const location = useLocation();
  const { user, signInWithGoogle, signOut } = useAuth();

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const onPicks = isActive('/picks');
  const onWorkbench = isActive('/workbench');
  const onMarketing = isActive('/how-we') || isActive('/track-record') || isActive('/probability-engine') || isActive('/strategy-selection') || isActive('/technical-analysis') || isActive('/gamma-analysis') || isActive('/ai-sentiment') || isActive('/ai-portfolio');
  const onInvest = isActive('/invest');
  const suffix = onInvest ? 'Invest' : onPicks ? 'Picks' : onWorkbench ? 'Workbench' : 'System';

  return (
    <nav className="nl-nav">
      <Link to="/" className="nl-nav-brand">
        <img src="/logo-icon.png" width="36" height="36" alt="NewLeaf" />
        <span className="nl-nav-wordmark">
          NewLeaf <em>{suffix}</em>
        </span>
      </Link>

      <ul className="nl-nav-links">
        <li><Link to="/picks" className={`nl-nav-link${isActive('/picks') ? ' active' : ''}`}>Picks</Link></li>
        {onPicks && (
          <li><Link to="/picks/recap" className={`nl-nav-link${isActive('/picks/recap') ? ' active' : ''}`}>Performance</Link></li>
        )}
        {!onPicks && (
          <>
            <li><a href="/workbench/" className={`nl-nav-link${onWorkbench ? ' active' : ''}`}>Workbench</a></li>
            {onWorkbench && (
              <li><Link to="/workbench/analysis" className={`nl-nav-link${isActive('/workbench/analysis') ? ' active' : ''}`}>Analysis</Link></li>
            )}
            <li><Link to="/invest" className={`nl-nav-link${isActive('/invest') ? ' active' : ''}`}>Invest</Link></li>
          </>
        )}
        <li><a href="/workbench/strategy-builder.html" className="nl-nav-link">Builder</a></li>
      </ul>

      <div className="nl-nav-right">
        <HowItWorksDropdown isActive={onMarketing} />
        {user ? (
          <button className="nl-nav-ghost" onClick={signOut}>Sign Out</button>
        ) : (
          <button className="nl-nav-ghost" onClick={signInWithGoogle}>Sign In</button>
        )}
        {!user && (
          <Link to="/invest" className="nl-nav-cta">Get Started &rarr;</Link>
        )}
      </div>
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════════
// "How it works" dropdown
// ═══════════════════════════════════════════════════════════════

const DROPDOWN_ITEMS = [
  { href: '/how-we-pick', label: 'How we pick trades' },
  { href: '/how-we-recommend', label: 'Why we recommend them' },
  { href: '/how-we-manage', label: 'How we manage them' },
  { href: '/track-record', label: 'Track record' },
  { divider: true },
  { href: '/how-we-score', label: 'Scoring algorithm' },
  { href: '/probability-engine', label: 'Probability engine' },
  { href: '/strategy-selection', label: 'Strategy selection' },
  { href: '/technical-analysis', label: 'Technical analysis' },
  { href: '/gamma-analysis', label: 'Gamma wall analysis' },
  { href: '/ai-sentiment', label: 'AI sentiment analysis' },
  { href: '/ai-portfolio', label: 'NewLeaf Invest AI' },
];

function HowItWorksDropdown({ isActive }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const timeoutRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  // Hover open with small delay to prevent flicker
  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  };
  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  // Keyboard: Enter/Space toggles, arrow keys navigate items
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(o => !o);
    }
    if (e.key === 'ArrowDown' && open) {
      e.preventDefault();
      const first = ref.current?.querySelector('a');
      if (first) first.focus();
    }
  };

  return (
    <div
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative' }}
    >
      <button
        className={`nl-nav-link${isActive ? ' active' : ''}`}
        onClick={() => setOpen(o => !o)}
        onKeyDown={handleKeyDown}
        aria-expanded={open}
        aria-haspopup="true"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          font: 'inherit', padding: 'inherit', color: 'inherit',
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        How it works
        <span style={{ fontSize: 10, opacity: 0.6, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}>
          &#9662;
        </span>
      </button>

      {open && (
        <div
          className="nl-nav-dropdown"
          style={{
            position: 'absolute', top: '100%', left: 0,
            marginTop: 4, minWidth: 220,
            background: '#F7F4EE', borderRadius: 10,
            border: '1px solid rgba(11,15,20,0.08)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
            padding: '6px 0', zIndex: 200,
          }}
          role="menu"
        >
          <style>{`
            .nl-nav-dropdown a.nl-dropdown-item {
              display: block !important;
              padding: 10px 18px !important;
              font-size: 13px !important;
              font-weight: 600 !important;
              color: #0B2D23 !important;
              text-decoration: none !important;
              background: transparent !important;
              border: none !important;
              border-bottom: none !important;
              height: auto !important;
              letter-spacing: normal !important;
              text-transform: none !important;
            }
            .nl-nav-dropdown a.nl-dropdown-item:hover {
              background: rgba(11,45,35,0.06) !important;
              color: #0B2D23 !important;
              border-bottom: none !important;
            }
          `}</style>
          {DROPDOWN_ITEMS.map((item, idx) => (
            item.divider ? (
              <div key={`div-${idx}`} style={{ height: 1, background: 'rgba(11,15,20,0.08)', margin: '6px 14px' }} />
            ) : (
              <a
                key={item.href}
                href={item.href}
                role="menuitem"
                tabIndex={0}
                className="nl-dropdown-item"
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    let next = e.target.nextElementSibling;
                    while (next && next.tagName !== 'A') next = next.nextElementSibling;
                    if (next) next.focus();
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    let prev = e.target.previousElementSibling;
                    while (prev && prev.tagName !== 'A') prev = prev.previousElementSibling;
                    if (prev) prev.focus();
                  }
                  if (e.key === 'Escape') setOpen(false);
                }}
              >
                {item.label}
              </a>
            )
          ))}
        </div>
      )}
    </div>
  );
}
