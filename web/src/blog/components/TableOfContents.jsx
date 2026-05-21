import { useState, useEffect } from 'react';

export default function TableOfContents({ headings }) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.find(e => e.isIntersecting);
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );
    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [headings]);

  if (!headings.length) return null;

  return (
    <nav className="blog-toc">
      <div className="blog-toc-title">Contents</div>
      {headings.map(({ id, text }) => (
        <a
          key={id}
          href={`#${id}`}
          className={`blog-toc-link${activeId === id ? ' active' : ''}`}
        >
          {text}
        </a>
      ))}
    </nav>
  );
}
