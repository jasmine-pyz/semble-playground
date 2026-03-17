import { Card } from "./api";

// ============================================================================
// Types
// ============================================================================

export interface TopicCluster {
  id: string;
  name: string;
  cards: Card[];
  keywords: string[];
}

type TFIDFVector = Map<string, number>;

// ============================================================================
// Stopwords
// ============================================================================

const STOPWORDS = new Set([
  "the",
  "be",
  "to",
  "of",
  "and",
  "a",
  "in",
  "that",
  "for",
  "on",
  "with",
  "as",
  "at",
  "by",
  "from",
  "or",
  "an",
  "its",
  "into",
  "than",
  "then",
  "about",
  "after",
  "over",
  "also",
  "back",
  "even",
  "our",
  "your",
  "their",
  "this",
  "these",
  "those",
  "what",
  "which",
  "who",
  "when",
  "where",
  "how",
  "i",
  "he",
  "she",
  "they",
  "we",
  "you",
  "me",
  "him",
  "her",
  "them",
  "us",
  "my",
  "his",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "am",
  "are",
  "was",
  "were",
  "been",
  "being",
  "say",
  "said",
  "get",
  "make",
  "go",
  "know",
  "take",
  "see",
  "come",
  "give",
  "look",
  "want",
  "think",
  "just",
  "only",
  "now",
  "up",
  "out",
  "no",
  "not",
  "so",
  "but",
  "if",
  "all",
  "one",
  "two",
  "most",
  "some",
  "any",
  "other",
  "more",
]);

// ============================================================================
// Text extraction & tokenization
// ============================================================================

function getCardText(card: Card): string {
  return [
    card.cardContent?.title,
    card.cardContent?.description,
    card.cardContent?.siteName,
    card.cardContent?.author,
  ]
    .filter(Boolean)
    .join(" ");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .filter((w) => !STOPWORDS.has(w));
}

// ============================================================================
// TF-IDF — smoothed IDF, Map-based
// ============================================================================

function buildTFIDF(documents: string[][]): TFIDFVector[] {
  const N = documents.length;
  const df = new Map<string, number>();

  for (const tokens of documents) {
    for (const token of new Set(tokens)) {
      df.set(token, (df.get(token) ?? 0) + 1);
    }
  }

  return documents.map((tokens) => {
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }

    const vector = new Map<string, number>();
    for (const [token, count] of tf) {
      const termFreq = count / tokens.length;
      const idf = Math.log((N + 1) / ((df.get(token) ?? 1) + 1)) + 1;
      vector.set(token, termFreq * idf);
    }
    return vector;
  });
}

// ============================================================================
// Vector math
// ============================================================================

function cosineSimilarity(a: TFIDFVector, b: TFIDFVector): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];

  let dot = 0;
  for (const [word, aVal] of small) {
    const bVal = large.get(word);
    if (bVal !== undefined) dot += aVal * bVal;
  }

  let mag1 = 0,
    mag2 = 0;
  for (const v of a.values()) mag1 += v * v;
  for (const v of b.values()) mag2 += v * v;

  if (mag1 === 0 || mag2 === 0) return 0;
  return dot / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

function cosineDistance(a: TFIDFVector, b: TFIDFVector): number {
  return 1 - cosineSimilarity(a, b);
}

function weightedAverageCentroid(vectors: TFIDFVector[]): TFIDFVector {
  // Simple average — all cards weighted equally within a cluster
  const result = new Map<string, number>();
  for (const vec of vectors) {
    for (const [word, val] of vec) {
      result.set(word, (result.get(word) ?? 0) + val);
    }
  }
  for (const [word, sum] of result) {
    result.set(word, sum / vectors.length);
  }
  return result;
}

// ============================================================================
// K-Means (cosine distance)
// ============================================================================

const KMEANS_MAX_ITER = 50;
const KMEANS_RUNS = 3; // multiple restarts, pick best inertia

