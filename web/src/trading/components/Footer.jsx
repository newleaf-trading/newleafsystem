export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        {/* Left — Brand + compliance */}
        <div className="footer-disclaimer">
          <div style={{ marginBottom: 10 }}>
            <span style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,.75)',
            }}>
              NewLeaf <em style={{ color: '#C9A96E', fontStyle: 'italic', fontWeight: 500 }}>System</em>
            </span>
            <span style={{
              display: 'block',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12, color: 'rgba(255,255,255,.38)',
              marginTop: 2,
            }}>
              The structured trading system.
            </span>
          </div>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11, color: 'rgba(255,255,255,.3)',
            marginBottom: 8,
            letterSpacing: '.04em',
          }}>
            Picks &middot; Workbench &middot; Invest &middot; Builder
          </div>
          Options involve risk and are not suitable for all investors. Past performance does not guarantee future results.
          NewLeaf System provides structured options strategy frameworks for educational purposes only. All investments carry risk of loss.
        </div>

        {/* Right - Links */}
        <div className="footer-links">
          <a href="/blog" className="footer-link">
            Blog
          </a>
          <a href="/terms-and-conditions" className="footer-link">
            Terms
          </a>
          <a href="/privacy-policy" className="footer-link">
            Privacy Policy
          </a>
        </div>
      </div>
    </footer>
  );
}
