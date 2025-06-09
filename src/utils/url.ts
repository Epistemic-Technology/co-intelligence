/**
 * Extracts the domain from a URL to use as a fallback title for sources
 */
export function getDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    // If URL parsing fails, try to extract domain manually
    const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
    return match ? match[1] : url;
  }
}

/**
 * Ensures a source has a meaningful title, using domain as fallback
 */
export function ensureSourceTitle(source: { url: string; title?: string }): { url: string; title: string } {
  if (source.title && source.title.trim()) {
    return { ...source, title: source.title.trim() };
  }
  
  return {
    ...source,
    title: getDomainFromUrl(source.url)
  };
}