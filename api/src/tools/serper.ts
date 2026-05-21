export interface SearchResult {
  title: string;
  snippet: string;
  link: string;
  date?: string;
}

export interface SearchResults {
  news: SearchResult[];
  web: SearchResult[];
  query: string;
}

async function serperFetch(query: string, type: 'search' | 'news'): Promise<SearchResult[]> {
  const url = type === 'news' ? 'https://google.serper.dev/news' : 'https://google.serper.dev/search';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY ?? '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num: 10 }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Serper ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`);
  const data = await res.json() as any;

  if (type === 'news') {
    return (data.news ?? []).map((r: any) => ({
      title: r.title ?? '',
      snippet: r.snippet ?? '',
      link: r.link ?? '',
      date: r.date ?? '',
    }));
  }
  return (data.organic ?? []).map((r: any) => ({
    title: r.title ?? '',
    snippet: r.snippet ?? '',
    link: r.link ?? '',
  }));
}

export async function searchForSentiment(ticker: string, daysWindow: number): Promise<SearchResults> {
  // Run news and social searches in parallel
  const [news, reddit, social] = await Promise.all([
    serperFetch(`${ticker} stock news options`, 'news'),
    serperFetch(`${ticker} stock reddit options wallstreetbets site:reddit.com`, 'search'),
    serperFetch(`${ticker} stock sentiment earnings catalyst`, 'news'),
  ]);

  // Merge and deduplicate
  const allNews = [...news, ...social];
  const seen = new Set<string>();
  const deduped = allNews.filter(r => {
    if (seen.has(r.link)) return false;
    seen.add(r.link);
    return true;
  });

  return {
    news: deduped.slice(0, 10),
    web: reddit.slice(0, 5),
    query: `${ticker} stock sentiment/news/catalysts`,
  };
}
