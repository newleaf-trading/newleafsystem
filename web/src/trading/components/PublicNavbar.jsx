import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

export function PublicNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setMobileMenuOpen(false);
    }
  };

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      background: scrolled ? 'rgba(255,255,255,0.95)' : 'transparent',
      backdropFilter: scrolled ? 'blur(20px)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
      transition: 'all 0.3s ease',
      padding: scrolled ? '0.6rem 0' : '1rem 0',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '0 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <Link to="/invest" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <img src="/logo-icon.png" width="36" height="36" alt="NewLeaf" style={{ borderRadius: 8, display: 'block' }} />
          <span style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '1.35rem',
            fontWeight: 600,
            color: '#0B0F14',
            letterSpacing: '-0.01em',
          }}>
            NewLeaf <span style={{ fontWeight: 500, color: '#C9A96E', fontStyle: 'italic' }}>System</span>
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="public-nav-links" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
        }}>
          <button onClick={() => scrollToSection('products')} style={navLinkStyle}>Products</button>
          <button onClick={() => scrollToSection('solutions')} style={navLinkStyle}>Solutions</button>
          <button onClick={() => scrollToSection('pricing')} style={navLinkStyle}>Pricing</button>
          <button onClick={() => scrollToSection('support')} style={navLinkStyle}>Support</button>
        </div>

        {/* CTA Buttons */}
        <div className="public-nav-cta" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/invest/login" style={{
            fontFamily: "'Instrument Sans', sans-serif",
            fontSize: '0.9rem',
            fontWeight: 500,
            color: '#374151',
            textDecoration: 'none',
            padding: '0.5rem 1rem',
            borderRadius: 8,
            transition: 'color 0.2s',
          }}>
            Log in
          </Link>
          <Link to="/invest/login?signup=true" style={{
            fontFamily: "'Instrument Sans', sans-serif",
            fontSize: '0.9rem',
            fontWeight: 600,
            color: '#fff',
            background: '#0B2D23',
            textDecoration: 'none',
            padding: '0.6rem 1.3rem',
            borderRadius: 10,
            transition: 'all 0.2s',
            boxShadow: '0 1px 3px rgba(11, 45, 35,0.3),',
          }}>
            Get Started Free
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="public-nav-hamburger"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            display: 'none',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 6,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round">
            {mobileMenuOpen ? (
              <>
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="6" y1="18" x2="18" y2="6" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="public-mobile-menu" style={{
          background: 'white',
          borderTop: '1px solid #f1f5f9',
          padding: '1rem 2rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}>
          <button onClick={() => scrollToSection('products')} style={mobileLinkStyle}>Products</button>
          <button onClick={() => scrollToSection('solutions')} style={mobileLinkStyle}>Solutions</button>
          <button onClick={() => scrollToSection('pricing')} style={mobileLinkStyle}>Pricing</button>
          <button onClick={() => scrollToSection('support')} style={mobileLinkStyle}>Support</button>
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', marginTop: '0.25rem', display: 'flex', gap: '0.75rem' }}>
            <Link to="/invest/login" style={{ ...mobileLinkStyle, textDecoration: 'none', textAlign: 'center' }}>Log in</Link>
            <Link to="/invest/login?signup=true" style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: "'Instrument Sans', sans-serif",
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#fff',
              background: '#0B2D23',
              textDecoration: 'none',
              padding: '0.65rem',
              borderRadius: 8,
              border: 'none',
            }}>
              Get Started
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

const navLinkStyle = {
  fontFamily: "'Instrument Sans', sans-serif",
  fontSize: '0.9rem',
  fontWeight: 500,
  color: '#4b5563',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '0.3rem 0',
  transition: 'color 0.2s',
  letterSpacing: '-0.01em',
};

const mobileLinkStyle = {
  fontFamily: "'Instrument Sans', sans-serif",
  fontSize: '1rem',
  fontWeight: 500,
  color: '#374151',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '0.5rem 0',
  textAlign: 'left',
};
