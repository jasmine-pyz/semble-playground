import { Card, SembleAPI } from "./api";

export interface TopicCluster {
  id: string;
  name: string;
  cards: Card[];
  keywords: string[];
  centroid?: string | TFIDFVector; // ✅ Can be either
}

// Common English stopwords to filter out
const STOPWORDS = new Set([
  "the",
  "be",
  "to",
  "of",
  "and",
  "a",
  "in",
  "that",
  "have",
  "i",
  "it",
  "for",
  "not",
  "on",
  "with",
  "he",
  "as",
  "you",
  "do",
  "at",
  "this",
  "but",
  "his",
  "by",
  "from",
  "they",
  "we",
  "say",
  "her",
  "she",
  "or",
  "an",
  "will",
  "my",
  "one",
  "all",
  "would",
  "there",
  "their",
  "what",
  "so",
  "up",
  "out",
  "if",
  "about",
  "who",
  "get",
  "which",
  "go",
  "me",
  "when",
  "make",
  "can",
  "like",
  "time",
  "no",
  "just",
  "him",
  "know",
  "take",
  "people",
  "into",
  "year",
  "your",
  "good",
  "some",
  "could",
  "them",
  "see",
  "other",
  "than",
  "then",
  "now",
  "look",
  "only",
  "come",
  "its",
  "over",
  "think",
  "also",
  "back",
  "after",
  "use",
  "two",
  "how",
  "our",
  "work",
  "first",
  "well",
  "way",
  "even",
  "new",
  "want",
  "because",
  "any",
  "these",
  "give",
  "day",
  "most",
  "us",
  "is",
  "was",
  "are",
  "been",
  "has",
  "had",
  "were",
  "said",
  "did",
  "having",
  "may",
  "should",
  "am",
  "being",
  "does",
]);

// ============================================================================
// TF-IDF Vector Type
// ============================================================================

interface TFIDFVector {
  [word: string]: number;
}

// ============================================================================
// Simple Clustering Methods
// ============================================================================

export function clusterBySiteName(cards: Card[]): TopicCluster[] {
  const clusters = new Map<string, Card[]>();

  cards.forEach((card) => {
    const siteName = card.metadata?.siteName || "Uncategorized";

    if (!clusters.has(siteName)) {
      clusters.set(siteName, []);
    }

    clusters.get(siteName)!.push(card);
  });

  return Array.from(clusters.entries())
    .map(([siteName, cards]) => ({
      id: siteName.toLowerCase().replace(/\s+/g, "-"),
      name: siteName,
      cards,
      keywords: extractKeywordsTFIDF(cards),
    }))
    .sort((a, b) => b.cards.length - a.cards.length);
}

export function clusterByCardContentTitle(cards: Card[]): TopicCluster[] {
  const clusters = new Map<string, Card[]>();

  cards.forEach((card) => {
    const type = card.cardContent?.title || "no title";

    if (!clusters.has(type)) {
      clusters.set(type, []);
    }

    clusters.get(type)!.push(card);
  });

  return Array.from(clusters.entries())
    .map(([type, cards]) => ({
      id: type,
      name: type.charAt(0).toUpperCase() + type.slice(1),
      cards,
      keywords: extractKeywordsTFIDF(cards),
    }))
    .sort((a, b) => b.cards.length - a.cards.length);
}

// ============================================================================
// TF-IDF + Agglomerative Clustering
// ============================================================================

/**
 * TF-IDF + Agglomerative Clustering
 * Pure client-side, no API calls needed!
 */