function kMeans(
  vectors: TFIDFVector[],
  k: number
): { assignments: number[]; centroids: TFIDFVector[]; inertia: number } {
  let bestResult = {
    assignments: [] as number[],
    centroids: [] as TFIDFVector[],
    inertia: Infinity,
  };

  for (let run = 0; run < KMEANS_RUNS; run++) {
    // KMeans++ initialization — smarter seeding than random
    const centroids = kMeansPlusPlusInit(vectors, k);
    let assignments = new Array(vectors.length).fill(0);

    for (let iter = 0; iter < KMEANS_MAX_ITER; iter++) {
      // Assignment step
      const newAssignments = vectors.map((vec) => {
        let minDist = Infinity;
        let closest = 0;
        for (let c = 0; c < centroids.length; c++) {
          const dist = cosineDistance(vec, centroids[c]);
          if (dist < minDist) {
            minDist = dist;
            closest = c;
          }
        }
        return closest;
      });

      // Check convergence
      const converged = newAssignments.every((a, i) => a === assignments[i]);
      assignments = newAssignments;
      if (converged) break;

      // Update step — recompute centroids
      for (let c = 0; c < k; c++) {
        const clusterVecs = vectors.filter((_, i) => assignments[i] === c);
        if (clusterVecs.length > 0) {
          centroids[c] = weightedAverageCentroid(clusterVecs);
        }
        // If a cluster is empty, reinitialize its centroid randomly
        // (rare with KMeans++ but guard anyway)
        else {
          centroids[c] = vectors[Math.floor(Math.random() * vectors.length)];
        }
      }
    }

    // Compute inertia (within-cluster sum of distances)
    const inertia = vectors.reduce((sum, vec, i) => {
      return sum + cosineDistance(vec, centroids[assignments[i]]);
    }, 0);

    if (inertia < bestResult.inertia) {
      bestResult = { assignments, centroids, inertia };
    }
  }

  return bestResult;
}

function kMeansPlusPlusInit(vectors: TFIDFVector[], k: number): TFIDFVector[] {
  const centroids: TFIDFVector[] = [];

  // Pick first centroid randomly
  centroids.push(vectors[Math.floor(Math.random() * vectors.length)]);

  for (let c = 1; c < k; c++) {
    // Each point's probability = its distance to nearest existing centroid
    const distances = vectors.map((vec) => {
      const minDist = Math.min(
        ...centroids.map((cent) => cosineDistance(vec, cent))
      );
      return minDist * minDist; // squared distance as probability weight
    });

    const totalDist = distances.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalDist;

    for (let i = 0; i < vectors.length; i++) {
      rand -= distances[i];
      if (rand <= 0) {
        centroids.push(vectors[i]);
        break;
      }
    }

    // Fallback if floating point issues
    if (centroids.length === c)
      centroids.push(vectors[Math.floor(Math.random() * vectors.length)]);
  }

  return centroids;
}

// ============================================================================
// agglomerative clustering + a similarity threshold
// ============================================================================

function averageLinkSimilarity(
  clusterA: number[],
  clusterB: number[],
  vectors: DenseVector[]
): number {
  let sum = 0;
  let count = 0;

  for (const i of clusterA) {
    for (const j of clusterB) {
      sum += cosineSimDense(vectors[i], vectors[j]);
      count++;
    }
  }

  return count === 0 ? -1 : sum / count;
}

function agglomerativeClusterDense(
  vectors: DenseVector[],
  similarityThreshold: number
): number[][] {
  let clusters: number[][] = vectors.map((_, i) => [i]);

  while (clusters.length > 1) {
    let bestI = -1;
    let bestJ = -1;
    let bestSim = -Infinity;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const sim = averageLinkSimilarity(clusters[i], clusters[j], vectors);
        if (Number.isFinite(sim) && sim > bestSim) {
          // ← guard NaN
          bestSim = sim;
          bestI = i;
          bestJ = j;
        }
      }
    }

    // ← also guard bestI/bestJ being -1
    if (bestSim < similarityThreshold || bestI === -1) break;

    const merged = [...clusters[bestI], ...clusters[bestJ]];
    clusters = clusters.filter((_, idx) => idx !== bestI && idx !== bestJ);
    clusters.push(merged);
  }

  return clusters;
}

