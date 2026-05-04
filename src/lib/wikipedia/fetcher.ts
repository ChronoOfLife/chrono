/**
 * fetcher.ts
 * Fetches Wikipedia REST API summaries with timeout and graceful fallback.
 */

export interface WikiSummary {
  extract: string;
  thumbnail?: { source: string; width: number; height: number };
  title: string;
  description?: string;
}

/**
 * Fetch a Wikipedia page summary.
 * Returns null on any error, timeout, or non-OK response.
 *
 * @param title - Wikipedia article title (spaces allowed; will be URL-encoded)
 * @param timeoutMs - abort after this many milliseconds (default 5000)
 */
export async function fetchWikiSummary(
  title: string,
  timeoutMs = 5000
): Promise<WikiSummary | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const slug = encodeURIComponent(title.replace(/ /g, '_'));
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) return null;

    const data = await res.json();

    return {
      extract: data.extract ?? '',
      thumbnail: data.thumbnail,
      title: data.title ?? title,
      description: data.description,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
