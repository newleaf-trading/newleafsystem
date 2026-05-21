import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { surfaceConfig, switcherProducts } from './navConfig';
import { useMarketState } from '../../trading/hooks/useMarketState';

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

/** Use <a> for static / HTML pages, <Link> for React Router routes */
function NavAnchor({ href, children, ...props }) {
  if (href.includes('.html') || href === '/workbench/' || href === '/workbench') {
    return <a href={href} {...props}>{children}</a>;
  }
  return <Link {...props} to={href}>{children}</Link>;
}

function formatET() {
  return new Date().toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) + ' ET';
}

// ═══════════════════════════════════════════════════════════════
// ProductSwitcher — grid icon + dropdown listing 3 products
// ═══════════════════════════════════════════════════════════════

function ProductSwitcher({ currentSurface }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="nl-switcher-wrap">
      <button
        className="nl-switcher-btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Switch product"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
          <rect x="1" y="1" width="6" height="6" rx="1.5" />
          <rect x="9" y="1" width="6" height="6" rx="1.5" />
          <rect x="1" y="9" width="6" height="6" rx="1.5" />
          <rect x="9" y="9" width="6" height="6" rx="1.5" />
        </svg>
      </button>

      <div className="nl-switcher-panel" role="menu" hidden={!open}>
        {switcherProducts.map((p) => (
          <NavAnchor
            key={p.key}
            href={p.href}
            className={`nl-switcher-item${p.key === currentSurface ? ' current' : ''}`}
            role="menuitem"
            aria-current={p.key === currentSurface ? 'true' : undefined}
            onClick={() => setOpen(false)}
          >
            <div className="nl-switcher-text">
              <span className="nl-switcher-label">{p.label}</span>
              <span className="nl-switcher-desc">{p.description}</span>
            </div>
            {p.key === currentSurface && (
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" className="nl-switcher-check">
                <path d="M13.3 4.3a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4 0l-3-3a1 1 0 0 1 1.4-1.4L6.5 9.6l5.3-5.3a1 1 0 0 1 1.4 0z" />
              </svg>
            )}
          </NavAnchor>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NavDropdown — reusable for "How it works", "Strategies", etc.
// ═══════════════════════════════════════════════════════════════

function NavDropdown({ label, items, isActive, dark }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const hoverTimeout = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const handleMouseEnter = () => {
    clearTimeout(hoverTimeout.current);
    setOpen(true);
  };
  const handleMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => setOpen(false), 150);
  };

  const handleTriggerKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen((o) => !o);
    }
    if (e.key === 'ArrowDown' && open) {
      e.preventDefault();
      ref.current?.querySelector('.nl-dd-item')?.focus();
    }
  };

  const handleItemKey = (e) => {
    const move = (dir) => {
      let el = e.target[dir];
      while (el && !el.classList?.contains('nl-dd-item')) el = el[dir];
      if (el) el.focus();
    };
    if (e.key === 'ArrowDown') { e.preventDefault(); move('nextElementSibling'); }
    if (e.key === 'ArrowUp') { e.preventDefault(); move('previousElementSibling'); }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <li
      ref={ref}
      className="nl-dd-wrap"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={`nl-nav-link nl-dd-trigger${isActive ? ' active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleTriggerKey}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {label}
        <span
          className="nl-dd-arrow"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        >
          &#9662;
        </span>
      </button>

      <div className={`nl-dd-panel${dark ? ' nl-dd-dark' : ''}`} role="menu" hidden={!open}>
          {items.map((item, idx) => {
            if (item.divider) return <div key={`d${idx}`} className="nl-dd-divider" />;
            if (item.heading) return <div key={`h${idx}`} className="nl-dd-heading">{item.heading}</div>;
            return (
              <a
                key={item.href}
                href={item.href}
                role="menuitem"
                tabIndex={0}
                className={`nl-dd-item${item.accent ? ' accent' : ''}`}
                onKeyDown={handleItemKey}
              >
                {item.label}
              </a>
            );
          })}
        </div>
    </li>
  );
}

// ═══════════════════════════════════════════════════════════════
// MarketStatusPill — Invest surface, reads from Firestore
// ═══════════════════════════════════════════════════════════════

function MarketStatusPill() {
  const { marketState } = useMarketState();
  const isOpen = marketState?.isMarketOpen;
  const text = !marketState ? 'Loading\u2026' : isOpen ? 'Markets Open' : 'Markets Closed';

  return (
    <div className="nl-live">
      <span
        className="nl-live-dot"
        style={{ background: isOpen ? '#5dba8e' : '#888' }}
      />
      <span>{text}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LiveClock — Workbench surface, ET time updated every second
// ═══════════════════════════════════════════════════════════════

function LiveClock() {
  const [time, setTime] = useState(formatET);

  useEffect(() => {
    const id = setInterval(() => setTime(formatET()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="nl-live">
      <span className="nl-live-dot" />
      <span>
        Live &middot; <span className="nl-live-time">{time}</span>
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MobileMenu — full-width overlay with focus trap
// ═══════════════════════════════════════════════════════════════

function MobileMenu({ isOpen, onClose, sections, children }) {
  const panelRef = useRef(null);
  const prevFocusRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    prevFocusRef.current = document.activeElement;
    document.body.style.overflow = 'hidden';

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey);
    requestAnimationFrame(() => {
      panelRef.current?.querySelector('a, button')?.focus();
    });

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
      prevFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  return (
    <>
      <div className="nl-mobile-overlay" onClick={onClose} aria-hidden="true" hidden={!isOpen} />
      <div
        className="nl-mobile-panel"
        ref={panelRef}
        role="dialog"
        aria-modal={isOpen ? 'true' : undefined}
        aria-label="Navigation menu"
        hidden={!isOpen}
      >
        <button className="nl-mobile-close" onClick={onClose} aria-label="Close menu">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="nl-mobile-sections">
          {sections.map((item, idx) => {
            if (item.kind === 'dropdown') {
              return (
                <MobileDropdown
                  key={idx}
                  label={item.label}
                  items={item.items}
                  onNavigate={onClose}
                />
              );
            }
            return (
              <NavAnchor
                key={item.href}
                href={item.href}
                className="nl-mobile-link"
                onClick={onClose}
              >
                {item.label}
              </NavAnchor>
            );
          })}
        </div>

        {children && <div className="nl-mobile-utility">{children}</div>}
      </div>
    </>
  );
}

function MobileDropdown({ label, items, onNavigate }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="nl-mobile-dd">
      <button
        className="nl-mobile-link nl-mobile-dd-trigger"
        onClick={() => setExpanded((o) => !o)}
        aria-expanded={expanded}
      >
        {label}
        <span
          className="nl-dd-arrow"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
        >
          &#9662;
        </span>
      </button>
      {expanded && (
        <div className="nl-mobile-dd-items">
          {items.map((item, idx) => {
            if (item.divider) return <div key={`d${idx}`} className="nl-dd-divider" />;
            if (item.heading) return <div key={`h${idx}`} className="nl-dd-heading">{item.heading}</div>;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`nl-mobile-dd-item${item.accent ? ' accent' : ''}`}
                onClick={onNavigate}
              >
                {item.label}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BrandBar — unified top nav
// ═══════════════════════════════════════════════════════════════

export function BrandBar({
  surface,
  authState = 'out',
  user = null,
  onSignOut,
  onSignIn,
  onOpenChat,
}) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const config = surfaceConfig[surface];

  // Each surface uses its own sections. When logged out, a surface can
  // provide sectionsOut (e.g. invest shows cross-product links until
  // marketing routes like Overview/Pricing exist).
  const sections = (authState === 'out' && config.sectionsOut) || config.sections;
  const showSwitcher = true;
  const showBuilderCta = config.builderCta;
  const showAuth = true;

  // Admin detection (invest authenticated only)
  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim());
  const isAdmin =
    surface === 'invest' &&
    authState === 'in' &&
    user?.email &&
    adminEmails.some((e) => e.toLowerCase() === user.email.toLowerCase());

  const effectiveSections = isAdmin
    ? [...sections, { kind: 'link', label: 'Admin', href: '/invest/admin' }]
    : sections;

  // Active-state helpers
  const isActive = (href) => location.pathname === href;
  const isOnMarketing = [
    '/how-we',
    '/track-record',
    '/probability-engine',
    '/strategy-selection',
    '/technical-analysis',
    '/gamma-analysis',
    '/ai-sentiment',
    '/ai-portfolio',
  ].some((p) => location.pathname.startsWith(p));

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // User initials for avatar
  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email
      ? user.email.charAt(0).toUpperCase()
      : 'U';

  // ── Ask AI button (shared between desktop + mobile) ──
  const askAiBtn = authState === 'in' && onOpenChat ? (
    <button
      className="nl-nav-pill"
      onClick={() => { onOpenChat(); closeMobile(); }}
      title="Ask NewLeaf AI Assistant"
      style={{ gap: 6 }}
    >
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
      Ask AI
    </button>
  ) : null;

  return (
    <nav className="nl-nav">
      {/* ── Brand zone ── */}
      <div className="nl-brand-zone">
        <Link to="/" className="nl-nav-brand">
          <img src="/logo-icon.png" width="36" height="36" alt="NewLeaf" />
          <span className="nl-nav-wordmark">
            NewLeaf <em>System</em>
          </span>
        </Link>
        {showSwitcher && <ProductSwitcher currentSurface={surface} />}
      </div>

      {/* ── Section nav (desktop) ── */}
      <ul className="nl-nav-links">
        {effectiveSections.map((item, idx) => {
          if (item.kind === 'dropdown') {
            return (
              <NavDropdown
                key={idx}
                label={item.label}
                items={item.items}
                dark={item.dark}
                isActive={
                  item.label === 'How it works' ? isOnMarketing : false
                }
              />
            );
          }
          return (
            <li key={item.href}>
              <NavAnchor
                href={item.href}
                className={`nl-nav-link${isActive(item.href) ? ' active' : ''}`}
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                {item.label}
              </NavAnchor>
            </li>
          );
        })}
      </ul>

      {/* ── Utility zone (desktop) ── */}
      <div className="nl-nav-right">
        {surface === 'invest' && authState === 'in' && <MarketStatusPill />}

        {askAiBtn}

        {showBuilderCta && (
          <a href="/workbench/strategy-builder.html" className="nl-nav-pill">
            Try Builder &rarr;
          </a>
        )}

        {showAuth &&
          (authState === 'in' ? (
            <div className="nl-nav-user">
              <div className="nl-nav-avatar">{initials}</div>
              <button
                onClick={onSignOut}
                className="nl-nav-ghost"
                style={{ height: 'auto', padding: '0 12px' }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <>
              <button className="nl-nav-ghost" onClick={onSignIn}>
                Sign In
              </button>
              <Link to="/invest" className="nl-nav-cta">
                Get Started &rarr;
              </Link>
            </>
          ))}
      </div>

      {/* ── Mobile hamburger (visible ≤860 px) ── */}
      <button
        className="nl-hamburger"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* ── Mobile menu ── */}
      <MobileMenu
        isOpen={mobileOpen}
        onClose={closeMobile}
        sections={effectiveSections}
      >
        {/* Utility items for mobile (no status indicators — matches existing mobile UX) */}
        {askAiBtn}

        {showBuilderCta && (
          <a
            href="/workbench/strategy-builder.html"
            className="nl-nav-pill nl-mobile-btn"
            onClick={closeMobile}
          >
            Try Builder &rarr;
          </a>
        )}

        {showAuth &&
          (authState === 'in' ? (
            <div className="nl-mobile-auth">
              <div className="nl-nav-avatar">{initials}</div>
              <button
                onClick={() => { onSignOut?.(); closeMobile(); }}
                className="nl-nav-ghost"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <>
              <button
                className="nl-nav-ghost nl-mobile-btn"
                onClick={() => { onSignIn?.(); closeMobile(); }}
              >
                Sign In
              </button>
              <Link
                to="/invest"
                className="nl-nav-cta nl-mobile-btn"
                onClick={closeMobile}
              >
                Get Started &rarr;
              </Link>
            </>
          ))}
      </MobileMenu>
    </nav>
  );
}
