import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMarketState } from '../hooks/useMarketState';
import { getMarketStatus as getTimeBasedMarketStatus } from '../utils/marketApi';

export function NewNavbar({ user, onSignOut, onOpenChat }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { marketState } = useMarketState();

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Prevent body scroll when menu open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const getUserInitials = () => {
    if (user?.displayName) {
      return user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return 'U';
  };

  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'Trader';

  const isActive = (path) => location.pathname === path;

  // Get market status from time-based calculation (reliable, no Firestore dependency)
  const [marketStatus, setMarketStatus] = useState(() => {
    const s = getTimeBasedMarketStatus();
    return { text: s.label, isOpen: s.status === 'open' };
  });

  useEffect(() => {
    const update = () => {
      const s = getTimeBasedMarketStatus();
      setMarketStatus({ text: s.label, isOpen: s.status === 'open' });
    };
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  // Check if user is admin
  const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map(e => e.trim());
  const isAdmin = user?.email && ADMIN_EMAILS.some(email => email.toLowerCase() === user.email.toLowerCase());

  const navLinks = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/discover', label: 'Discover', icon: '🔍' },
    { path: '/portfolio', label: 'Portfolio', icon: '💼' },
    { path: '/performance', label: 'Performance', icon: '📊' },
    { path: '/learn', label: 'Learn', icon: '📚' },
  ];

  // Add admin link if user is admin
  if (isAdmin) {
    navLinks.push({ path: '/admin-dashboard', label: 'Admin', icon: '⚙️' });
  }

  return (
    <>
      <nav className="topnav">
        <div className="topnav-logo">
          <svg viewBox="0 0 40 40" fill="none" width="28" height="28">
            <circle cx="20" cy="12" r="3.5" fill="#0B2D23"/>
            <path d="M6 28 C6 28 12 18 20 18 C28 18 34 28 34 28" stroke="#C9A96E" strokeWidth="3" fill="none" strokeLinecap="round"/>
          </svg>
          <span className="brand">NewLeaf</span>
          <span className="brand-sub">System</span>
        </div>

        {/* Desktop nav links */}
        <div className="topnav-links">
          {navLinks.map(link => (
            <Link
              key={link.path}
              to={link.path}
              className={`topnav-link${isActive(link.path) ? ' active' : ''}`}
            >
              {link.label}
              {link.path === '/' && <span className="badge" />}
            </Link>
          ))}
        </div>

        <div className="topnav-right">
          <div className="market-ind">
            <span className={`market-dot${marketStatus.isOpen ? '' : ' closed'}`} />
            <span className="market-label">{marketStatus.text}</span>
          </div>

          <button className="nav-voice-btn" title="Ask NewLeaf System" onClick={() => onOpenChat?.()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" x2="12" y1="19" y2="22"/>
            </svg>
            Ask AI
            <span className="nav-voice-pulse" />
          </button>

          {/* Desktop only: avatar + sign out */}
          <div className="topnav-desktop-only">
            <div className="avatar">{getUserInitials()}</div>
            <button onClick={onSignOut} className="sign-out-btn-new">Sign Out</button>
          </div>

          {/* Mobile hamburger button */}
          <button
            className={`hamburger-btn${menuOpen ? ' open' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            <span className="hamburger-line" />
            <span className="hamburger-line" />
            <span className="hamburger-line" />
          </button>
        </div>
      </nav>

      {/* Mobile slide-out menu */}
      <div className={`mobile-menu-overlay${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} />
      <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
        <div className="mobile-menu-header">
          <div className="avatar">{getUserInitials()}</div>
          <div>
            <div className="mobile-menu-name">{firstName}</div>
            <div className="mobile-menu-email">{user?.email || ''}</div>
          </div>
        </div>

        <div className="mobile-menu-links">
          {navLinks.map(link => (
            <Link
              key={link.path}
              to={link.path}
              className={`mobile-menu-link${isActive(link.path) ? ' active' : ''}`}
            >
              <span className="mobile-menu-icon">{link.icon}</span>
              <span>{link.label}</span>
              {isActive(link.path) && <span className="mobile-menu-active-dot" />}
            </Link>
          ))}
        </div>

        <div className="mobile-menu-footer">
          <div className="market-ind" style={{ marginBottom: 16 }}>
            <span className={`market-dot${marketStatus.isOpen ? '' : ' closed'}`} />
            <span className="market-label">{marketStatus.text}</span>
          </div>
          <button onClick={onSignOut} className="mobile-signout-btn">
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
