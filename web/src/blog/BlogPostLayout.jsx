import { lazy, Suspense, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import PageSEO from '../shared/components/PageSEO';
import RelatedPosts from './components/RelatedPosts';
import TableOfContents from './components/TableOfContents';
import { getPostBySlug } from './blogPosts';

export default function BlogPostLayout() {
  const { slug } = useParams();
  const post = getPostBySlug(slug);
  const [headings, setHeadings] = useState([]);

  useEffect(() => {
    // Extract headings after post renders
    const timer = setTimeout(() => {
      const els = document.querySelectorAll('.blog-content h2[id]');
      setHeadings(Array.from(els).map(el => ({ id: el.id, text: el.textContent })));
    }, 100);
    return () => clearTimeout(timer);
  }, [slug]);

  if (!post) {
    return (
      <div style={{ padding: '80px 2rem', textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#0B2D23' }}>Post not found</h1>
        <Link to="/blog" style={{ color: '#C9A96E', marginTop: 16, display: 'inline-block' }}>Back to blog</Link>
      </div>
    );
  }

  const PostComponent = lazy(post.component);

  return (
    <div style={{ background: '#F7F4EE', minHeight: '60vh' }}>
      <PageSEO
        title={post.title}
        description={post.description}
        path={`/blog/${post.slug}`}
        type="article"
        article={{
          publishedTime: post.date,
          modifiedTime: post.date,
          section: post.category,
          tags: post.tags,
        }}
      />

      {/* Breadcrumb */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 2rem 0' }}>
        <nav style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#6b6b60' }}>
          <Link to="/" style={{ color: '#6b6b60', textDecoration: 'none' }}>Home</Link>
          {' / '}
          <Link to="/blog" style={{ color: '#6b6b60', textDecoration: 'none' }}>Blog</Link>
          {' / '}
          <span style={{ color: '#0B2D23' }}>{post.title}</span>
        </nav>
      </div>

      {/* Article header */}
      <header style={{ maxWidth: 720, margin: '0 auto', padding: '32px 2rem 40px' }}>
        <span style={{
          display: 'inline-block', fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700,
          letterSpacing: '.1em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: 12,
        }}>
          {post.category}
        </span>
        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(28px, 4vw, 42px)',
          fontWeight: 700, color: '#0B2D23', lineHeight: 1.2, marginBottom: 16,
        }}>
          {post.title}
        </h1>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#6b6b60', display: 'flex', gap: 16 }}>
          <span>NewLeaf System Team</span>
          <span>{post.date}</span>
          <span>{post.readTime} read</span>
        </div>
      </header>

      {/* Content area with sidebar */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 60px', display: 'flex', gap: 48, alignItems: 'flex-start' }}>
        <article className="blog-content" style={{ flex: 1, minWidth: 0, maxWidth: 720 }}>
          <Suspense fallback={<div style={{ minHeight: 400 }} />}>
            <PostComponent />
          </Suspense>
        </article>

        {/* Sidebar — desktop only */}
        <aside className="blog-sidebar" style={{ width: 280, flexShrink: 0, position: 'sticky', top: 100 }}>
          <TableOfContents headings={headings} />
        </aside>
      </div>

      {/* CTA */}
      <section style={{
        background: '#0B2D23', padding: '48px 2rem', textAlign: 'center',
      }}>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, color: '#F7F4EE', marginBottom: 12 }}>
          Ready to put these strategies to work?
        </h2>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: 'rgba(255,255,255,.6)', marginBottom: 24, maxWidth: 480, margin: '0 auto 24px' }}>
          NewLeaf System scans 108 stocks across 8 strategies with AI-powered scoring.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/picks" style={{ background: '#C9A96E', color: '#0B2D23', padding: '12px 28px', borderRadius: 6, textDecoration: 'none', fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
            View This Week's Picks
          </Link>
          <Link to="/learn" style={{ border: '1px solid rgba(201,169,110,.45)', color: '#C9A96E', padding: '12px 28px', borderRadius: 6, textDecoration: 'none', fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
            Explore Strategies
          </Link>
        </div>
      </section>

      {/* Related posts */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 2rem 80px' }}>
        <RelatedPosts currentSlug={slug} />
      </div>
    </div>
  );
}