export async function clusterByEmbeddingAgg(
  cards: Card[],
  options: { similarityThreshold?: number; model?: string } = {}
): Promise<TopicCluster[]> {
  if (cards.length === 0) return [];

  if (cards.length <= 3) {
    return clusterByTFIDF(cards, {
      kMin: 1,
      kMax: Math.max(1, cards.length - 1),
    });
  }

  const { similarityThreshold = 0.72, model } = options;

  let vectors: DenseVector[];
  try {
    vectors = await fetchEmbeddings(cards, model);
  } catch (err) {
    console.warn("Embedding fetch failed, falling back to TF-IDF:", err);
    return clusterByTFIDF(cards);
  }

  const clusters = agglomerativeClusterDense(vectors, similarityThreshold);

  const tokenized = cards.map((card) => tokenize(getCardText(card)));
  const tfidfVectors = buildTFIDF(tokenized);

  return clusters
    .map((clusterIndices, idx) => {
      const clusterCards = clusterIndices.map((i) => cards[i]);
      const clusterTFIDF = clusterIndices.map((i) => tfidfVectors[i]);
      const keywords = extractKeywordsFromVectors(clusterTFIDF, 5);

      return {
        id: `cluster-${idx}`,
        name: generateClusterName(keywords, clusterCards),
        cards: clusterCards,
        keywords,
      };
    })
    .sort((a, b) => b.cards.length - a.cards.length);
}

// ============================================================================
// agglomerative clustering (K-means + agglomerative hybrid)
// ============================================================================

export async function clusterByEmbeddingHybrid(
  cards: Card[],
  options: {
    kMin?: number;
    kMax?: number;
    similarityThreshold?: number;
    model?: string;
  } = {}
): Promise<TopicCluster[]> {
  if (cards.length === 0) return [];

  const { kMin = 5, kMax = 20, similarityThreshold = 0.72, model } = options;

  let vectors: DenseVector[];
  try {
    vectors = await fetchEmbeddings(cards, model);
  } catch (err) {
    console.warn(
      "[hybrid] Embedding fetch failed, falling back to TF-IDF:",
      err
    );
    return clusterByTFIDF(cards, { kMin, kMax });
  }

  const t0 = performance.now();

  // Phase 1: k-means for rough clusters
  const effectiveKMax = Math.min(kMax, cards.length - 1);
  const effectiveKMin = Math.min(kMin, effectiveKMax);
  const k = findOptimalKDense(vectors, effectiveKMin, effectiveKMax);
  const { assignments } = kMeansDense(vectors, k);

  console.log(
    `[hybrid] k-means phase: k=${k} in ${(performance.now() - t0).toFixed(1)}ms`
  );

  // Group indices by k-means cluster
  const kMeansClusters = new Map<number, number[]>();
  for (let i = 0; i < assignments.length; i++) {
    const c = assignments[i];
    if (!kMeansClusters.has(c)) kMeansClusters.set(c, []);
    kMeansClusters.get(c)!.push(i);
  }

  // Phase 2: agglomerative within each k-means cluster
  const t1 = performance.now();
  const finalClusters: number[][] = [];

  for (const [kCluster, indices] of kMeansClusters) {
    if (indices.length <= 2) {
      // Too small to sub-cluster meaningfully
      finalClusters.push(indices);
      continue;
    }

    const subVectors = indices.map((i) => vectors[i]);
    const subClusters = agglomerativeClusterDenseHeap(
      subVectors,
      similarityThreshold
    );

    // Map sub-indices back to original card indices
    for (const subCluster of subClusters) {
      finalClusters.push(subCluster.map((si) => indices[si]));
    }

    console.log(
      `[hybrid] k-means cluster ${kCluster} (size=${indices.length}) → ${subClusters.length} sub-clusters`
    );
  }

  console.log(
    `[hybrid] agglomerative phase: ${finalClusters.length} total clusters in ${(
      performance.now() - t1
    ).toFixed(1)}ms`
  );

  // Label using TF-IDF keywords
  const tokenized = cards.map((card) => tokenize(getCardText(card)));
  const tfidfVectors = buildTFIDF(tokenized);

  return finalClusters
    .map((clusterIndices, idx) => {
      const clusterCards = clusterIndices.map((i) => cards[i]);
      const clusterTFIDF = clusterIndices.map((i) => tfidfVectors[i]);
      const keywords = extractKeywordsFromVectors(clusterTFIDF, 5);
      return {
        id: `cluster-${idx}`,
        name: generateClusterName(keywords, clusterCards),
        cards: clusterCards,
        keywords,
      };
    })
    .sort((a, b) => b.cards.length - a.cards.length);
}

