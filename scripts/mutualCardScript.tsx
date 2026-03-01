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
} from "../utils/logger.js";

import dotenv from "dotenv";

dotenv.config();

// Create readline interface
const rl = readline.createInterface({ input, output });

logSection("🔍 MUTUAL CARD FINDER - COLLECTION");

const handle = await rl.question("Enter ATProto handle(e.g wesleyfinck.org): ");
const collectionRecordKey = await rl.question(
  "Enter collection collectionRecordKey(e.g 3me5f5625jf2y): "
);

// const handle = "wesleyfinck.org";
// const collectionRecordKey = "3me5f5625jf2y";

logAction(`Looking for collections that have most amount of overlapping cards`);

try {
  // Fetch their cards via HTTP API
  const completeURL = `${process.env.BASE_URL}/api/collections/at/${handle}/${collectionRecordKey}`;
  logInfo("Complete URL", { completeURL });
  const response = await fetch(completeURL);
  const data = await response.json();
  const originalAuthor = data.author.handle; // Store the original collection author handle

  logSuccess(`Found ${data.urlCards.length} cards from collection`);
  logInfo("Original collection author", originalAuthor);

  logSubSection("Finding collections with overlapping cards...");

  const collectionCounts = new Map<
    string,
    { count: number; name: string; uri: string; author: string }
  >();

  const authorCounts = new Map<string, { count: number; handle: string }>();

  // For each card URL, find collections containing it
  for (const urlCard of data.urlCards) {
    logAction(`Checking card: ${urlCard.url}`);

    // Get collections containing this URL
    const getCollectionsURL = `${
      process.env.BASE_URL
    }/api/collections/url?url=${encodeURIComponent(urlCard.url)}`;
    const collectionResponse = await fetch(getCollectionsURL);
    const collectionData = await collectionResponse.json();

    if (collectionData.collections && collectionData.collections.length > 0) {
      logSuccess(
        `Found this card in ${collectionData.collections.length} collections!`
      );

      // Count each collection (excluding the original)
      for (const collection of collectionData.collections) {
        const collectionKey = `at://${handle}/${collectionRecordKey}`;

        // Skip the original collection
        if (collection.uri !== collectionKey) {
          // Count collections
          const existing = collectionCounts.get(collection.uri);
          if (existing) {
            existing.count++;
          } else {
            collectionCounts.set(collection.uri, {
              count: 1,
              name: collection.name,
              uri: collection.uri,
              author: collection.author.handle,
            });
          }

          // Count authors
          const authorExisting = authorCounts.get(collection.author.handle);
          if (authorExisting) {
            authorExisting.count++;
          } else {
            authorCounts.set(collection.author.handle, {
              count: 1,
              handle: collection.author.handle,
            });
          }
        }
      }
    } else {
      logInfo("This card is not found in any other collection");
    }

    console.log("------------------------------\n");
  }

  // Sort and display results
  const allCollections = Array.from(collectionCounts.values()).sort(
    (a, b) => b.count - a.count
  );

  const filteredCollections = allCollections
    .filter((col) => col.author !== originalAuthor)
    .slice(0, 10);

  const allAuthors = Array.from(authorCounts.values()).sort(
    (a, b) => b.count - a.count
  );

  const filteredAuthors = allAuthors
    .filter((author) => author.handle !== originalAuthor)
    .slice(0, 10);

  // Build output content
  let outputContent = `MUTUAL CARD FINDER RESULTS\n`;
  outputContent += `Collection: at://${handle}/${collectionRecordKey}\n`;
  outputContent += `Author: ${originalAuthor}\n`;
  outputContent += `Total Cards: ${data.urlCards.length}\n`;
  outputContent += `${"=".repeat(70)}\n\n`;

  // Display all results (unfiltered)
  logSubSection("ALL RESULTS (UNFILTERED)");
  outputContent += `ALL RESULTS (UNFILTERED)\n`;
  outputContent += `${"=".repeat(70)}\n\n`;

  const topCollectionsTitle = `\n🏆 Top Collections with Most Overlap (${allCollections.length} total):\n`;
  console.log(topCollectionsTitle);
  outputContent += `Top Collections with Most Overlap (${allCollections.length} total):\n\n`;

  allCollections.slice(0, 10).forEach((col, index) => {
    const percentage = ((col.count / data.urlCards.length) * 100).toFixed(1);
    const isSameAuthor =
      col.author === originalAuthor ? " 👤 (same author)" : "";
    const line1 = `${index + 1}. ${col.name}${isSameAuthor}`;
    const line2 = `   ${col.count}/${data.urlCards.length} cards (${percentage}% overlap)`;
    const line3 = `   Author: ${col.author}`;
    const line4 = `   URI: ${col.uri}\n`;

    console.log(line1);
    console.log(line2);
    console.log(line3);
    console.log(line4);

    outputContent += `${line1}\n${line2}\n${line3}\n${line4}\n`;
  });

  const topAuthorsTitle = `\n👥 Top Authors with Most Overlapping Cards (${allAuthors.length} total):\n`;
  console.log(topAuthorsTitle);
  outputContent += `\nTop Authors with Most Overlapping Cards (${allAuthors.length} total):\n\n`;

  allAuthors.slice(0, 10).forEach((author, index) => {
    const percentage = ((author.count / data.urlCards.length) * 100).toFixed(1);
    const isSameAuthor =
      author.handle === originalAuthor ? " 👤 (original author)" : "";
    const line1 = `${index + 1}. ${author.handle}${isSameAuthor}`;
    const line2 = `   ${author.count}/${data.urlCards.length} cards (${percentage}% overlap)\n`;

    console.log(line1);
    console.log(line2);

    outputContent += `${line1}\n${line2}\n`;
  });

  // Display filtered results (excluding original author)
  logSubSection("FILTERED RESULTS (OTHER AUTHORS ONLY)");
  outputContent += `\nFILTERED RESULTS (OTHER AUTHORS ONLY)\n`;
  outputContent += `${"=".repeat(70)}\n\n`;

  const filteredCollectionsTitle = `\n🏆 Top Collections from Other Authors (${filteredCollections.length} found):\n`;
  console.log(filteredCollectionsTitle);
  outputContent += `Top Collections from Other Authors (${filteredCollections.length} found):\n\n`;

  if (filteredCollections.length > 0) {
    filteredCollections.forEach((col, index) => {
      const percentage = ((col.count / data.urlCards.length) * 100).toFixed(1);
      const line1 = `${index + 1}. ${col.name}`;
      const line2 = `   ${col.count}/${data.urlCards.length} cards (${percentage}% overlap)`;
      const line3 = `   Author: ${col.author}`;
      const line4 = `   URI: ${col.uri}\n`;

      console.log(line1);
      console.log(line2);
      console.log(line3);
      console.log(line4);

      outputContent += `${line1}\n${line2}\n${line3}\n${line4}\n`;
    });
  } else {
    const noResultsMsg = "🎉 No overlapping collections from other authors!\n";
    console.log(noResultsMsg);
    outputContent += `${noResultsMsg}\n`;
  }

  const filteredAuthorsTitle = `\n👥 Top Authors (excluding ${originalAuthor}):\n`;
  console.log(filteredAuthorsTitle);
  outputContent += `\nTop Authors (excluding ${originalAuthor}):\n\n`;

  if (filteredAuthors.length > 0) {
    filteredAuthors.forEach((author, index) => {
      const percentage = ((author.count / data.urlCards.length) * 100).toFixed(
        1
      );
      const line1 = `${index + 1}. ${author.handle}`;
      const line2 = `   ${author.count}/${data.urlCards.length} cards (${percentage}% overlap)\n`;

      console.log(line1);
      console.log(line2);

      outputContent += `${line1}\n${line2}\n`;
    });
  } else {
    const noAuthorsMsg = "🎉 No overlapping cards from other authors!\n";
    console.log(noAuthorsMsg);
    outputContent += `${noAuthorsMsg}\n`;
  }

  // Write to output file
  const outputDir = "./script-output";
  await fs.mkdir(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const outputFile = path.join(
    outputDir,
    `mutual-collections-${handle.replace(
      /\./g,
      "_"
    )}-${collectionRecordKey}-${timestamp}.txt`
  );
  await fs.writeFile(outputFile, outputContent);
  logSuccess(`📄 Results saved to: ${outputFile}`);
} catch (error) {
  console.error("❌ Error:", error);
} finally {
  rl.close();
}

logSection("✨ SCRIPT COMPLETED!");
