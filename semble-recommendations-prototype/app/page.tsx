"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SembleAPI } from "@/lib/api";
import {
  clusterBySemanticAPI,
  clusterByCardContentTitle,
} from "@/lib/clustering";
import { getRecommendations } from "@/lib/recommendations";
import { Sparkles, Loader2, TrendingUp } from "lucide-react";

const queryClient = new QueryClient();

function PrototypeContent() {
  const [userHandle, setUserHandle] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [clusterMode, setClusterMode] = useState<"semantics" | "type">("type");

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
    queryKey: ["clusters", clusterMode, library?.cards.length],
    queryFn: async () => {
      if (!library || library.cards.length === 0) return [];

      if (clusterMode === "semantics") {
        return await clusterBySemanticAPI(api, library.cards, 5);
      } else {
        return clusterByCardContentTitle(library.cards);
      }
    },
    enabled: !!library && library.cards.length > 0,
  });

  const { data: recommendations, isLoading: recsLoading } = useQuery({
    queryKey: ["recommendations", clusterMode, library?.cards.length],
    queryFn: async () => {
      console.log(
        `🚀 Fetching recommendations for ${library?.cards.length} cards`
      );
      const recs = await getRecommendations(
        api,
        clusters,
        library!.cards,
        5,
        3
      );
      console.log(`📊 Got ${recs.length} recommendations`);
      return recs;
    },
    enabled: !!library && library.cards.length > 0 && clusters.length > 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setUserHandle(inputValue.trim());
    }
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
            based on their Semble library.
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

          <p className="text-sm text-gray-600 mt-4">
            This uses the public Semble API - no authentication required!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border-2 border-indigo-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Sparkles className="w-8 h-8 text-orange-600" />
                Recommendations for @{userHandle}
              </h1>
              <p className="text-gray-700 mt-2 font-medium">
                {library?.cards.length || 0} cards in library
              </p>
              <button
                onClick={() => {
                  setUserHandle("");
                  setInputValue("");
                }}
                className="text-sm text-orange-600 hover:text-orage-800 font-medium hover:underline mt-2"
              >
                ← Try a different user
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setClusterMode("semantics")}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  clusterMode === "semantics"
                    ? "bg-orange-600 text-white shadow-md"
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                By Semantics
              </button>
              <button
                onClick={() => setClusterMode("type")}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  clusterMode === "type"
                    ? "bg-orange-600 text-white shadow-md"
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                By Type
              </button>
            </div>
          </div>
        </div>

        {/* Clusters */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-purple-100">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              Topic Clusters
            </h2>

            {libraryLoading || clustersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
              </div>
            ) : (
              <div className="space-y-3">
                {clusters.slice(0, 10).map((cluster) => (
                  <div
                    key={cluster.id}
                    className="border-2 border-gray-300 rounded-lg p-4 hover:border-orange-500 hover:shadow-md transition"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-gray-900">
                        {cluster.name}
                      </h3>
                      <span className="text-sm font-semibold text-gray-700 bg-gray-200 px-3 py-1 rounded-full">
                        {cluster.cards.length} cards
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {cluster.keywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="px-3 py-1 bg-orange-500 text-white text-xs font-medium rounded-full"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-indigo-100">
            <h2 className="text-xl font-bold mb-4 text-gray-900">
              Cluster Statistics
            </h2>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-700">
                  Total Clusters
                </p>
                <p className="text-4xl font-bold text-gray-600">
                  {clusters.length}
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700">
                  Largest Cluster
                </p>
                <p className="text-2xl font-bold text-orange-600">
                  {clusters[0]?.name || "N/A"}
                </p>
                <p className="text-sm font-medium text-gray-600">
                  {clusters[0]?.cards.length || 0} cards
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700">
                  Average Cluster Size
                </p>
                <p className="text-2xl font-bold text-gray-600">
                  {clusters.length > 0
                    ? Math.round(
                        clusters.reduce((sum, c) => sum + c.cards.length, 0) /
                          clusters.length
                      )
                    : 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-indigo-100">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gray-900">
            <Sparkles className="w-6 h-6 text-indigo-600" />
            Recommended URLs
          </h2>

          {recsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : recommendations && recommendations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendations.slice(0, 12).map((rec) => (
                <a
                  key={rec.url}
                  href={rec.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-2 border-gray-300 rounded-lg p-4 hover:border-indigo-500 hover:shadow-lg transition group bg-white"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 line-clamp-2">
                      {rec.title || rec.url}
                    </h3>
                    <span className="text-xs bg-green-500 text-white font-bold px-2 py-1 rounded-full ml-2 flex-shrink-0">
                      {rec.score}
                    </span>
                  </div>

                  {rec.description && (
                    <p className="text-sm text-gray-700 line-clamp-2 mb-3">
                      {rec.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      👥 {rec.urlLibraryCount} users saved this
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {rec.appearsInClusters.map((cluster) => (
                      <span
                        key={cluster}
                        className="text-xs bg-purple-500 text-white font-medium px-2 py-1 rounded"
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
          ) : (
            <p className="text-center text-gray-700 font-medium py-12">
              No recommendations found. The user may not have enough cards in
              their library.
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