// ============================================================================
// agglomerative clustering ( Agglomerative with a min-heap:
// The heap stores all pairs sorted by similarity (descending),
// so instead of re-scanning all pairs each iteration you just pop the top.
// The catch is that after a merge, pairs involving the old clusters are stale
// and need to be invalidated — we handle that with a deleted set.
// ============================================================================

interface HeapEntry {
  sim: number;
  i: number;
  j: number;
}

class MaxHeap {
  private data: HeapEntry[] = [];

  push(entry: HeapEntry) {
    this.data.push(entry);
    this._bubbleUp(this.data.length - 1);
  }

  pop(): HeapEntry | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  get size() {
    return this.data.length;
  }

  private _bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[parent].sim >= this.data[i].sim) break;
      [this.data[parent], this.data[i]] = [this.data[i], this.data[parent]];
      i = parent;
    }
  }

  private _sinkDown(i: number) {
    const n = this.data.length;
    while (true) {
      let largest = i;
      const l = 2 * i + 1,
        r = 2 * i + 2;
      if (l < n && this.data[l].sim > this.data[largest].sim) largest = l;
      if (r < n && this.data[r].sim > this.data[largest].sim) largest = r;
      if (largest === i) break;
      [this.data[largest], this.data[i]] = [this.data[i], this.data[largest]];
      i = largest;
    }
  }
}

function agglomerativeClusterDenseHeap(
  vectors: DenseVector[],
  similarityThreshold: number
): number[][] {
  const t0 = performance.now();
  const n = vectors.length;

  // Each cluster is identified by an integer ID
  let nextId = n;
  const clusters = new Map<number, number[]>(); // id → member indices
  for (let i = 0; i < n; i++) clusters.set(i, [i]);

  // Centroid per cluster (normalized average for cosine similarity)
  const centroids = new Map<number, DenseVector>();
  for (let i = 0; i < n; i++) centroids.set(i, vectors[i]);

  // Populate heap with all initial pairs — O(n² log n)
  const heap = new MaxHeap();
  const deleted = new Set<number>(); // cluster IDs that have been merged away

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimDense(vectors[i], vectors[j]);
      if (Number.isFinite(sim)) heap.push({ sim, i, j });
    }
  }

  let mergeCount = 0;
  let stalePops = 0;

  while (heap.size > 0 && clusters.size > 1) {
    const entry = heap.pop()!;
    const { sim, i, j } = entry;

    // Skip stale entries (one or both clusters no longer exist)
    if (deleted.has(i) || deleted.has(j)) {
      stalePops++;
      continue;
    }

    if (sim < similarityThreshold) {
      console.log(
        `[heap-agg] Best similarity ${sim.toFixed(
          4
        )} below threshold — stopping at ${clusters.size} clusters`
      );
      break;
    }

    // Merge j into i, assign new ID
    const mergedId = nextId++;
    const mergedMembers = [...clusters.get(i)!, ...clusters.get(j)!];
    const mergedCentroid = avgDenseVectors([
      centroids.get(i)!,
      centroids.get(j)!,
    ]);

    clusters.delete(i);
    clusters.delete(j);
    deleted.add(i);
    deleted.add(j);

    clusters.set(mergedId, mergedMembers);
    centroids.set(mergedId, mergedCentroid);

    // Add new pairs between merged cluster and all surviving clusters — O(k log n)
    for (const [existingId] of clusters) {
      if (existingId === mergedId) continue;
      const sim = cosineSimDense(mergedCentroid, centroids.get(existingId)!);
      if (Number.isFinite(sim)) {
        heap.push({ sim, i: mergedId, j: existingId });
      }
    }

    mergeCount++;
  }

  console.log(
    `[heap-agg] Done in ${(performance.now() - t0).toFixed(
      1
    )}ms — ${mergeCount} merges, ${stalePops} stale pops, ${
      clusters.size
    } final clusters`
  );

  return [...clusters.values()];
}

