import { Link, useLocation } from 'react-router-dom'

export default function Navigation() {
  const location = useLocation()

  const isActive = path => {
    if (path === '/invest') return location.pathname === '/invest'
    return location.pathname.startsWith(path)
  }

  return (
    <nav
      className="sticky top-0 z-50"
      style={{
        background: 'rgba(255,255,255,0.98)',
        borderBottom: '1px solid var(--nl-border)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="max-w-[1600px] mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--nl-primary-green)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '14px',
              }}
            >
              🌿
            </div>
            <div>
              <span style={{ color: 'var(--nl-text)', fontWeight: '900', fontSize: '15px', letterSpacing: '-0.2px' }}>
                NewLeaf
              </span>
              <span style={{ color: 'var(--nl-soft-gold)', marginLeft: '4px', fontWeight: '600', fontSize: '14px' }}>
                Gamma
              </span>
            </div>
          </div>

          {/* Nav Links */}
          <div className="flex items-center gap-2">
            <Link
              to="/invest"
              className="px-4 py-1.5 text-sm font-semibold rounded-lg transition-all"
              style={{
                background: isActive('/invest') ? 'var(--nl-primary-green)' : 'transparent',
                border: isActive('/invest') ? 'none' : '1px solid var(--nl-border)',
                color: isActive('/invest') ? 'white' : 'var(--nl-muted-text)',
                textDecoration: 'none',
              }}
            >
              Discover
            </Link>

            <Link
              to="/invest/gamma/GOOG"
              className="px-4 py-1.5 text-sm font-semibold rounded-lg transition-all"
              style={{
                background: isActive('/invest/gamma') ? 'var(--nl-primary-green)' : 'transparent',
                border: isActive('/invest/gamma') ? 'none' : '1px solid var(--nl-border)',
                color: isActive('/invest/gamma') ? 'white' : 'var(--nl-muted-text)',
                textDecoration: 'none',
              }}
            >
              Analysis
            </Link>

            <Link
              to="/invest/compare"
              className="px-4 py-1.5 text-sm font-semibold rounded-lg transition-all"
              style={{
                background: isActive('/invest/compare') ? 'var(--nl-primary-green)' : 'transparent',
                border: isActive('/invest/compare') ? 'none' : '1px solid var(--nl-border)',
                color: isActive('/invest/compare') ? 'white' : 'var(--nl-muted-text)',
                textDecoration: 'none',
              }}
            >
              Compare
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
