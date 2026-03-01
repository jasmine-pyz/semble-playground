/**
 * Test content-based filtering logic
 * Run with: npx tsx test-content-filtering.ts
 */

import { prepareContentForEmbedding } from "./lib/url-utils";

interface Card {
  url: string;
  metadata?: {
    title?: string;
    description?: string;
    author?: string;
    siteName?: string;
  };
}

interface UrlData {
  url: string;
  metadata?: {
    title?: string;
    description?: string;
    author?: string;
    siteName?: string;
  };
}

function getContentSignature(
  title?: string,
  description?: string,
  author?: string,
  siteName?: string
): string {
  return prepareContentForEmbedding(title, description, author, siteName);
}

console.log("🧪 Testing Content-Based Filtering\n");

// Test 1: URL duplicates
console.log("Test 1: URL Duplicates");
const url1 = "https://example.com/article";
const url2 = "https://example.com/article?utm_source=twitter";

console.log(`  URL 1: ${url1}`);
console.log(`  URL 2: ${url2}`);
console.log(`  URLs match: ${url1 === url2 ? "✅" : "❌"} (expected ❌)`);
console.log("");

// Test 2: Content duplicates (same title/description, different siteName)
console.log("Test 2: Content Duplicates (Different Sites)");
const card1: Card = {
  url: "https://original-site.com/article",
  metadata: {
    title: "The Future of AI",
    description: "An exploration of artificial intelligence",
    author: "John Doe",
    siteName: "Original Site",
  },
};

const card2: UrlData = {
  url: "https://republished-site.com/ai-article",
  metadata: {
    title: "The Future of AI",
    description: "An exploration of artificial intelligence",
    author: "John Doe",
    siteName: "Republished Site", // Different site!
  },
};

const sig1 = getContentSignature(
  card1.metadata?.title,
  card1.metadata?.description,
  card1.metadata?.author,
  card1.metadata?.siteName
);

const sig2 = getContentSignature(
  card2.metadata?.title,
  card2.metadata?.description,
  card2.metadata?.author,
  card2.metadata?.siteName
);

console.log(`  Card 1 signature: ${sig1}`);
console.log(`  Card 2 signature: ${sig2}`);
console.log(`  Content match: ${sig1 === sig2 ? "✅ SAME" : "❌ DIFFERENT"}`);
console.log(
  `  (Different siteName = different signature, as per Semble's embedding logic)`
);
console.log("");

// Test 2b: Exact content duplicates
console.log("Test 2b: Exact Content Duplicates");
const card2a: Card = {
  url: "https://original-site.com/article",
  metadata: {
    title: "The Future of AI",
    description: "An exploration of artificial intelligence",
    author: "John Doe",
    siteName: "Tech Blog",
  },
};

const card2b: UrlData = {
  url: "https://amp-version.com/ai-article",
  metadata: {
    title: "The Future of AI",
    description: "An exploration of artificial intelligence",
    author: "John Doe",
    siteName: "Tech Blog", // Same site!
  },
};

const sig2a = getContentSignature(
  card2a.metadata?.title,
  card2a.metadata?.description,
  card2a.metadata?.author,
  card2a.metadata?.siteName
);

const sig2b = getContentSignature(
  card2b.metadata?.title,
  card2b.metadata?.description,
  card2b.metadata?.author,
  card2b.metadata?.siteName
);

console.log(`  Card 2a signature: ${sig2a}`);
console.log(`  Card 2b signature: ${sig2b}`);
console.log(
  `  Content match: ${
    sig2a === sig2b ? "✅ DUPLICATE (correct!)" : "❌ DIFFERENT"
  }`
);
console.log("");

// Test 3: Similar but Different Content
console.log("Test 3: Similar but Different Content");
const card3: Card = {
  url: "https://site.com/part-1",
  metadata: {
    title: "AI Guide Part 1",
    description: "Introduction to AI",
    siteName: "Tech Blog",
  },
};

const card4: UrlData = {
  url: "https://site.com/part-2",
  metadata: {
    title: "AI Guide Part 2",
    description: "Advanced AI concepts",
    siteName: "Tech Blog",
  },
};

const sig3 = getContentSignature(
  card3.metadata?.title,
  card3.metadata?.description,
  card3.metadata?.author,
  card3.metadata?.siteName
);

const sig4 = getContentSignature(
  card4.metadata?.title,
  card4.metadata?.description,
  card4.metadata?.author,
  card4.metadata?.siteName
);

console.log(`  Card 3 signature: ${sig3}`);
console.log(`  Card 4 signature: ${sig4}`);
console.log(
  `  Content match: ${
    sig3 === sig4 ? "✅ DUPLICATE" : "❌ DIFFERENT (correct!)"
  }`
);
console.log("");

// Test 4: Content preparation
console.log("Test 4: Content Preparation for Embedding");
const content1 = prepareContentForEmbedding(
  "The Future of AI",
  "An exploration of artificial intelligence",
  "John Doe",
  "Tech Blog"
);

const content2 = prepareContentForEmbedding(
  "The Future of AI",
  "An exploration of artificial intelligence",
  undefined, // No author
  "Tech Blog"
);

console.log(`  With author: "${content1}"`);
console.log(`  Without author: "${content2}"`);
console.log(`  Different: ${content1 !== content2 ? "✅ (correct!)" : "❌"}`);
console.log("");

// Test 5: Filtering simulation
console.log("Test 5: Filtering Simulation");

const existingCards: Card[] = [
  {
    url: "https://example.com/article-1",
    metadata: {
      title: "Article 1",
      description: "Description 1",
      siteName: "Site A",
    },
  },
  {
    url: "https://example.com/article-2",
    metadata: {
      title: "Article 2",
      description: "Description 2",
      siteName: "Site B",
    },
  },
];

const recommendations: UrlData[] = [
  {
    url: "https://example.com/article-1", // Exact URL match
    metadata: {
      title: "Article 1",
      description: "Description 1",
      siteName: "Site A",
    },
  },
  {
    url: "https://different-url.com/article", // Content match (same title/desc/site)
    metadata: {
      title: "Article 2",
      description: "Description 2",
      siteName: "Site B",
    },
  },
  {
    url: "https://new-site.com/new-article", // New content
    metadata: {
      title: "Article 3",
      description: "Description 3",
      siteName: "Site C",
    },
  },
];

const existingUrls = new Set(existingCards.map((c) => c.url));
const existingContentSignatures = new Set(
  existingCards.map((c) =>
    getContentSignature(
      c.metadata?.title,
      c.metadata?.description,
      c.metadata?.author,
      c.metadata?.siteName
    )
  )
);

console.log(`  Existing URLs: ${existingUrls.size}`);
console.log(`  Existing content signatures: ${existingContentSignatures.size}`);
console.log("");

recommendations.forEach((rec, i) => {
  const contentSig = getContentSignature(
    rec.metadata?.title,
    rec.metadata?.description,
    rec.metadata?.author,
    rec.metadata?.siteName
  );

  const urlMatch = existingUrls.has(rec.url);
  const contentMatch = existingContentSignatures.has(contentSig);
  const filtered = urlMatch || contentMatch;

  console.log(`  Recommendation ${i + 1}: ${rec.metadata?.title}`);
  console.log(`    URL: ${rec.url}`);
  console.log(`    URL match: ${urlMatch ? "✅" : "❌"}`);
  console.log(`    Content match: ${contentMatch ? "✅" : "❌"}`);
  console.log(`    Result: ${filtered ? "🚫 FILTERED" : "✅ KEPT"}`);
  console.log("");
});

console.log("✅ All tests complete!");
