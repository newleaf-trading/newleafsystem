import { useState } from 'react';
import PageSEO from '../shared/components/PageSEO';
import BlogCard from './components/BlogCard';
import { blogPosts, blogCategories } from './blogPosts';

export default function BlogIndexPage() {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? blogPosts : blogPosts.filter(p => p.category === filter);

  return (
    <div style={{ background: '#F7F4EE', minHeight: '60vh' }}>
      <PageSEO
        title="Options Trading Blog | NewLeaf System"
        description="Options trading education, strategy guides, risk management frameworks, and income trading plans from the NewLeaf System team."
        path="/blog"
      />

      {/* Hero */}
      <section style={{ padding: '64px 2rem 40px', textAlign: 'center' }}>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: 12 }}>
          Options Trading Insights
        </p>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, color: '#0B2D23', marginBottom: 12 }}>
          The NewLeaf <em style={{ color: '#C9A96E', fontStyle: 'italic' }}>Blog</em>
        </h1>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, color: '#6b6b60', maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
          Strategies, risk management, and trading education to help you trade options with confidence.
        </p>
      </section>

      {/* Category filters */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '0 2rem 40px', flexWrap: 'wrap' }}>
        {blogCategories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setFilter(cat.id)}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '.06em',
              padding: '8px 18px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              transition: 'all .18s',
              background: filter === cat.id ? '#0B2D23' : 'rgba(11,45,35,.06)',
              color: filter === cat.id ? '#F7F4EE' : '#0B2D23',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Post grid */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 80px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
        {filtered.map(post => (
          <BlogCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
}
