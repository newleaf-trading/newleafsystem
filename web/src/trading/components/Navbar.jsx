import { Link, useLocation } from 'react-router-dom';
import { usePortfolio } from '../hooks/usePortfolio';

export function Navbar({ user, onSignOut, view, onViewChange }) {
  const location = useLocation();
  const { portfolioItems } = usePortfolio();

  const getUserInitial = () => {
    if (user?.displayName) {
      return user.displayName.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const getFirstName = () => {
    if (user?.displayName) {
      return user.displayName.split(' ')[0];
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'there';
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const isHomePage = location.pathname === '/invest';
  const isDetailPage = location.pathname.startsWith('/invest/position/');

  return (
    <>
    <nav className="nav">
      <div className="nav-container">
        {/* Logo with leaf SVG */}
        <div className="nav-logo">
          <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="12" r="3.5" fill="#0B2D23"/>
            <path d="M6 28 C6 28 12 18 20 18 C28 18 34 28 34 28" stroke="#C9A96E" strokeWidth="3" fill="none" strokeLinecap="round"/>
          </svg>
          <h1>
            <span className="brand-name">NewLeaf</span>
            <span className="brand-suffix"> System</span>
          </h1>
        </div>

        {/* Navigation links */}
        <div className="nav-links">
          <Link to="/invest/dashboard" className={`nav-link ${isActive('/invest/dashboard') ? 'active' : ''}`}>
            Home
          </Link>
          <Link to="/invest" className={`nav-link ${isActive('/invest') ? 'active' : ''}`}>
            Discover
          </Link>
          <Link to="/invest/portfolio" className={`nav-link ${isActive('/invest/portfolio') ? 'active' : ''}`}>
            Portfolio
          </Link>
          <Link to="/invest/performance" className={`nav-link ${isActive('/invest/performance') ? 'active' : ''}`}>
            Performance
          </Link>
          <Link to="/invest/learn" className={`nav-link ${isActive('/invest/learn') ? 'active' : ''}`}>
            Learn
          </Link>
          <Link to="/invest/admin" className={`nav-link ${isActive('/invest/admin') ? 'active' : ''}`}>
            Admin
          </Link>
        </div>

        {/* Right side: Market status, Ask AI, user */}
        <div className="nav-user">
          <div className="nav-market-status">
            <span className="market-dot closed"></span>
            <span className="market-text">Markets Closed</span>
          </div>

          <button className="nav-ask-ai">
            <span className="ai-icon">✦</span>
            Ask AI
          </button>

          {user && (
            <>
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="user-avatar"
                />
              ) : (
                <div className="user-avatar">{getUserInitial()}</div>
              )}
              <button onClick={onSignOut} className="sign-out-btn">
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
    {!isDetailPage && (
      <div className="mobile-welcome">
        Welcome back, {getFirstName()} 👋
      </div>
    )}
    </>
  );
}
