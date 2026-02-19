import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import path from "path";
import fs from "fs/promises";
import {
  logSection,
  logSuccess,
  logInfo,
  logAction,
  logSubSection,
} from "./utils/logger.js";

import dotenv from "dotenv";

dotenv.config();

// Create readline interface
const rl = readline.createInterface({ input, output });

logSection("🔍 MUTUAL CARDS FINDER - USER LIBRARIES");

const targetHandle = await rl.question(
  "Enter a user handle (e.g., wesleyfinck.org): "
);

logAction(`Finding users with most mutual cards as ${targetHandle}...`);
logSubSection(`Retrieving user card data`);

try {
  // Create cache directory if it doesn't exist
  const cacheDir = "./cache";
  await fs.mkdir(cacheDir, { recursive: true });

  const cacheFile = path.join(
    cacheDir,
    `${targetHandle.replace(/\./g, "_")}.json`
  );

  let allUserCards: any[] = [];

  // Check if cache exists
  try {
    const cachedData = await fs.readFile(cacheFile, "utf-8");
    allUserCards = JSON.parse(cachedData);
    logSuccess(`✨ Loaded ${allUserCards.length} cards from cache!`);
  } catch (error) {
    // Cache doesn't exist, fetch from API
    logAction("No cache found. Fetching all cards from user's library...");
    let currentPage = 1;
    let hasMore = true;

    do {
      const userCardsURL = `${process.env.BASE_URL}/api/cards/user/${targetHandle}?page=${currentPage}&limit=50`;
      logInfo(`Fetching page ${currentPage}...`);

      const userCardsResponse = await fetch(userCardsURL);
      const userCardsData = await userCardsResponse.json();

      if (userCardsData.cards && userCardsData.cards.length > 0) {
        allUserCards.push(...userCardsData.cards);
        logSuccess(
          `Page ${currentPage}: Found ${userCardsData.cards.length} cards`
        );
      }

      // Check pagination info
      if (userCardsData.pagination) {
        hasMore = userCardsData.pagination.hasMore;
        logInfo("Pagination", {
          currentPage: userCardsData.pagination.currentPage,
          totalPages: userCardsData.pagination.totalPages,
          totalCount: userCardsData.pagination.totalCount,
        });
      } else {
        hasMore = false;
      }

      currentPage++;
    } while (hasMore);

    // Save to cache
    await fs.writeFile(cacheFile, JSON.stringify(allUserCards, null, 2));
    logSuccess(`💾 Saved ${allUserCards.length} cards to cache!`);

    logSuccess(
      `Total: Found ${
        allUserCards.length
      } URL cards in ${targetHandle}'s library across ${currentPage - 1} pages`
    );
  }

  if (allUserCards.length === 0) {
    logInfo("No URL cards found for this user");
    process.exit(0);
  }

  logSubSection("Finding users who have saved the same URLs...");

  const userCounts = new Map<
    string,
    { count: number; handle: string; mutualCards: any[] }
  >();

  // Step 2: For each URL card, find who else has saved it
  let processedCount = 0;
  for (const urlCard of allUserCards) {
    processedCount++;
    logAction(
      `[${processedCount}/${allUserCards.length}] Checking URL: ${urlCard.url}`
    );
    logAction(`Checking URL: ${urlCard.url}`);

    // Get all users who have this URL in their library
    const librariesURL = `${
      process.env.BASE_URL
    }/api/cards/libraries/url?url=${encodeURIComponent(urlCard.url)}`;
    const librariesResponse = await fetch(librariesURL);
    const librariesData = await librariesResponse.json();
    // console.log(librariesData);

    if (librariesData.libraries && librariesData.libraries.length > 0) {
      logSuccess(
        `Found ${librariesData.libraries.length} users with this URL!`
      );
      //   console.log(librariesData.libraries);

      // Count each user (excluding the target user)
      for (const record of librariesData.libraries) {
        // console.log(record);
        // Skip the target user
        if (record.user.handle !== targetHandle) {
          const existing = userCounts.get(record.user.id);
          if (existing) {
            existing.count++;
            existing.mutualCards.push(record.card);
          } else {
            userCounts.set(record.user.id, {
              count: 1,
              handle: record.user.handle,
              mutualCards: [record.card],
            });
          }
        }
      }
    } else {
      logInfo("Only you have saved this URL");
    }

    console.log("---\n");
  }

  // Sort and display results
  const sortedUserCounts = new Map(
    Array.from(userCounts.entries()).sort((a, b) => b[1].count - a[1].count)
  );

  logSubSection(`RESULTS for ${targetHandle}`);
  
  // Build output content
  let outputContent = `RESULTS FOR ${targetHandle}\n`;
  outputContent += `${"=".repeat(50)}\n\n`;
  
  //   console.log(sortedUserCounts);
  if (sortedUserCounts.size > 0) {
    let index = 0;
    console.log(`\n Top 20 users with mutual cards:\n`);
    outputContent += `Top 20 Users with Mutual Cards:\n\n`;
    
    for (const [id, user] of sortedUserCounts) {
      if (index >= 20) break;

      const percentage = ((user.count / allUserCards.length) * 100).toFixed(1);
      const userLine = `${index + 1}. ${user.handle}`;
      console.log(userLine);
      outputContent += `${userLine}\n`;
      
      const atLine = `   @${user.handle}`;
      console.log(atLine);
      outputContent += `${atLine}\n`;
      
      const didLine = `   DID: ${id}`;
      console.log(didLine);
      outputContent += `${didLine}\n`;
      
      const overlapLine = `   ${user.count}/${allUserCards.length} mutual cards (${percentage}% overlap)`;
      console.log(overlapLine);
      outputContent += `${overlapLine}\n`;

      // Show first 3 mutual URLs as examples
      console.log(`   Mutual URLs:`);
      outputContent += `   Mutual URLs:\n`;
      user.mutualCards.slice(0, 3).forEach((card: any) => {
        const urlLine = `     • ${card.url}`;
        console.log(urlLine);
        outputContent += `${urlLine}\n`;
      });
      if (user.mutualCards.length > 3) {
        const moreLine = `     ... and ${user.mutualCards.length - 3} more`;
        console.log(moreLine);
        outputContent += `${moreLine}\n`;
      }
      console.log();
      outputContent += `\n`;

      index++;
    }
  }

  // Summary statistics
  logSubSection("STATISTICS");
  outputContent += `\nSTATISTICS\n`;
  outputContent += `${"=".repeat(50)}\n`;
  
  const totalLine = `Total URLs checked: ${allUserCards.length}`;
  console.log(totalLine);
  outputContent += `${totalLine}\n`;
  
  const usersLine = `Users with at least 1 mutual card: ${sortedUserCounts.size}`;
  console.log(usersLine);
  outputContent += `${usersLine}\n`;

  if (sortedUserCounts.size > 0) {
    const firstEntry = Array.from(sortedUserCounts.values())[0];
    const maxOverlap = firstEntry.count;
    const avgOverlap = (
      Array.from(sortedUserCounts.values()).reduce(
        (sum, u) => sum + u.count,
        0
      ) / sortedUserCounts.size
    ).toFixed(1);
    const maxLine = `Max overlap: ${maxOverlap} cards`;
    console.log(maxLine);
    outputContent += `${maxLine}\n`;
    
    const avgLine = `Average overlap: ${avgOverlap} cards`;
    console.log(avgLine);
    outputContent += `${avgLine}\n`;
  }
  
  // Write to output file
  const outputDir = "./output";
  await fs.mkdir(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const outputFile = path.join(
    outputDir,
    `mutual-users-${targetHandle.replace(/\./g, "_")}-${timestamp}.txt`
  );
  await fs.writeFile(outputFile, outputContent);
  logSuccess(`📄 Results saved to: ${outputFile}`);
} catch (error) {
  console.error("❌ Error:", error);
  if (error instanceof Error) {
    console.error(error.stack);
  }
} finally {
  rl.close();
}

logSection("✨ SCRIPT COMPLETED!");
