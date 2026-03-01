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
 * Get recommendations using semantic search based on cluster topics
 * Uses cluster keywords to find semantically similar content
 */
export async function getRecommendations(
  api: SembleAPI,
  clusters: TopicCluster[],
  existingCards: Card[],
  maxClusters = 5,
  resultsPerCluster = 10
): Promise<Recommendation[]> {
  // Build a Set of existing URLs AND content signatures
  const existingUrls = new Set(existingCards.map((c) => c.url));
  const existingContentSignatures = new Set(
    existingCards.map((c) =>
      getContentSignature(
        c.metadata?.title || c.cardContent?.title,
        c.metadata?.description || c.cardContent?.description,
        c.metadata?.author,
        c.metadata?.siteName
      )
    )
  );

  console.log(`🔍 Getting recommendations for ${maxClusters} clusters`);
  console.log(
    `📚 Existing URLs in library (${existingUrls.size}):`,
    Array.from(existingUrls).slice(0, 5)
  );
  console.log(`📝 Total cards in library: ${existingCards.length}`);
  console.log(
    `🔖 Content signatures created: ${existingContentSignatures.size}`
  );

  // Take top N clusters (largest/most important)
  const topClusters = clusters
    .slice(0, maxClusters)
    .filter((c) => c.keywords.length > 0); // Only clusters with keywords

  console.log(
    `📊 Using clusters: ${topClusters.map((c) => c.name).join(", ")}`
  );

  // For each cluster, search using its keywords
  const searchPromises = topClusters.map(async (cluster) => {
    // Create search query from top keywords
    const query = cluster.keywords.slice(0, 3).join(" ");

    console.log(
      `🔎 Searching for cluster "${cluster.name}" with query: "${query}"`
    );

    try {
      const results = await api.semanticSearch(query, {
        limit: resultsPerCluster,
        threshold: 0.4, // Moderate threshold for relevance
      });

      return {
        clusterName: cluster.name,
        results,
      };
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

  allResults.forEach(({ clusterName, results }) => {
    console.log(
      `🔄 Processing cluster "${clusterName}" with ${results.urls.length} results`
    );

    results.urls.forEach((urlData) => {
      // Create content signature for this recommendation
      const contentSig = getContentSignature(
        urlData.metadata?.title,
        urlData.metadata?.description,
        urlData.metadata?.author,
        urlData.metadata?.siteName
      );

      // DEBUG: Log first few URLs to check format
      if (urlScores.size < 3) {
        console.log(`🔎 Checking URL: "${urlData.url}"`);
        console.log(`   Content: "${contentSig}"`);
        console.log(
          `   Already in library (URL)? ${existingUrls.has(urlData.url)}`
        );
        console.log(
          `   Already in library (content)? ${existingContentSignatures.has(
            contentSig
          )}`
        );
      }

      // Skip if already in user's library (by URL OR content signature)
      if (
        existingUrls.has(urlData.url) ||
        existingContentSignatures.has(contentSig)
      ) {
        return;
      }

      const existing = urlScores.get(urlData.url);

      if (existing) {
        // Boost score if appears in multiple cluster searches
        existing.score += 1;
        existing.appearsInClusters.push(clusterName);
      } else {
        urlScores.set(urlData.url, {
          url: urlData.url,
          title: urlData.metadata?.title,
          description: urlData.metadata?.description,
          siteName: urlData.metadata?.siteName,
          score: 1, // Base score
          appearsInClusters: [clusterName],
          urlLibraryCount: urlData.urlLibraryCount,
        });
      }
    });
  });

  console.log(
    `📦 Found ${urlScores.size} unique recommendations (after filtering)`
  );
  console.log(`🚫 Filtered out URLs already in library (URL-based)`);
  console.log(`🚫 Filtered out URLs already in library (content-based)`);

  // Sort by:
  // 1. Score (appears in multiple clusters = more relevant)
  // 2. urlLibraryCount (popularity)
  const sortedRecs = Array.from(urlScores.values()).sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.urlLibraryCount - a.urlLibraryCount;
  });

  // FINAL CHECK: Verify no recommendations are in existing URLs (by URL or content)
  const urlDuplicates = sortedRecs.filter((rec) => existingUrls.has(rec.url));
  const contentDuplicates = sortedRecs.filter((rec) => {
    const sig = getContentSignature(
      rec.title,
      rec.description,
      undefined, // author not available in recommendations
      rec.siteName
    );
    return existingContentSignatures.has(sig);
  });

  if (urlDuplicates.length > 0) {
    console.warn(
      `⚠️ WARNING: Found ${urlDuplicates.length} URL duplicates that should have been filtered!`
    );
    console.warn(`   First duplicate: ${urlDuplicates[0].url}`);
  } else if (contentDuplicates.length > 0) {
    console.warn(
      `⚠️ WARNING: Found ${contentDuplicates.length} content duplicates that should have been filtered!`
    );
    console.warn(`   First duplicate: ${contentDuplicates[0].url}`);
  } else {
    console.log(`✅ Verified: No duplicates in final recommendations`);
  }

  return sortedRecs;
}

/**
 * Alternative: Get recommendations using similar URLs
 * Uses representative cards from each cluster
 * (Keep this as a fallback option)
 */
export async function getRecommendationsBySimilarUrls(
  api: SembleAPI,
  clusters: TopicCluster[],
  existingCards: Card[],
  maxClusters = 5,
  cardsPerCluster = 3
): Promise<Recommendation[]> {
  const existingUrls = new Set(existingCards.map((c) => c.url));
  const existingContentSignatures = new Set(
    existingCards.map((c) =>
      getContentSignature(
        c.metadata?.title || c.cardContent?.title,
        c.metadata?.description || c.cardContent?.description,
        c.metadata?.author,
        c.metadata?.siteName
      )
    )
  );

  console.log(
    `🔍 Getting recommendations via similar URLs for ${maxClusters} clusters`
  );

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

  allResults.forEach(({ clusterName, results }) => {
    results.urls.forEach((urlData) => {
      const contentSig = getContentSignature(
        urlData.metadata?.title,
        urlData.metadata?.description,
        urlData.metadata?.author,
        urlData.metadata?.siteName
      );

      // Skip if already in user's library (by URL OR content signature)
      if (
        existingUrls.has(urlData.url) ||
        existingContentSignatures.has(contentSig)
      ) {
        return;
      }

      const existing = urlScores.get(urlData.url);

      if (existing) {
        existing.score += 1;
        existing.appearsInClusters.push(clusterName);
      } else {
        urlScores.set(urlData.url, {
          url: urlData.url,
          title: urlData.metadata?.title,
          description: urlData.metadata?.description,
          siteName: urlData.metadata?.siteName,
          score: 1,
          appearsInClusters: [clusterName],
          urlLibraryCount: urlData.urlLibraryCount,
        });
      }
    });
  });

  return Array.from(urlScores.values()).sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.urlLibraryCount - a.urlLibraryCount;
  });
}