export function clusterByTFIDF(
  cards: Card[],
  numClusters = 5,
  similarityThreshold = 0.3
): TopicCluster[] {
  console.log(`📊 Starting TF-IDF clustering for ${cards.length} cards`);

  // Step 1: Normalize titles + descriptions and extract tokens
  const documents = cards.map((card) => ({
    card,
    tokens: normalizeAndTokenize(getCardText(card)), // ✅ Use helper
  }));

  console.log(`📝 Extracted tokens from ${documents.length} documents`);

  // Step 2: Calculate TF-IDF vectors
  const tfidfVectors = calculateTFIDF(documents.map((d) => d.tokens));

  console.log(`🔢 Calculated TF-IDF vectors (${tfidfVectors.length} docs)`);

  // Step 3: Agglomerative clustering with cosine similarity
  const clusters = agglomerativeClustering(
    documents.map((d) => d.card),
    tfidfVectors,
    numClusters,
    similarityThreshold
  );

  console.log(`✅ Created ${clusters.length} clusters`);

  // Step 4: Label clusters by top TF-IDF keywords
  const labeledClusters = clusters.map((cluster, idx) => {
    const clusterDocs = cluster.cards.map((card) =>
      normalizeAndTokenize(getCardText(card))
    );
    const keywords = extractTopTFIDFKeywords(clusterDocs, 5);

    return {
      id: `cluster-${idx}`,
      name: generateClusterNameFromKeywords(keywords, cluster.cards),
      cards: cluster.cards,
      keywords,
    };
  });

  return labeledClusters.sort((a, b) => b.cards.length - a.cards.length);
}

// ============================================================================
// STEP 1: Normalization & Tokenization
// ============================================================================

/**
 * ✅ Extract all available text from a card
 */
function getCardText(card: Card): string {
  const parts = [
    card.metadata?.title,
    card.cardContent?.title,
    card.cardContent?.description, // ✅ Now using description!
    card.metadata?.description,
  ].filter(Boolean);

  return parts.join(" ");
}

function normalizeAndTokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // Remove punctuation
    .split(/\s+/)
    .filter((word) => word.length > 3) // Min length 4
    .filter((word) => !STOPWORDS.has(word)); // Remove stopwords
}

// ============================================================================
// STEP 2: TF-IDF Calculation
// ============================================================================

function calculateTFIDF(documents: string[][]): TFIDFVector[] {
  const N = documents.length; // Total documents
  const df = new Map<string, number>(); // Document frequency

  // Calculate document frequency (how many docs contain each word)
  documents.forEach((tokens) => {
    const uniqueTokens = new Set(tokens);
    uniqueTokens.forEach((token) => {
      df.set(token, (df.get(token) || 0) + 1);
    });
  });

  // Calculate TF-IDF for each document
  return documents.map((tokens) => {
    const tf = new Map<string, number>();
    const vector: TFIDFVector = {};

    // Term frequency
    tokens.forEach((token) => {
      tf.set(token, (tf.get(token) || 0) + 1);
    });

    // TF-IDF = TF * IDF
    tf.forEach((count, token) => {
      const termFreq = count / tokens.length;
      const inverseDocFreq = Math.log(N / (df.get(token) || 1));
      vector[token] = termFreq * inverseDocFreq;
    });

    return vector;
  });
}

// ============================================================================
// STEP 3: Agglomerative Clustering
// ============================================================================