export async function clusterByEmbeddingAggHeap(
  cards: Card[],
  options: { similarityThreshold?: number; model?: string } = {}
): Promise<TopicCluster[]> {
  if (cards.length === 0) return [];

  if (cards.length <= 3) {
    return clusterByTFIDF(cards, {
      kMin: 1,
      kMax: Math.max(1, cards.length - 1),
    });
  }

  const { similarityThreshold = 0.72, model } = options;

  let vectors: DenseVector[];
  try {
    vectors = await fetchEmbeddings(cards, model);
  } catch (err) {
    console.warn(
      "[heap-agg] Embedding fetch failed, falling back to TF-IDF:",
      err
    );
    return clusterByTFIDF(cards);
  }

  const clusters = agglomerativeClusterDenseHeap(vectors, similarityThreshold);

  const tokenized = cards.map((card) => tokenize(getCardText(card)));
  const tfidfVectors = buildTFIDF(tokenized);

  return clusters
    .map((clusterIndices, idx) => {
      const clusterCards = clusterIndices.map((i) => cards[i]);
      const clusterTFIDF = clusterIndices.map((i) => tfidfVectors[i]);
      const keywords = extractKeywordsFromVectors(clusterTFIDF, 5);
      return {
        id: `cluster-${idx}`,
        name: generateClusterName(keywords, clusterCards),
        cards: clusterCards,
        keywords,
      };
    })
    .sort((a, b) => b.cards.length - a.cards.length);
}

// ============================================================================
// Elbow method — find optimal k in range [kMin, kMax]
// ============================================================================

function findOptimalK(
  vectors: TFIDFVector[],
  kMin: number,
  kMax: number
): number {
  const inertias: number[] = [];
  const ks = Array.from({ length: kMax - kMin + 1 }, (_, i) => i + kMin);

  for (const k of ks) {
    const { inertia } = kMeans(vectors, k);
    inertias.push(inertia);
  }

  // Find elbow: biggest drop in the *rate of decrease*
  // i.e. where d²(inertia)/dk² is maximized (second derivative)
  if (inertias.length < 3) return kMin;

  let maxCurvature = -Infinity;
  let elbowIdx = 0;

  for (let i = 1; i < inertias.length - 1; i++) {
    // Second difference as proxy for curvature
    const curvature = inertias[i - 1] - 2 * inertias[i] + inertias[i + 1];
    if (curvature > maxCurvature) {
      maxCurvature = curvature;
      elbowIdx = i;
    }
  }

  return ks[elbowIdx];
}

// ============================================================================
// Keywords — reuse pre-computed vectors
// ============================================================================

function extractKeywordsFromVectors(
  vectors: TFIDFVector[],
  topK: number
): string[] {
  const aggregated = new Map<string, number>();
  for (const vec of vectors) {
    for (const [word, score] of vec) {
      aggregated.set(word, (aggregated.get(word) ?? 0) + score);
    }
  }
  return [...aggregated.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([word]) => word);
}

function generateClusterName(keywords: string[], cards: Card[]): string {
  if (keywords.length >= 2)
    return capitalizeWords(`${keywords[0]} & ${keywords[1]}`);
  if (keywords.length === 1) return capitalizeWords(keywords[0]);
  const sites = new Set(cards.map((c) => c.metadata?.siteName).filter(Boolean));
  if (sites.size === 1) return Array.from(sites)[0] as string;
  return "Mixed Topics";
}

