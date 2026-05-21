import { Link } from 'react-router-dom';
import { getRelatedPosts } from '../blogPosts';

export default function RelatedPosts({ currentSlug }) {
  const posts = getRelatedPosts(currentSlug, 3);
  if (!posts.length) return null;

  return (
    <section className="blog-related">
      <h3 className="blog-related-heading">Related Articles</h3>
      <div className="blog-related-grid">
        {posts.map(p => (
          <Link key={p.slug} to={`/blog/${p.slug}`} className="blog-related-card">
            <span className="blog-related-cat">{p.category}</span>
            <span className="blog-related-title">{p.title}</span>
            <span className="blog-related-meta">{p.readTime} read</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
