# Semble Playground

A collection of scripts for exploring and analyzing data from the Semble platform, including finding mutual cards and collections, and experimenting with the Semble PDS client.

## Prerequisites

- Node.js (with TypeScript support)
- A `.env` file with the following variables:
  ```
  # required for the mutual card script 
  BASE_URL=<your-semble-api-base-url>

  # required for the semblePDSScript 
  BLUESKY_HANDLE=<your-bluesky-handle>
  APP_PASSWORD=<your-app-password>
  ```

## Installation

```bash
npm install
```

## Scripts

### 1. mutualCardScript.tsx

**Purpose:** Find collections that have the most overlapping cards with a specific collection.

**What it does:**

- Takes an ATProto handle and a collection record key as input
- Fetches all cards from the specified collection
- For each card, finds all other collections that contain the same card
- Ranks collections and authors by the number of overlapping cards
- Displays both unfiltered results and filtered results (excluding the original author)

**How to run:**

```bash
npx tsx mutualCardScript.tsx
```

**Interactive prompts:**

1. Enter ATProto handle (e.g., `wesleyfinck.org`)
2. Enter collection record key (e.g., `3me5f5625jf2y`)

**Output:**

- Top collections with most overlap (unfiltered)
- Top authors with most overlapping cards (unfiltered)
- Top collections from other authors (filtered)
- Top authors excluding the original collection author (filtered)
- Each result shows the count, percentage overlap, author, and URI

---

### 2. mutualUserScript.tsx

**Purpose:** Find users who have saved the most mutual cards with a target user's library.

**What it does:**

- Takes a user handle as input
- Fetches all URL cards from the user's library (with caching support)
- For each card, finds all other users who have saved the same URL
- Ranks users by the number of mutual cards
- Displays the top 20 users with mutual cards and example URLs

**How to run:**

```bash
npx tsx mutualUserScript.tsx
```

**Interactive prompts:**

1. Enter a user handle (e.g., `wesleyfinck.org`)

**Features:**

- **Caching:** The script caches user card data in the `./cache` directory to avoid repeated API calls. Cached data is automatically used on subsequent runs.
- **Pagination:** Automatically fetches all pages of user cards (50 cards per page)
- **Progress tracking:** Shows progress while processing each URL

**Output:**

- Top 20 users with mutual cards
- Number of mutual cards and percentage overlap
- Sample mutual URLs (first 3, with count of remaining)
- Statistics: total URLs checked, users with at least 1 mutual card, max overlap, average overlap

**Cache management:**

- Cache files are stored in `./cache/` with the pattern `<handle>.json`
- To refresh data, delete the cache file for a specific user
- To clear all cache: `rm -rf cache/`

---

### 3. semblePDSScript.tsx

**Purpose:** Getting familiar with the Semble PDS npm package (`@cosmik.network/semble-pds-client`).

**What it does:**

- Demonstrates how to connect to the Semble PDS client
- Shows authentication with Bluesky credentials
- Contains example code for creating cards, adding notes, and other PDS operations (currently commented out)
- Serves as a learning/testing ground for the Semble PDS client API

**How to run:**

```bash
npx tsx semblePDSScript.tsx
```

**Note:** This script is primarily for exploration and testing. Most functionality is commented out. Uncomment sections to test different PDS client features.
