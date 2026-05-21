import { Link } from 'react-router-dom';

const CATEGORY_COLORS = {
  Strategies: '#0B2D23',
  Fundamentals: '#2d5a4a',
  'Risk Management': '#8b4513',
  'Income Trading': '#C9A96E',
};

export default function BlogCard({ post }) {
  const badgeColor = CATEGORY_COLORS[post.category] || '#0B2D23';

  return (
    <Link to={`/blog/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <article className="blog-card">
        <span className="blog-card-badge" style={{ background: badgeColor }}>
          {post.category}
        </span>
        <h3 className="blog-card-title">{post.title}</h3>
        <p className="blog-card-desc">{post.description}</p>
        <div className="blog-card-meta">
          <span>{post.date}</span>
          <span>{post.readTime} read</span>
        </div>
      </article>
    </Link>
  );
}
