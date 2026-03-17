"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SembleAPI } from "@/lib/api";
import {
  clusterByTFIDF,
  clusterByType,
  clusterBySiteName,
  clusterByEmbedding,
  clusterByEmbeddingAgg,
  clusterByEmbeddingAggHeap,
} from "@/lib/clustering";
import { getRecommendations } from "@/lib/recommendations";
import { Sparkles, Loader2, TrendingUp } from "lucide-react";

const queryClient = new QueryClient();
type ClusterMode =
  | "tfidf"
  | "type"
  | "site"
  | "embedding-kmeans"
  | "embedding-agglomerative"
  | "embedding-agg-heap";

const MODES: { id: ClusterMode; label: string; description: string }[] = [
  {
    id: "tfidf",
    label: "TF-IDF",
    description:
      "Groups by shared keywords + K-Means (fast, no AI, non-deterministic: results may vary between runs)",
  },

  {
    id: "embedding-kmeans",
    label: "Embedding(1)",
    description:
      "K-Means(via Ollama, nomic-embed-text) - picks K topic centers, assigns each card to its nearest one. Fast but requires guessing the right number of clusters. (non-deterministic)",
  },
  //   {
  //     id: "embedding-agglomerative",
  //     label: "By Embedding(SLOW)",
  //     description:
  //       "Using embeddings (meaning-based) via Ollama (nomic-embed-text) - agglomerative threshold",
  //   },
  {
    id: "embedding-agg-heap",
    label: "Embedding(2)",
    description:
      " agglomerative (via Ollama, nomic-embed-text)starts with every card separate, merges the most similar pairs bottom-up until a threshold is hit. Slower but finds natural cluster boundaries (deterministic).",
  },
  {
    id: "site",
    label: "By Site",
    description: "Groups by source domain",
  },
  {
    id: "type",
    label: "By Type",
    description: "Groups by content type (research, article, video, etc.)",
  },
];
function PrototypeContent() {
  const [userHandle, setUserHandle] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [clusterMode, setClusterMode] = useState<ClusterMode>("tfidf");
  const [recsPage, setRecsPage] = useState(0);
  const RECS_PER_PAGE = 12;
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [clustersPage, setClustersPage] = useState(0);
  const CLUSTERS_PER_PAGE = 12;

  const api = new SembleAPI();

  const { data: library, isLoading: libraryLoading } = useQuery({
    queryKey: ["library", userHandle],
    queryFn: async () => {
      // Fetch all cards (handle pagination)
      let allCards: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await api.getUserCards(userHandle, {
          page,
          limit: 50,
        });
        allCards.push(...response.cards);
        hasMore = response.pagination.hasMore;
        page++;
      }

      return { cards: allCards };
    },
    enabled: !!userHandle,
  });

  // Fix: Make clusters async-aware and handle loading
  const { data: clusters = [], isLoading: clustersLoading } = useQuery({
    queryKey: ["clusters", userHandle, clusterMode, library?.cards.length],
    queryFn: async () => {
      if (!library || library.cards.length === 0) return [];

      switch (clusterMode) {
        case "tfidf":
          return clusterByTFIDF(library.cards); // auto numClusters, silhouette-guided
        case "site":
          return clusterBySiteName(library.cards);
        case "type":
          return clusterByType(library.cards);
        case "embedding-kmeans":
          return await clusterByEmbedding(library.cards, { kMin: 5, kMax: 20 });
        // case "embedding-agglomerative":
        //   return await clusterByEmbeddingAgg(library.cards, {
        //     similarityThreshold: 0.72,
        //   });
        case "embedding-agg-heap":
          return await clusterByEmbeddingAggHeap(library.cards, {
            similarityThreshold: 0.65, // experiment with this value
          });

        default:
          return clusterByTFIDF(library.cards);
      }
    },
    enabled: !!library && library.cards.length > 0,
  });
  const { data: recommendations, isLoading: recsLoading } = useQuery({
    queryKey: [
      "recommendations",
      userHandle,
      clusterMode,
      library?.cards.length,
    ],
    queryFn: async () => {
      const recs = await getRecommendations(
        api,
        clusters,
        library!.cards,
        5,
        20
      );
      return recs;
    },
    enabled: !!library && library.cards.length > 0 && clusters.length > 0,
  });

  // Reset pagination when user, cluster mode, selected cluster, or available recommendations change
  useEffect(() => {
    setRecsPage(0);
  }, [userHandle, clusterMode, selectedCluster, recommendations?.length]);

  // Reset clusters pagination when user, cluster mode, or cluster set changes
  useEffect(() => {
    setClustersPage(0);
  }, [userHandle, clusterMode, clusters?.length]);

  // Clear any selected cluster when the user or clustering mode changes
  useEffect(() => {
    setSelectedCluster(null);
    setRecsPage(0);
  }, [userHandle, clusterMode]);

  // Derived recommendations to display — either all or filtered by selected cluster
  const displayedRecommendations = (recommendations || []).filter((r) =>
    selectedCluster ? r.appearsInClusters.includes(selectedCluster) : true
  );

  // Derived clusters page to display
  const displayedClusters = (clusters || []).slice(
    clustersPage * CLUSTERS_PER_PAGE,
    (clustersPage + 1) * CLUSTERS_PER_PAGE
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) setUserHandle(inputValue.trim());
  };

  if (!userHandle) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-400 to-orange-300 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-8 h-8 text-orange-500" />
            <h1 className="text-2xl font-bold text-gray-900">
              Semble Recommendations
            </h1>
          </div>

          <p className="text-gray-700 mb-6">
            Enter a Bluesky/ATProto handle to see personalized recommendations
            based on saved cards in Semble library.
          </p>

          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="e.g., wesleyfinck.org"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 mb-4 text-gray-900"
            />
            <button
              type="submit"
              className="w-full bg-orange-600 text-white px-4 py-3 rounded-lg hover:bg-orange-500 transition font-medium shadow-lg hover:shadow-xl"
            >
              Get Recommendations
            </button>
          </form>
        </div>
      </div>
    );
  }

  const avgClusterSize =
    clusters.length > 0
      ? Math.round(
          clusters.reduce((sum, c) => sum + c.cards.length, 0) / clusters.length
        )
      : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-2 border-2 border-indigo-100">
          <div className="flex items-center gap-4 mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Recommendations for @{userHandle} (
              {libraryLoading ? (
                <span className="inline-block text-sm text-gray-500 animate-pulse">
                  Loading…
                </span>
              ) : (
                <span>{library?.cards.length ?? 0}</span>
              )}{" "}
              cards)
            </h1>
            {/* User Change Panel */}
            <div className="ml-auto flex-1 flex justify-end">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (inputValue.trim()) {
                    setUserHandle(inputValue.trim());
                  }
                }}
                className="flex items-center gap-3"
              >
                <input
                  type="text"
                  placeholder="Change user (e.g., wesleyfinck.org)"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="flex-1 px-3 py-2 w-[300px] border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900"
                />
                <button
                  type="submit"
                  className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 transition font-medium"
                >
                  Switch User
                </button>
              </form>
            </div>
          </div>

          {/* Mode Selection */}
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Clustering Mode
            </p>
            <div className="flex gap-2">
              <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg px-1 h-10 items-center w-fit mb-2">
                {MODES.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setClusterMode(id)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                      clusterMode === id
                        ? "bg-white border border-gray-300 text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="text-xs font-medium text-gray-900 bg-orange-50 border-l-5 border-orange-500 px-6 h-10 rounded-r-md flex items-center justify-center max-w-2xl">
                {MODES.find((m) => m.id === clusterMode)?.description}
              </div>
            </div>
          </div>

          {/* Cluster statistics */}
          {/* Stats on Top */}
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              Cluster Statistics
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                {libraryLoading || clustersLoading ? (
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
                    <div className="h-10 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-gray-700 mb-1">
                      Total Clusters
                    </p>
                    <p className="text-3xl font-bold text-gray-600">
                      {clusters.length}
                    </p>
                    {/* {clusterMode === "tfidf" && (
                      <p className="text-xs text-gray-500 mt-1">
                        Auto-detected from {library?.cards.length ?? 0} cards
                      </p>
                    )} */}
                  </>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                {libraryLoading || clustersLoading ? (
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                    <div className="h-6 bg-gray-200 rounded w-2/3 mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-1/4" />
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-gray-700 mb-1">
                      Largest Cluster
                    </p>
                    <p className="text-xl font-bold text-orange-600 truncate">
                      {clusters[0]?.name ?? "N/A"}
                    </p>
                    <p className="text-sm font-medium text-gray-600">
                      {clusters[0]?.cards.length ?? 0} cards
                    </p>
                  </>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                {libraryLoading || clustersLoading ? (
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
                    <div className="h-10 bg-gray-200 rounded w-3/5 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-2/5" />
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-gray-700 mb-1">
                      Average Size
                    </p>
                    <p className="text-3xl font-bold text-gray-600">
                      {avgClusterSize}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      cards per cluster
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Clusters in Columns */}
          <div>
            <h3 className="text-lg font-bold mb-2 text-gray-900">
              Topic Clusters
            </h3>
            {libraryLoading || clustersLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {Array.from({ length: CLUSTERS_PER_PAGE }).map((_, i) => (
                  <div
                    key={i}
                    className="border border-gray-200 rounded-md p-2 animate-pulse bg-white"
                  >
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/4 mb-3" />
                    <div className="flex flex-wrap gap-2">
                      <div className="h-6 w-16 bg-gray-200 rounded" />
                      <div className="h-6 w-12 bg-gray-200 rounded" />
                      <div className="h-6 w-10 bg-gray-200 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {displayedClusters.map((cluster) => (
                    <div
                      key={cluster.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedCluster(cluster.name)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setSelectedCluster(cluster.name);
                        }
                      }}
                      className={`border rounded-md p-2 transition cursor-pointer focus:outline-none ${
                        selectedCluster === cluster.name
                          ? "border-orange-500 bg-orange-50 shadow-sm"
                          : "border-gray-200 hover:border-orange-400 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-gray-900 line-clamp-1 text-sm">
                          {cluster.name}
                        </h3>
                        <span className="text-xs font-semibold text-gray-700 bg-gray-200 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">
                          {cluster.cards.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {cluster.keywords.slice(0, 4).map((keyword) => (
                          <span
                            key={keyword}
                            className="px-2 py-0.5 bg-orange-500 text-white text-[10px] font-medium rounded-full"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Clusters Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-gray-500">
                    Showing {clustersPage * CLUSTERS_PER_PAGE + 1}–
                    {Math.min(
                      (clustersPage + 1) * CLUSTERS_PER_PAGE,
                      clusters.length
                    )}{" "}
                    of {clusters.length}
                  </span>
                  <div className="flex gap-2">
                    {clustersPage > 0 && (
                      <button
                        onClick={() => setClustersPage((p) => p - 1)}
                        className="px-3 py-1 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                      >
                        Previous
                      </button>
                    )}
                    {(clustersPage + 1) * CLUSTERS_PER_PAGE <
                      clusters.length && (
                      <button
                        onClick={() => setClustersPage((p) => p + 1)}
                        className="px-3 py-1 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                      >
                        Next
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-indigo-100">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-900">
            <Sparkles className="w-6 h-6 text-purple-500" />
            {selectedCluster ? (
              <>
                Recommended URLs for
                <span className=" font-semibold text-orange-500 ">
                  {selectedCluster}
                </span>
                <button
                  onClick={() => setSelectedCluster(null)}
                  className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded ml-2 hover:bg-gray-200"
                  aria-label="Clear selected cluster"
                >
                  ✕
                </button>
              </>
            ) : (
              <>
                Recommended URLs
                <span className="font-semibold text-orange-500 ">
                  based on all clusters
                </span>
                {recommendations && (
                  <span className="text-sm font-normal text-gray-500">
                    ({(recommendations || []).length} total)
                  </span>
                )}
              </>
            )}
          </h2>

          {libraryLoading || clustersLoading || recsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : displayedRecommendations &&
            displayedRecommendations.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {displayedRecommendations
                  .slice(
                    recsPage * RECS_PER_PAGE,
                    (recsPage + 1) * RECS_PER_PAGE
                  )
                  .map((rec) => (
                    <a
                      key={rec.url}
                      href={rec.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border border-gray-200 rounded-md p-3 hover:border-indigo-500 hover:shadow-md transition group bg-white"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 line-clamp-2 text-sm">
                          {rec.title || rec.url}
                        </h3>
                        {/* <span
                          className="text-xs bg-green-500 text-white font-semibold px-2 py-0.5 rounded-full ml-2 flex-shrink-0"
                          title={`Appears in ${rec.score} cluster${
                            rec.score === 1 ? "" : "s"
                          } searches`}
                        >
                          In {rec.score}
                        </span> */}
                      </div>

                      {rec.description && (
                        <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                          {rec.description}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                          👥 {rec.urlLibraryCount} users saved this
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {rec.appearsInClusters.map((cluster) => (
                          <span
                            key={cluster}
                            className="text-xs bg-purple-500 text-white font-medium px-2 py-0.5 rounded"
                          >
                            {cluster}
                          </span>
                        ))}
                      </div>

                      {rec.siteName && (
                        <p className="text-xs font-medium text-gray-600 mt-2 bg-gray-100 px-2 py-1 rounded inline-block">
                          {rec.siteName}
                        </p>
                      )}
                    </a>
                  ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                <span className="text-sm text-gray-500">
                  Showing {recsPage * RECS_PER_PAGE + 1}–
                  {Math.min(
                    (recsPage + 1) * RECS_PER_PAGE,
                    displayedRecommendations.length
                  )}{" "}
                  of {displayedRecommendations.length}
                </span>
                <div className="flex gap-2">
                  {recsPage > 0 && (
                    <button
                      onClick={() => setRecsPage((p) => p - 1)}
                      className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                    >
                      Previous
                    </button>
                  )}
                  {(recsPage + 1) * RECS_PER_PAGE <
                    displayedRecommendations.length && (
                    <button
                      onClick={() => setRecsPage((p) => p + 1)}
                      className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                    >
                      Next
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-center text-gray-700 font-medium py-12">
              No recommendations found for this selection / or this is not a top
              5 cluster so no recommendations were generated using it (for
              now!).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <QueryClientProvider client={queryClient}>
      <PrototypeContent />
    </QueryClientProvider>
  );
}
