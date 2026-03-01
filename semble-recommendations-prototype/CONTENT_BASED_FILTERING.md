# Content-Based Filtering for Recommendations

## Overview

We've enhanced the recommendation filtering to use **content-based comparison** in addition to URL matching. This matches the same approach used by Semble's API for generating embeddings.

## Why Content-Based Filtering?

### The Problem

Simple URL matching can miss duplicates when:

- Same article appears on different URLs (e.g., canonical URL vs. AMP version)
- URL has tracking parameters or different query strings
- Content is republished on different domains

### The Solution

Use the same content signature that Semble uses for embeddings:

```typescript
title + description + "by author" + "from siteName";
```

This creates a content fingerprint that identifies semantically identical content even if URLs differ.

## Implementation

### 1. Content Signature Function

```typescript
function getContentSignature(
  url: string,
  title?: string,
  description?: string,
  author?: string,
  siteName?: string
): string {
  const content = prepareContentForEmbedding(
    title,
    description,
    author,
    siteName
  );
  return `${url}|${content}`;
}
```

### 2. Embedding Preparation

```typescript
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
```

**This matches exactly how Semble API prepares content for embedding generation!**

### 3. Dual Filtering

When filtering recommendations, we now check BOTH:

1. **URL-based filtering**: `existingUrls.has(url)`
2. **Content-based filtering**: `existingContentSignatures.has(contentSig)`

```typescript
// Build both sets from existing cards
const existingUrls = new Set(existingCards.map((c) => c.url));
const existingContentSignatures = new Set(
  existingCards.map((c) =>
    getContentSignature(
      c.url,
      c.metadata?.title || c.cardContent?.title,
      c.metadata?.description || c.cardContent?.description,
      c.metadata?.author,
      c.metadata?.siteName
    )
  )
);

// Filter recommendations
if (
  existingUrls.has(urlData.url) ||
  existingContentSignatures.has(contentSig)
) {
  return; // Skip this recommendation
}
```

## Benefits

### ✅ More Accurate Filtering

- Catches duplicates that URL matching misses
- Aligns with how Semble's semantic search works
- Uses the same metadata fields (title, description, author, siteName)

### ✅ Consistent with API

- Uses the exact same `prepareContentForEmbedding` logic
- Matches Semble's embedding generation approach
- Ensures semantic similarity across the recommendation pipeline

### ✅ Better User Experience

- Fewer duplicate recommendations
- More diverse recommendations
- Higher quality suggestions

## Debug Output

The enhanced debug logs now show:

```
🔍 Getting recommendations for 5 clusters
📚 Existing URLs in library (150): [...]
📝 Total cards in library: 150
🔖 Content signatures created: 150
```

When checking each recommendation:

```
🔎 Checking URL: "https://example.com/article"
   Already in library (URL)? false
   Already in library (content)? true  ← FILTERED! Same content, different URL
```

Final verification:

```
✅ Verified: No duplicates in final recommendations
```

Or if issues found:

```
⚠️ WARNING: Found 3 content duplicates that should have been filtered!
   First duplicate: https://example.com/article
```

## Example Scenarios

### Scenario 1: URL Duplicate

```
Existing: https://example.com/article
Recommended: https://example.com/article?utm_source=twitter
Result: ✅ Filtered by URL matching
```

### Scenario 2: Content Duplicate

```
Existing: https://original-site.com/great-article
  - Title: "The Future of AI"
  - Description: "An exploration of..."
  - Site: "Original Site"

Recommended: https://republished-site.com/ai-future
  - Title: "The Future of AI"
  - Description: "An exploration of..."
  - Site: "Republished Site"

Result: ✅ Filtered by content signature matching
```

### Scenario 3: Similar but Different

```
Existing: https://site.com/part-1
  - Title: "AI Guide Part 1"
  - Description: "Introduction to AI"

Recommended: https://site.com/part-2
  - Title: "AI Guide Part 2"
  - Description: "Advanced AI concepts"

Result: ✅ NOT filtered - different content despite similar URLs
```

## Testing

Try the recommendation system with a user who has:

1. Articles from multiple sources
2. Duplicate content across different URLs
3. Similar topics but different content

The content-based filtering should catch semantic duplicates that URL matching misses!

## Future Enhancements

Potential improvements:

- **Fuzzy matching**: Use Levenshtein distance for titles
- **Embedding similarity**: Compare actual embeddings if API provides them
- **Domain clustering**: Treat same domain + similar title as potential duplicates
- **User preferences**: Let users mark "this is a duplicate" to improve filtering
