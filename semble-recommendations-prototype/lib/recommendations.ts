import { SembleAPI, Card } from "./api";
import { TopicCluster } from "./clustering";
import { prepareContentForEmbedding } from "./url-utils";

export interface Recommendation {
  url: string;
  title?: string;
  description?: string;
  siteName?: string;
  score: number;
  appearsInClusters: string[];
  urlLibraryCount: number;
}

/**
 * Create a content signature for a card/URL for comparison
 * Uses the same logic as Semble's embedding generation
 * NOTE: We use ONLY the content (not URL) to catch semantic duplicates
 */
function getContentSignature(
  title?: string,
  description?: string,
  author?: string,
  siteName?: string
): string {
  // Use only content for matching - this helps identify the same content
  // even if URLs differ (e.g., republished articles, AMP versions, etc.)
  return prepareContentForEmbedding(title, description, author, siteName);
}

/**
 * Normalize a URL for comparison:
 * - Lowercase the scheme + host
 * - Remove trailing slashes
 * - Strip common tracking params (utm_*, fbclid, etc.)
 */
function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    // Lowercase scheme and host
    u.hostname = u.hostname.toLowerCase();
    u.protocol = u.protocol.toLowerCase();
    // Remove well-known tracking / session params
    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "msclkid",
      "ref",
      "source",
    ];
    trackingParams.forEach((p) => u.searchParams.delete(p));
    // Remove trailing slash on pathname
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    return u.toString();
  } catch {
    // Not a valid URL — return lowercased original as fallback
    return raw.toLowerCase().trim();
  }
}

/**
 * Build lookup structures from the user's existing library so we can
 * filter recommendations locally — without relying on `urlInLibrary`
 * (which requires authentication and is unavailable here).
 *
 * Two layers of matching:
 *   1. Exact (normalized) URL match  — fast O(1) set lookup
 *   2. Content-signature match        — catches re-published / AMP duplicates
 */
function buildLibraryIndex(existingCards: Card[]): {
  urlSet: Set<string>;
  contentSigSet: Set<string>;
} {
  const urlSet = new Set<string>();
  const contentSigSet = new Set<string>();

  for (const card of existingCards) {
    // Layer 1: normalized URL
    urlSet.add(normalizeUrl(card.url));

    // Layer 2: content signature (skip empty signatures)
    const sig = getContentSignature(
      card.metadata?.title,
      card.metadata?.description,
      card.metadata?.author,
      card.metadata?.siteName
    );
    if (sig.trim().length > 0) {
      contentSigSet.add(sig);
    }
  }

  console.log(
    `📚 Library index built: ${urlSet.size} URLs, ${contentSigSet.size} content signatures`
  );
  return { urlSet, contentSigSet };
}

/**
 * Returns true if a recommended result already exists in the user's library.
 * Checks URL first (cheap), then falls back to content signature (catches dupes).
 */
function isAlreadyInLibrary(
  urlSet: Set<string>,
  contentSigSet: Set<string>,
  candidateUrl: string,
  title?: string,
  description?: string,
  author?: string,
  siteName?: string
): boolean {
  // Layer 1: normalized URL match
  if (urlSet.has(normalizeUrl(candidateUrl))) return true;

  // Layer 2: content signature match
  const sig = getContentSignature(title, description, author, siteName);
  if (sig.trim().length > 0 && contentSigSet.has(sig)) return true;

  return false;
}

/**
 * Get recommendations using semantic search based on cluster topics.
 * Uses cluster keywords to find semantically similar content.
 *
 * NOTE: `urlInLibrary` from the Semble API requires authentication and is
 * NOT used here.  Instead, we build a local index from `existingCards` and
 * filter recommendations against it.
 */
