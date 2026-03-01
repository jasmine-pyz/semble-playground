/**
 * URL normalization utilities to ensure consistent URL comparison
 * Use this if debug logs reveal URL format mismatches
 */

/**
 * Prepare content for embedding (combine title, description, author, siteName)
 * This matches the same logic used by the Semble API for generating embeddings
 */
export function prepareContentForEmbedding(
  title?: string,
  description?: string,
  author?: string,
  siteName?: string
): string {
  const parts: string[] = [];

  if (title) parts.push(title);
  if (description) parts.push(description);
  if (author) parts.push(`by ${author}`);
  if (siteName) parts.push(`from ${siteName}`);

  return parts.join(" ");
}

/**
 * Normalize a URL for consistent comparison
 * - Converts to lowercase
 * - Ensures https protocol
 * - Removes trailing slashes
 * - Removes www. prefix
 * - Sorts query parameters
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Convert to lowercase
    let normalized = url.toLowerCase();

    // Remove trailing slash from pathname
    if (urlObj.pathname.endsWith("/") && urlObj.pathname.length > 1) {
      normalized = normalized.replace(/\/$/, "");
    }

    // Remove www. prefix
    normalized = normalized.replace(/^(https?:\/\/)www\./, "$1");

    // Optional: Sort query parameters for consistent comparison
    // Uncomment if query params should be normalized
    // const params = new URLSearchParams(urlObj.search);
    // params.sort();
    // const sortedParams = params.toString();
    // const base = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    // normalized = sortedParams ? `${base}?${sortedParams}` : base;

    return normalized;
  } catch (error) {
    // If URL parsing fails, return original
    console.warn(`Failed to normalize URL: ${url}`, error);
    return url;
  }
}

/**
 * Create a Set of normalized URLs from cards
 */
export function createNormalizedUrlSet(
  cards: Array<{ url: string }>
): Set<string> {
  return new Set(cards.map((c) => normalizeUrl(c.url)));
}