function agglomerativeClustering(
  cards: Card[],
  vectors: TFIDFVector[],
  numClusters: number,
  threshold: number
): TopicCluster[] {
  // Initialize: each card is its own cluster
  let clusters: TopicCluster[] = cards.map((card, idx) => ({
    id: `temp-${idx}`,
    name: "",
    cards: [card],
    keywords: [],
    centroid: vectors[idx],
  }));

  console.log(`🔗 Starting with ${clusters.length} singleton clusters`);

  // Merge until we have desired number of clusters OR similarity too low
  while (clusters.length > numClusters) {
    // Find most similar pair
    let maxSimilarity = -1;
    let mergeI = -1;
    let mergeJ = -1;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const sim = cosineSimilarity(
          clusters[i].centroid as TFIDFVector,
          clusters[j].centroid as TFIDFVector
        );

        if (sim > maxSimilarity) {
          maxSimilarity = sim;
          mergeI = i;
          mergeJ = j;
        }
      }
    }

    // Stop if similarity below threshold
    if (maxSimilarity < threshold) {
      console.log(
        `⛔ Stopping merge at similarity ${maxSimilarity.toFixed(3)}`
      );
      break;
    }

    // Merge clusters i and j
    console.log(
      `🔗 Merging cluster ${mergeI} (${clusters[mergeI].cards.length} cards) + ` +
        `cluster ${mergeJ} (${clusters[mergeJ].cards.length} cards) - ` +
        `similarity: ${maxSimilarity.toFixed(3)}`
    );

    const merged = {
      id: clusters[mergeI].id,
      name: "",
      cards: [...clusters[mergeI].cards, ...clusters[mergeJ].cards],
      keywords: [],
      centroid: averageVectors([
        clusters[mergeI].centroid as TFIDFVector,
        clusters[mergeJ].centroid as TFIDFVector,
      ]),
    };

    // Remove old clusters and add merged one
    clusters = [
      ...clusters.slice(0, mergeI),
      ...clusters.slice(mergeI + 1, mergeJ),
      ...clusters.slice(mergeJ + 1),
      merged,
    ];
  }

  console.log(`✅ Final cluster count: ${clusters.length}`);
  return clusters;
}

// ============================================================================
// STEP 4: Keyword Extraction & Labeling
// ============================================================================

function extractTopTFIDFKeywords(documents: string[][], topK = 5): string[] {
  if (documents.length === 0) return [];

  const tfidf = calculateTFIDF(documents);

  // Aggregate TF-IDF scores across all documents in cluster
  const aggregated: { [word: string]: number } = {};

  tfidf.forEach((vector) => {
    Object.entries(vector).forEach(([word, score]) => {
      aggregated[word] = (aggregated[word] || 0) + score;
    });
  });

  // Get top K keywords
  return Object.entries(aggregated)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([word]) => word);
}

function generateClusterNameFromKeywords(
  keywords: string[],
  cards: Card[]
): string {
  // Strategy 1: Use top 2 keywords
  if (keywords.length >= 2) {
    return capitalizeWords(`${keywords[0]} ${keywords[1]}`);
  }

  // Strategy 2: Use top keyword
  if (keywords.length >= 1) {
    return capitalizeWords(keywords[0]);
  }

  // Strategy 3: If all same site, use site name
  const sites = new Set(cards.map((c) => c.metadata?.siteName).filter(Boolean));
  if (sites.size === 1) {
    return Array.from(sites)[0] as string;
  }

  // Fallback
  return "Mixed Topics";
}

// ============================================================================
// Helper Functions
// ============================================================================

function cosineSimilarity(v1: TFIDFVector, v2: TFIDFVector): number {
  const words = new Set([...Object.keys(v1), ...Object.keys(v2)]);

  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  words.forEach((word) => {
    const a = v1[word] || 0;
    const b = v2[word] || 0;
    dotProduct += a * b;
    mag1 += a * a;
    mag2 += b * b;
  });

  if (mag1 === 0 || mag2 === 0) return 0;

  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

function averageVectors(vectors: TFIDFVector[]): TFIDFVector {
  const result: TFIDFVector = {};
  const allWords = new Set<string>();

  vectors.forEach((v) => {
    Object.keys(v).forEach((word) => allWords.add(word));
  });

  allWords.forEach((word) => {
    const sum = vectors.reduce((acc, v) => acc + (v[word] || 0), 0);
    result[word] = sum / vectors.length;
  });

  return result;
}

function capitalizeWords(str: string): string {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function extractKeywordsTFIDF(cards: Card[]): string[] {
  const docs = cards.map((card) => normalizeAndTokenize(getCardText(card)));
  return extractTopTFIDFKeywords(docs, 5);
}

// Legacy API-based clustering (keeping for reference)
export async function clusterBySemanticAPI(
  api: SembleAPI,
  cards: Card[],
  numClusters = 5
): Promise<TopicCluster[]> {
  console.log("⚠️ Deprecated: Use clusterByTFIDF instead for better results");
  return clusterByTFIDF(cards, numClusters);
}