export async function getRecommendations(
  api: SembleAPI,
  clusters: TopicCluster[],
  existingCards: Card[],
  maxClusters = 5,
  resultsPerCluster = 10
): Promise<Recommendation[]> {
  console.log(`🔍 Getting recommendations for ${maxClusters} clusters`);
  console.log(`📝 Total cards in library: ${existingCards.length}`);

  // Build local library index for filtering (replaces urlInLibrary check)
  const { urlSet, contentSigSet } = buildLibraryIndex(existingCards);

  // Take top N clusters (largest/most important)
  const topClusters = clusters
    .slice(0, maxClusters)
    .filter((c) => c.keywords.length > 0);

  console.log(
    `📊 Using clusters: ${topClusters.map((c) => c.name).join(", ")}`
  );

  // For each cluster, search using its keywords
  const searchPromises = topClusters.map(async (cluster) => {
    const query = cluster.keywords.slice(0, 3).join(" ");
    console.log(
      `🔎 Searching for cluster "${cluster.name}" with query: "${query}"`
    );

    try {
      const results = await api.semanticSearch(query, {
        limit: resultsPerCluster,
        threshold: 0.4,
      });
      return { clusterName: cluster.name, results };
    } catch (error) {
      console.error(`❌ Error searching for cluster ${cluster.name}:`, error);
      return {
        clusterName: cluster.name,
        results: { urls: [], pagination: { hasMore: false, currentPage: 1 } },
      };
    }
  });

  const allResults = await Promise.all(searchPromises);
  console.log(`✅ Got results from ${allResults.length} clusters`);

  // Score and deduplicate
  const urlScores = new Map<string, Recommendation>();
  let filteredByLocalIndex = 0;

  allResults.forEach(({ clusterName, results }) => {
    console.log(
      `🔄 Processing cluster "${clusterName}" with ${results.urls.length} results`
    );

    results.urls.forEach((urlData) => {
      const { url, metadata } = urlData;

      // Filter against local library index (auth-free replacement for urlInLibrary)
      if (
        isAlreadyInLibrary(
          urlSet,
          contentSigSet,
          url,
          metadata?.title,
          metadata?.description,
          metadata?.author,
          metadata?.siteName
        )
      ) {
        filteredByLocalIndex++;
        return;
      }

      // DEBUG: log first few candidates
      if (urlScores.size < 3) {
        console.log(`🔎 New candidate URL: "${url}"`);
        console.log(
          `   Content sig: "${getContentSignature(
            metadata?.title,
            metadata?.description,
            metadata?.author,
            metadata?.siteName
          )}"`
        );
      }

      const existing = urlScores.get(url);
      if (existing) {
        existing.score += 1;
        existing.appearsInClusters.push(clusterName);
      } else {
        urlScores.set(url, {
          url,
          title: metadata?.title,
          description: metadata?.description,
          siteName: metadata?.siteName,
          score: 1,
          appearsInClusters: [clusterName],
          urlLibraryCount: urlData.urlLibraryCount,
        });
      }
    });
  });

  console.log(
    `ℹ️ Filtered ${filteredByLocalIndex} results already present in local library index`
  );
  console.log(
    `📦 Found ${urlScores.size} unique recommendations (after filtering)`
  );

  return Array.from(urlScores.values()).sort((a, b) => b.score - a.score);
}

/**
 * Alternative: Get recommendations using similar URLs.
 * Uses representative cards from each cluster as seed URLs.
 *
 * Same auth-free filtering approach as getRecommendations above.
 */
export async function getRecommendationsBySimilarUrls(
  api: SembleAPI,
  clusters: TopicCluster[],
  existingCards: Card[],
  maxClusters = 5,
  cardsPerCluster = 3
): Promise<Recommendation[]> {
  console.log(
    `🔍 Getting recommendations via similar URLs for ${maxClusters} clusters`
  );

  // Build local library index for filtering
  const { urlSet, contentSigSet } = buildLibraryIndex(existingCards);

  const topClusters = clusters.slice(0, maxClusters);

  const searchPromises = topClusters.flatMap((cluster) => {
    const representativeCards = cluster.cards.slice(0, cardsPerCluster);
    return representativeCards.map(async (card) => ({
      clusterName: cluster.name,
      results: await api.getSimilarUrls(card.url, {
        limit: 10,
        threshold: 0.5,
      }),
    }));
  });

  const allResults = await Promise.all(searchPromises);

  const urlScores = new Map<string, Recommendation>();
  let filteredByLocalIndex = 0;

  allResults.forEach(({ clusterName, results }) => {
    results.urls.forEach((urlData) => {
      const { url, metadata } = urlData;

      if (
        isAlreadyInLibrary(
          urlSet,
          contentSigSet,
          url,
          metadata?.title,
          metadata?.description,
          metadata?.author,
          metadata?.siteName
        )
      ) {
        filteredByLocalIndex++;
        return;
      }

      const existing = urlScores.get(url);
      if (existing) {
        existing.score += 1;
        existing.appearsInClusters.push(clusterName);
      } else {
        urlScores.set(url, {
          url,
          title: metadata?.title,
          description: metadata?.description,
          siteName: metadata?.siteName,
          score: 1,
          appearsInClusters: [clusterName],
          urlLibraryCount: urlData.urlLibraryCount,
        });
      }
    });
  });

  console.log(
    `ℹ️ Filtered ${filteredByLocalIndex} results already present in local library index`
  );

  return Array.from(urlScores.values()).sort((a, b) => b.score - a.score);
}
