# URL Filtering Debug Guide

## What We Changed

Added comprehensive debugging to the recommendation system to verify that URLs already in a user's library are properly filtered out.

## Debug Logs Added

### 1. In `lib/recommendations.ts`

**Initial State:**

- `📚 Existing URLs in library (count)` - Shows first 5 URLs from user's library
- `📝 Total cards in library` - Total number of cards

**During Processing:**

- `🔄 Processing cluster "name" with N results` - For each cluster being processed
- `🔎 Checking URL` - Shows first 3 URLs being checked with their filter status

**Final State:**

- `📦 Found N unique recommendations (after filtering)` - Count after deduplication
- `🚫 Filtered out N existing URLs` - How many were filtered
- `✅ Verified: No duplicates` - Confirmation that filtering worked
- `⚠️ WARNING: Found N duplicates` - If filtering failed (shouldn't happen!)

### 2. In `app/page.tsx`

- `🚀 Fetching recommendations for N cards` - When recommendations are requested
- `📊 Got N recommendations` - Final count returned

## How to Test

1. **Open the app** (should be running on http://localhost:3000)

2. **Enter a user handle** (e.g., `wesleyfinck.org`)

3. **Open browser DevTools console** (F12 or Cmd+Option+I)

4. **Look for the debug logs** in this order:

   ```
   🚀 Fetching recommendations for X cards
   🔍 Getting recommendations for 5 clusters
   📚 Existing URLs in library (X): [...]
   📝 Total cards in library: X
   📊 Using clusters: ...
   🔎 Searching for cluster "..." with query: "..."
   ✅ Got results from N clusters
   🔄 Processing cluster "..." with N results
   🔎 Checking URL: "..."
      Already in library? true/false
   📦 Found N unique recommendations (after filtering)
   🚫 Filtered out N existing URLs
   ✅ Verified: No duplicates in final recommendations
   📊 Got N recommendations
   ```

5. **Verify the filtering:**
   - Check if `Already in library?` is correctly identifying duplicates
   - Verify that `No duplicates in final recommendations` appears
   - If you see `⚠️ WARNING: Found N duplicates`, there's a bug!

## What to Look For

### ✅ Good Signs

- URLs marked `Already in library? true` are NOT in the final recommendations
- No warning message about duplicates
- Recommendation count is reasonable (not suspiciously high)

### 🚨 Bad Signs

- Duplicate warning appears
- URLs that should be filtered are showing in recommendations
- Recommendation count equals total search results (means no filtering happened)

## Potential Issues to Check

If filtering isn't working:

1. **URL Format Differences**

   - Existing: `https://example.com/page`
   - Recommended: `https://example.com/page/` (trailing slash)
   - **Fix:** Normalize URLs before comparison

2. **Case Sensitivity**

   - Existing: `https://Example.com/page`
   - Recommended: `https://example.com/page`
   - **Fix:** Lowercase URLs before comparison

3. **Protocol Differences**

   - Existing: `http://example.com/page`
   - Recommended: `https://example.com/page`
   - **Fix:** Consider both as same URL

4. **Query Parameters**
   - Existing: `https://example.com/page?ref=twitter`
   - Recommended: `https://example.com/page?ref=google`
   - **Decision:** Should these be considered different?

## Quick Test URLs

Try these handles to test different scenarios:

- `wesleyfinck.org` - Has a good library size
- Your own handle - To see your own recommendations
- A new user with few cards - Should give more recommendations

## Next Steps

Based on the console logs, we can:

1. Verify if filtering is working correctly
2. Identify URL format mismatches if any
3. Add URL normalization if needed
4. Adjust the filtering logic if edge cases are found
