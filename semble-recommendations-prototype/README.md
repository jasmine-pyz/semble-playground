# Semble Recommendations — Prototype

This prototype clusters a user's saved Semble cards and generates URL recommendations using Semble search endpoints. It's intended as an exploratory UI and algorithm playground.

What this project does

- Loads a user's saved cards from Semble (proxied via local API routes)
- Builds topic clusters using multiple strategies (TF-IDF, embedding-based clustering, by-site, by-type)
- Queries Semble semantic-search / similar-urls per cluster and aggregates recommendations
- Renders a compact UI with cluster statistics, selectable clusters, and paginated recommendations

Quick start (development)

1. Install dependencies

   npm install

2. Start the dev server

   npm run dev

3. Open http://localhost:3000 and enter a Semble/Bluesky handle to load that user's library.