function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Main clustering function.
 * Uses k-means with KMeans++ init + elbow detection over k=kMin..kMax.
 * No fixed numClusters — the elbow picks it from the data.
 */
export function clusterByTFIDF(
  cards: Card[],
  options: {
    kMin?: number; // default: 5
    kMax?: number; // default: 20
  } = {}
): TopicCluster[] {
  if (cards.length === 0) return [];
  if (cards.length === 1) {
    const tokens = tokenize(getCardText(cards[0]));
    return [
      {
        id: "cluster-0",
        name:
          cards[0].metadata?.title ?? cards[0].cardContent?.title ?? "Untitled",
        cards,
        keywords: tokens.slice(0, 5),
      },
    ];
  }

  const { kMin = 5, kMax = 20 } = options;

  // Clamp kMax to cards.length - 1 (can't have more clusters than cards)
  const effectiveKMax = Math.min(kMax, cards.length - 1);
  const effectiveKMin = Math.min(kMin, effectiveKMax);

  // Step 1: tokenize + TF-IDF (once)
  const tokenized = cards.map((card) => tokenize(getCardText(card)));
  const vectors = buildTFIDF(tokenized);

  // Step 2: find optimal k via elbow
  const k = findOptimalK(vectors, effectiveKMin, effectiveKMax);
  console.log(`🔢 Elbow method selected k=${k} for ${cards.length} cards`);

  // Step 3: final k-means run with optimal k
  const { assignments } = kMeans(vectors, k);

  // Step 4: group cards by cluster assignment
  const clusterMap = new Map<
    number,
    { cards: Card[]; vectors: TFIDFVector[] }
  >();
  for (let i = 0; i < cards.length; i++) {
    const c = assignments[i];
    if (!clusterMap.has(c)) clusterMap.set(c, { cards: [], vectors: [] });
    clusterMap.get(c)!.cards.push(cards[i]);
    clusterMap.get(c)!.vectors.push(vectors[i]);
  }

  // Step 5: label using already-computed per-card vectors
  return [...clusterMap.entries()]
    .map(([idx, { cards: clusterCards, vectors: clusterVectors }]) => {
      const keywords = extractKeywordsFromVectors(clusterVectors, 5);
      return {
        id: `cluster-${idx}`,
        name: generateClusterName(keywords, clusterCards),
        cards: clusterCards,
        keywords,
      };
    })
    .sort((a, b) => b.cards.length - a.cards.length);
}

export function clusterBySiteName(cards: Card[]): TopicCluster[] {
  console.log("sample card:", JSON.stringify(cards[0], null, 2)); // add this
  const groups = new Map<string, Card[]>();
  for (const card of cards) {
    const key = card.cardContent?.siteName || "Uncategorized";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(card);
  }
  return [...groups.entries()]
    .map(([name, groupCards]) => ({
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      cards: groupCards,
      keywords: extractKeywordsFromVectors(
        buildTFIDF(groupCards.map((c) => tokenize(getCardText(c)))),
        5
      ),
    }))
    .sort((a, b) => b.cards.length - a.cards.length);
}

// ============================================================================
// Embedding-based clustering (Ollama via /api/embed)
// ============================================================================

type DenseVector = number[];

function cosineSimDense(a: DenseVector, b: DenseVector): number {
  let dot = 0,
    mag1 = 0,
    mag2 = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    mag1 += a[i] * a[i];
    mag2 += b[i] * b[i];
  }
  if (mag1 === 0 || mag2 === 0) return 0;
  return dot / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

function cosineDistDense(a: DenseVector, b: DenseVector): number {
  return 1 - cosineSimDense(a, b);
}

// function avgDenseVectors(vectors: DenseVector[]): DenseVector {
//   if (vectors.length === 0) return [];
//   const dim = vectors[0].length;
//   const result = new Array(dim).fill(0);
//   for (const v of vectors) {
//     for (let i = 0; i < dim; i++) result[i] += v[i];
//   }
//   return result.map((x) => x / vectors.length);
// }

