import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

export function LandingNav({ onGetStarted }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    setMobileOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="landing-nav-inner">
        {/* Logo */}
        <div className="landing-nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="12" r="3.5" fill="#0B2D23"/>
            <path d="M6 28 C6 28 12 18 20 18 C28 18 34 28 34 28" stroke="#C9A96E" strokeWidth="3" fill="none" strokeLinecap="round"/>
          </svg>
          <span className="landing-nav-brand">NewLeaf</span>
          <span className="landing-nav-brand-suffix">System</span>
        </div>

        {/* Desktop Links */}
        <div className="landing-nav-links">
          <button onClick={() => scrollTo('products')} className="landing-nav-link">Products</button>
          <button onClick={() => scrollTo('solutions')} className="landing-nav-link">Solutions</button>
          <button onClick={() => scrollTo('pricing')} className="landing-nav-link">Pricing</button>
          <button onClick={() => scrollTo('support')} className="landing-nav-link">Support</button>
        </div>

        {/* CTA */}
        <div className="landing-nav-actions">
          <button onClick={() => onGetStarted('login')} className="landing-nav-signin">Sign In</button>
          <button onClick={() => onGetStarted('signup')} className="landing-nav-cta">Get Started Free</button>
        </div>

        {/* Mobile hamburger */}
        <button className="landing-nav-hamburger" onClick={() => setMobileOpen(!mobileOpen)}>
          <span className={`hamburger-line ${mobileOpen ? 'open' : ''}`}></span>
          <span className={`hamburger-line ${mobileOpen ? 'open' : ''}`}></span>
          <span className={`hamburger-line ${mobileOpen ? 'open' : ''}`}></span>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="landing-nav-mobile">
          <button onClick={() => scrollTo('products')}>Products</button>
          <button onClick={() => scrollTo('solutions')}>Solutions</button>
          <button onClick={() => scrollTo('pricing')}>Pricing</button>
          <button onClick={() => scrollTo('support')}>Support</button>
          <div className="landing-nav-mobile-actions">
            <button onClick={() => { setMobileOpen(false); onGetStarted('login'); }} className="landing-nav-signin">Sign In</button>
            <button onClick={() => { setMobileOpen(false); onGetStarted('signup'); }} className="landing-nav-cta">Get Started Free</button>
          </div>
        </div>
      )}
    </nav>
  );
}
