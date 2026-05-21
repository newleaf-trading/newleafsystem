import { Helmet } from 'react-helmet-async';

const BASE_URL = 'https://newleafsystem.com';

export default function PageSEO({
  title,
  description,
  path,
  type = 'website',
  article = null,
  faqItems = null,
}) {
  const fullTitle = title.includes('NewLeaf') ? title : `${title} | NewLeaf System`;
  const url = `${BASE_URL}${path || ''}`;
  const image = `${BASE_URL}/logo-icon.png`;

  const articleJsonLd = type === 'article' && article ? JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: fullTitle,
    description,
    image,
    datePublished: article.publishedTime,
    dateModified: article.modifiedTime || article.publishedTime,
    author: { '@type': 'Organization', name: 'NewLeaf System' },
    publisher: {
      '@type': 'Organization',
      name: 'NewLeaf System',
      logo: { '@type': 'ImageObject', url: image },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  }) : null;

  const faqJsonLd = faqItems?.length ? JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  }) : null;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content={type === 'article' ? 'article' : 'website'} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content="NewLeaf System" />
      <meta property="og:image" content={image} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {type === 'article' && article && (
        <>
          <meta property="article:published_time" content={article.publishedTime} />
          {article.modifiedTime && <meta property="article:modified_time" content={article.modifiedTime} />}
          <meta property="article:author" content="NewLeaf System" />
          {article.section && <meta property="article:section" content={article.section} />}
          {article.tags?.map(tag => <meta key={tag} property="article:tag" content={tag} />)}
        </>
      )}
      {articleJsonLd && <script type="application/ld+json">{articleJsonLd}</script>}
      {faqJsonLd && <script type="application/ld+json">{faqJsonLd}</script>}
    </Helmet>
  );
}