function normalizeDense(v: DenseVector): DenseVector {
  let mag = 0;
  for (let i = 0; i < v.length; i++) {
    mag += v[i] * v[i];
  }

  if (mag === 0) return v;

  const norm = Math.sqrt(mag);
  return v.map((x) => x / norm);
}

function avgDenseVectors(vectors: DenseVector[]): DenseVector {
  if (vectors.length === 0) return [];

  const dim = vectors[0].length;
  const result = new Array(dim).fill(0);

  for (const v of vectors) {
    for (let i = 0; i < dim; i++) {
      result[i] += v[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    result[i] /= vectors.length;
  }

  return normalizeDense(result);
}

async function fetchEmbeddings(
  cards: Card[],
  model?: string
): Promise<DenseVector[]> {
  const payload = {
    cards: cards.map((c) => ({ id: c.id, text: getCardText(c) })),
    ...(model ? { model } : {}),
  };

  const res = await fetch("/api/embed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Embedding API error: ${res.status} — ${msg}`);
  }

  const { embeddings }: { embeddings: { id: string; embedding: number[] }[] } =
    await res.json();

  // Preserve original card order
  const byId = new Map(embeddings.map((e) => [e.id, e.embedding]));
  return cards.map((c) => {
    const embedding = byId.get(c.id);
    if (!embedding) {
      throw new Error(`Missing embedding for card ${c.id}`);
    }
    return normalizeDense(embedding);
  });
}

// Dense k-means — identical logic to TF-IDF version, just number[] not Map
function kMeansDense(
  vectors: DenseVector[],
  k: number
): { assignments: number[]; centroids: DenseVector[]; inertia: number } {
  let best = {
    assignments: [] as number[],
    centroids: [] as DenseVector[],
    inertia: Infinity,
  };

  for (let run = 0; run < 3; run++) {
    const centroids = kMeansPlusPlusInitDense(vectors, k);
    let assignments = new Array(vectors.length).fill(0);

    for (let iter = 0; iter < 50; iter++) {
      const newAssignments = vectors.map((vec) => {
        let minDist = Infinity,
          closest = 0;
        for (let c = 0; c < centroids.length; c++) {
          const dist = cosineDistDense(vec, centroids[c]);
          if (dist < minDist) {
            minDist = dist;
            closest = c;
          }
        }
        return closest;
      });

      const converged = newAssignments.every((a, i) => a === assignments[i]);
      assignments = newAssignments;
      if (converged) break;

      for (let c = 0; c < k; c++) {
        const clusterVecs = vectors.filter((_, i) => assignments[i] === c);
        centroids[c] =
          clusterVecs.length > 0
            ? avgDenseVectors(clusterVecs)
            : vectors[Math.floor(Math.random() * vectors.length)];
      }
    }

    const inertia = vectors.reduce(
      (sum, vec, i) => sum + cosineDistDense(vec, centroids[assignments[i]]),
      0
    );
    if (inertia < best.inertia) best = { assignments, centroids, inertia };
  }

  return best;
}

function kMeansPlusPlusInitDense(
  vectors: DenseVector[],
  k: number
): DenseVector[] {
  const centroids: DenseVector[] = [];
  centroids.push(vectors[Math.floor(Math.random() * vectors.length)]);

  for (let c = 1; c < k; c++) {
    const distances = vectors.map((vec) => {
      const minDist = Math.min(
        ...centroids.map((cent) => cosineDistDense(vec, cent))
      );
      return minDist * minDist;
    });
    const total = distances.reduce((a, b) => a + b, 0);
    let rand = Math.random() * total;
    let chosen = vectors[vectors.length - 1];
    for (let i = 0; i < vectors.length; i++) {
      rand -= distances[i];
      if (rand <= 0) {
        chosen = vectors[i];
        break;
      }
    }
    centroids.push(chosen);
  }

  return centroids;
}

function findOptimalKDense(
  vectors: DenseVector[],
  kMin: number,
  kMax: number
): number {
  const inertias: number[] = [];
  const ks = Array.from({ length: kMax - kMin + 1 }, (_, i) => i + kMin);

  for (const k of ks) {
    const { inertia } = kMeansDense(vectors, k);
    inertias.push(inertia);
  }

  if (inertias.length < 3) return kMin;

  let maxCurvature = -Infinity,
    elbowIdx = 0;
  for (let i = 1; i < inertias.length - 1; i++) {
    const curvature = inertias[i - 1] - 2 * inertias[i] + inertias[i + 1];
    if (curvature > maxCurvature) {
      maxCurvature = curvature;
      elbowIdx = i;
    }
  }

  return ks[elbowIdx];
}

/**
 * Clusters cards using dense embeddings from Ollama.
 * Falls back to clusterByTFIDF if Ollama is unreachable.
 */
export async function clusterByEmbedding(
  cards: Card[],
  options: { kMin?: number; kMax?: number; model?: string } = {}
): Promise<TopicCluster[]> {
  if (cards.length === 0) return [];

  const { kMin = 5, kMax = 20, model } = options;

  // Step 1: fetch embeddings (cached on server after first call)
  let vectors: DenseVector[];

  try {
    vectors = await fetchEmbeddings(cards, model);
  } catch (err) {
    console.warn("Embedding fetch failed, falling back to TF-IDF:", err);
    if (cards.length <= 3) {
      return clusterByTFIDF(cards, {
        kMin: 1,
        kMax: Math.max(1, cards.length - 1),
      });
    }
    return clusterByTFIDF(cards, { kMin, kMax });
  }

  // Step 2: elbow over k range
  const effectiveKMax = Math.min(kMax, cards.length - 1);
  const effectiveKMin = Math.min(kMin, effectiveKMax);
  const k = findOptimalKDense(vectors, effectiveKMin, effectiveKMax);

  console.log(`Embedding clustering: k=${k} for ${cards.length} cards`);

  // Step 3: final k-means
  const { assignments } = kMeansDense(vectors, k);

  // Step 4: group + label (TF-IDF keywords on the text side — embeddings don't give words)
  const tokenized = cards.map((card) => tokenize(getCardText(card)));
  const tfidfVectors = buildTFIDF(tokenized);

  const clusterMap = new Map<
    number,
    { cards: Card[]; vectors: TFIDFVector[] }
  >();
  for (let i = 0; i < cards.length; i++) {
    const c = assignments[i];
    if (!clusterMap.has(c)) clusterMap.set(c, { cards: [], vectors: [] });
    clusterMap.get(c)!.cards.push(cards[i]);
    clusterMap.get(c)!.vectors.push(tfidfVectors[i]);
  }

  return [...clusterMap.entries()]
    .map(([idx, { cards: clusterCards, vectors: clusterVectors }]) => {
      const keywords = extractKeywordsFromVectors(clusterVectors, 5);
      return {
        id: `cluster-${idx}`,
        name: generateClusterName(keywords, clusterCards),
        cards: clusterCards,
        keywords,
      };
    })
    .sort((a, b) => b.cards.length - a.cards.length);
}

function formatType(type: string): string {
  const labels: Record<string, string> = {
    software: "Software & Tools",
    social: "Social & Community",
  };
  return labels[type] ?? capitalizeWords(type);
}

export function clusterByType(cards: Card[]): TopicCluster[] {
  const groups = new Map<string, Card[]>();
  for (const card of cards) {
    const key = card.cardContent?.type || "uncategorized";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(card);
  }
  return [...groups.entries()]
    .map(([type, groupCards], idx) => ({
      id: `type-${idx}`,
      name: formatType(type),
      cards: groupCards,
      keywords: extractKeywordsFromVectors(
        buildTFIDF(groupCards.map((c) => tokenize(getCardText(c)))),
        5
      ),
    }))
    .sort((a, b) => b.cards.length - a.cards.length);
}
