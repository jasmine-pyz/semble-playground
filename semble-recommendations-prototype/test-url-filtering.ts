/**
 * Quick test to verify URL filtering logic
 * Run this with: npx tsx test-url-filtering.ts
 */

interface Card {
  url: string;
}

interface UrlData {
  url: string;
}

// Simulate the filtering logic
function testFiltering() {
  const existingCards: Card[] = [
    { url: "https://example.com/page1" },
    { url: "https://example.com/page2" },
    { url: "http://test.com/article" },
  ];

  const recommendedUrls: UrlData[] = [
    { url: "https://example.com/page1" }, // Should be filtered (duplicate)
    { url: "https://example.com/page3" }, // Should pass (new)
    { url: "http://test.com/article" }, // Should be filtered (duplicate)
    { url: "https://new-site.com/page" }, // Should pass (new)
  ];

  const existingUrls = new Set(existingCards.map((c) => c.url));

  console.log("Existing URLs Set:", existingUrls);
  console.log("\nTesting filtering:");

  recommendedUrls.forEach((urlData) => {
    const isFiltered = existingUrls.has(urlData.url);
    console.log(`  ${urlData.url}`);
    console.log(
      `    → ${isFiltered ? "❌ FILTERED (exists)" : "✅ KEPT (new)"}`
    );
  });

  // Test the actual filtering
  const filtered = recommendedUrls.filter(
    (urlData) => !existingUrls.has(urlData.url)
  );

  console.log("\nFinal results:");
  console.log(`  Input: ${recommendedUrls.length} URLs`);
  console.log(`  Existing: ${existingUrls.size} URLs`);
  console.log(`  Filtered: ${filtered.length} URLs`);
  console.log(
    `  Filtered URLs:`,
    filtered.map((u) => u.url)
  );
}

testFiltering();
