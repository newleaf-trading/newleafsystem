import { useAuth } from '../hooks/useAuth';
import { AnalysisPage } from '../../trading/pages/AnalysisPage';
import '../../trading/styles/newleaf-system.css';

export default function WorkbenchAnalysisWrapper() {
  const { user, signInWithGoogle } = useAuth();

  return (
    <div style={{ position: 'relative' }}>
      <AnalysisPage />

      {/* Premium gating for anonymous users */}
      {!user && (
        <>
          <style>{`
            /* Blur the gamma insight + deep dive tabs (2nd and 3rd grids after summary cards) */
            .nl-page > div:nth-child(n+5):not(:first-child) {
              filter: blur(5px);
              pointer-events: none;
              user-select: none;
            }
            /* Keep header, tabs, control bar, price chart crisp */
            .nl-page > .nl-page-header,
            .nl-page > div:nth-child(-n+4) {
              filter: none !important;
              pointer-events: auto !important;
              user-select: auto !important;
            }
          `}</style>

          {/* Sign-in overlay */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
            background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.97) 30%, #fff 50%)',
            padding: '80px 2rem 32px', textAlign: 'center',
          }}>
            <div style={{ maxWidth: 520, margin: '0 auto' }}>
              <p style={{
                fontFamily: "'Playfair Display', serif", fontSize: 22, color: '#0B2D23',
                marginBottom: 8, fontWeight: 500,
              }}>
                Sign in to unlock <em style={{ color: '#C9A96E', fontStyle: 'italic' }}>full analysis</em>
              </p>
              <p style={{ fontSize: 13, color: '#6b6b60', marginBottom: 20, lineHeight: 1.6 }}>
                Gamma walls, IV rank, strike heatmaps, and technical indicators are available to signed-in users.
              </p>
              <button
                onClick={signInWithGoogle}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '14px 32px', background: '#0B2D23', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </button>
              <p style={{ fontSize: 11, color: '#6b6b60', marginTop: 10 }}>
                Free to explore. No credit card required.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
