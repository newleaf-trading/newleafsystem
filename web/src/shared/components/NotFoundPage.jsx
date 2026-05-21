import { Link } from 'react-router-dom';
import PageSEO from './PageSEO';

export default function NotFoundPage() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', background: '#F7F4EE' }}>
      <PageSEO title="Page Not Found" description="The page you're looking for doesn't exist." path="/404" />
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 72, fontWeight: 700, color: '#0B2D23', marginBottom: 8 }}>404</div>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 600, color: '#0B2D23', marginBottom: 12 }}>Page not found</h1>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: '#6b6b60', lineHeight: 1.6, marginBottom: 32 }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/" style={{ background: '#0B2D23', color: '#F7F4EE', padding: '10px 24px', borderRadius: 6, textDecoration: 'none', fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: '.04em' }}>Home</Link>
          <Link to="/blog" style={{ background: '#C9A96E', color: '#0B2D23', padding: '10px 24px', borderRadius: 6, textDecoration: 'none', fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: '.04em' }}>Blog</Link>
          <Link to="/learn" style={{ border: '1px solid #0B2D23', color: '#0B2D23', padding: '10px 24px', borderRadius: 6, textDecoration: 'none', fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: '.04em' }}>Learn</Link>
        </div>
      </div>
    </div>
  );
}
