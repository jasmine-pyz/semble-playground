const API_BASE_URL = "/api";

export interface UrlMetadata {
  title?: string;
  description?: string;
  siteName?: string;
  author?: string;
  type?: string;
  image?: string;
}

export interface UrlView {
  url: string;
  metadata: UrlMetadata;
  urlLibraryCount: number;
  urlInLibrary?: boolean;
}

export interface Pagination {
  hasMore: boolean;
  currentPage: number;
  totalPages?: number;
  totalCount?: number;
}

export interface CardContent {
  title?: string;
  description?: string;
  note?: string;
}

export interface Card {
  id: string;
  url: string;
  uri: string;
  title?: string;
  description?: string;
  metadata?: UrlMetadata;
  cardContent?: CardContent;
  author?: {
    handle: string;
    did: string;
  };
  createdAt: string;
}

export interface SimilarUrlsResponse {
  urls: UrlView[];
  pagination: Pagination;
}

export interface UserCardsResponse {
  cards: Card[];
  pagination: Pagination;
}

export class SembleAPI {
  async getSimilarUrls(
    url: string,
    options: {
      threshold?: number;
      urlType?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    } = {}
  ): Promise<SimilarUrlsResponse> {
    const params = new URLSearchParams({
      url,
      ...(options.threshold && { threshold: options.threshold.toString() }),
      ...(options.urlType && { urlType: options.urlType }),
      ...(options.page && { page: options.page.toString() }),
      ...(options.limit && { limit: options.limit.toString() }),
      ...(options.sortBy && { sortBy: options.sortBy }),
      ...(options.sortOrder && { sortOrder: options.sortOrder }),
    });

    const response = await fetch(
      `${API_BASE_URL}/search/similar-urls?${params}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch similar URLs: ${response.statusText}`);
    }

    return response.json();
  }

  async semanticSearch(
    query: string,
    options: {
      threshold?: number;
      urlType?: string;
      identifier?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    } = {}
  ): Promise<SimilarUrlsResponse> {
    const params = new URLSearchParams({
      query,
      ...(options.threshold && { threshold: options.threshold.toString() }),
      ...(options.urlType && { urlType: options.urlType }),
      ...(options.identifier && { identifier: options.identifier }),
      ...(options.page && { page: options.page.toString() }),
      ...(options.limit && { limit: options.limit.toString() }),
      ...(options.sortBy && { sortBy: options.sortBy }),
      ...(options.sortOrder && { sortOrder: options.sortOrder }),
    });

    const response = await fetch(`${API_BASE_URL}/search/semantic?${params}`);

    if (!response.ok) {
      throw new Error(
        `Failed to perform semantic search: ${response.statusText}`
      );
    }

    return response.json();
  }

  async getUserCards(
    identifier: string,
    options: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
      urlType?: string;
    } = {}
  ): Promise<UserCardsResponse> {
    const params = new URLSearchParams({
      ...(options.page && { page: options.page.toString() }),
      ...(options.limit && { limit: options.limit.toString() }),
      ...(options.sortBy && { sortBy: options.sortBy }),
      ...(options.sortOrder && { sortOrder: options.sortOrder }),
      ...(options.urlType && { urlType: options.urlType }),
    });

    const response = await fetch(
      `${API_BASE_URL}/cards/user/${identifier}?${params}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch user cards: ${response.statusText}`);
    }

    return response.json();
  }
}
