import { SemblePDSClient } from "@cosmik.network/semble-pds-client";
import dotenv from "dotenv";

dotenv.config();

// Utility functions for styled console output
const logSection = (title: string) => {
  console.log("\n" + "=".repeat(60));
  console.log(`  ${title}`);
  console.log("=".repeat(60));
};

const logSubSection = (title: string) => {
  console.log("\n" + "-".repeat(60));
  console.log(`  ${title}`);
  console.log("-".repeat(60));
};

const logSuccess = (message: string) => {
  console.log("SUCCESS! ", message);
};

const logInfo = (label: string, data: any) => {
  console.log(`INFO  ${label}:`, data);
};

const logAction = (message: string) => {
  console.log("ACTION", message);
};

logSection("SEMBLE PDS CLIENT - TEST SCRIPT");

logAction("Establishing connection to SemblePDS...");
const client = new SemblePDSClient({
  service: "https://bsky.social", // or your PDS URL
  env: "dev", // optional: appends to NSID (e.g. network.cosmik.dev.*), usually only used for testing purposes
});

logAction("Logging in...");
// Login with app password
await client.login(process.env.BLUESKY_HANDLE!, process.env.APP_PASSWORD!);
logSuccess("Successfully logged in!");

// ============================================================
// SECTION 1: Create Cards
// ============================================================
logSection("SECTION 1: CREATE CARDS");

// Create a URL card
logAction("Creating URL card...");
// actually creating two cards
const atProtoCard = await client.createCard({
  url: "https://blog.bront.rodeo/setting-up-your-own-pds/",
  note: "guide: how to set up your own pds",
  // viaCard: someOtherCard, // Optional: reference to the card that led to this one
});

logSuccess("Created URL card");
logInfo("Card details", {
  urlCard: atProtoCard.urlCard,
  noteCard: atProtoCard.noteCard,
});

// Add a note to an existing card
logAction("Adding note to existing card...");
// TODO: bug here in the card - missing card.urlCard
// Question: difference between noteCard and linkCard
// BUG: this note didn't get added... why... where did it go - bug in addNote logic - stripped two fields
// Semble assumes there's only one note card per user per url card; so if a user
// has multiple note cards, only the first one (or most recent one) get displayed. weird.
const newNoteCard2AtProtoCard = await client.addNoteToCard(
  atProtoCard.urlCard,
  "second note - maybe I should also create my own pds"
);
logSuccess("Added note to card");
console.log(
  "Added note",
  newNoteCard2AtProtoCard,
  "to ulr card:",
  atProtoCard.urlCard
);

logAction("Updating note...");
// Update a note
console.log("Update noteCard: ", newNoteCard2AtProtoCard);
await client.updateNote(
  newNoteCard2AtProtoCard,
  "Why am i updating this card?"
);

const noteCardRecord = atProtoCard.noteCard
  ? await client.getCard(atProtoCard.noteCard)
  : null;

logInfo("Current note card record", noteCardRecord);

// ============================================================
// SECTION 2: Create & Manage Collections
// ============================================================
logSection("SECTION 2: CREATE & MANAGE COLLECTIONS");

logAction("Creating atproto collection...");
const atProtoCollection = await client.createCollection({
  name: "atproto",
  description: "everything atproto",
});

console.log("Created atproto collection:", atProtoCollection);

// Add card to collection
const collectionLink = await client.addCardToCollection(
  atProtoCard.urlCard,
  atProtoCollection
);

logSuccess("Card added to collection");
logInfo("Collection link", collectionLink);

// Add card to collection with provenance tracking
// Question: provenance tracking = checking reference to the card that led to this addition? what's going on underneath?
// ----> the intention of this is to trigger a notification for the via card's owner
// ----> current use case is actually when user A added user B's card to user A's library(viaCard will be that user B's card).
// ----> both cards share the same url but they are different card instances.
// ----> user B will get a notification "user A added your card to their library"
// ----> not exploring the use case of viaCard having different url.

// const collectionLinkWithProvenance = await client.addCardToCollection(
//   card,
//   collection
//   //   viaCard // Optional: reference to the card that led to this addition
// );

// Delete a card
// await client.deleteCard(card.urlCard);

logAction("Creating gardening collection...");
const gardenCollection = await client.createCollection({
  name: "gardening",
  description: "everything gardening",
});
logSuccess("Created gardening collection");
logInfo("collection details", gardenCollection);

// Update collection
logAction("Updating gardening collection...");
await client.updateCollection(
  gardenCollection,
  "Gardening",
  "Research for backyard garden in Canada"
);
console.log("Updated garden collection with new name and description");

// Get a specific collection
const collectionRecord = await client.getCollection(gardenCollection);
logInfo("Updated collection record", collectionRecord);

// Delete collection
// await client.deleteCollection(collection);

// Remove card from collection
// await client.removeCardFromCollection(collectionLink);

// ============================================================
// SECTION 3: Batch Operations
// ============================================================
logSection("SECTION 3: BATCH OPERATIONS");

logSubSection("Batch Create Cards");
logAction("Creating multiple cards...");
// Batch create multiple cards
const batchCardResults = await client.createCards({
  cards: [
    {
      url: "https://docs.bsky.app/docs/advanced-guides/firehose",
      note: "Firehose",
    },
    { url: "https://atproto.com/guides/account-lifecycle" },
    {
      url: "https://blog.bront.rodeo/30-days-of-atproto-hope-for-an-open-future/",
      viaCard: atProtoCard.urlCard,
    },
  ],
});
// Question: it said 4 cards were created - i guess we created a noteCard as well
// yup - the first one created two cards - url and note.
// Question: https://pdsls.dev/at://did:plc:3rygoykt7vjqwqwsldsla3f5/network.cosmik.dev.card

logSuccess(`Created ${batchCardResults.results.length} cards in batch`);
logInfo("Batch card results", batchCardResults.results);

logSubSection("Batch Create Collections");
logAction("Creating multiple collections...");
// Batch create multiple collections
const collectionsResult = await client.createCollections({
  collections: [
    { name: "Artsy fartsy", description: "artsy things" },
    { name: "Fun arts things" },
  ],
});
logSuccess(`Created ${collectionsResult.results.length} collections in batch`);
logInfo("Batch collections results", collectionsResult.results);

// ============================================================
// SECTION 4: Fetch Records
// ============================================================
logSection("SECTION 4: FETCH CARDS & COLLECTIONS");

logSubSection("My PDS Records");
logAction("Fetching my top 50 cards...");
// Question: this would return both url cards and note cards...
// Question: why not return url cards with its note cards concatenated?
// ---> API returns that!!! PDS is more barebone.

// List your own cards with pagination
const myCardsResult = await client.getMyCards({
  limit: 50,
  //   cursor: "optional-cursor",
  reverse: false,
});
logSuccess(`Found ${myCardsResult.records.length} cards`);
logInfo("details", myCardsResult.records);

logAction("Fetching my collections...");
// List your own collections with pagination
const myCollectionsResult = await client.getMyCollections({
  limit: 20,
});
logSuccess(`Found ${myCollectionsResult.records.length} collections`);
logInfo("details", myCollectionsResult.records);

logSubSection("cosmiktesting.bsky.social PDS Records");
logAction("Fetching cosmiktesting's top 50 cards...");

// List cards for a specific user
const userCardsResult = await client.getCards(
  // Question: is it after did:plc:?
  "did:plc:rlknsba2qldjkicxsmni3vyn",
  {
    limit: 50,
  }
);
logSuccess(`Found ${userCardsResult.records.length} cards for cosmiktesting`);
logInfo("details", userCardsResult.records);

logAction("Fetching cosmiktesting's top 20 collections...");
// List collections for a specific user
const userCollectionsResult = await client.getCollections(
  "did:plc:rlknsba2qldjkicxsmni3vyn",
  {
    limit: 20,
  }
);
logSuccess(
  `Found ${userCollectionsResult.records.length} collections for cosmiktesting`
);
logInfo("details", userCollectionsResult.records);

// ============================================================
// SECTION 5: Add Cards to Garden Collection
// ============================================================
logSection("SECTION 5: POPULATE GARDEN COLLECTION");

logAction("Creating gardening-related cards...");
// Batch add multiple cards to a collection
const card1 = await client.createCard({
  url: "https://vancouver.ca/files/cov/urban-agriculture-garden-guide.pdf",
  note: "urban argiculture garden guide",
  // viaCard: someOtherCard, // Optional: reference to the card that led to this one
});
logSuccess("Created card1: Vancouver garden guide");
logInfo("Card details", {
  urlCard: card1.urlCard,
  noteCard: card1.noteCard,
});

const card2 = await client.createCard({
  url: "https://www.brampton.ca/EN/residents/parks/Pages/Backyard-Gardens.aspx",
  note: "brampton backyard gardens",
  viaCard: card1.urlCard, // Optional: reference to the card that led to this one
});
logSuccess("Created card2: Brampton backyard gardens");
logInfo("Card details", {
  urlCard: card2.urlCard,
  noteCard: card2.noteCard,
});

logAction("Adding cards to garden collection...");
const linksResult = await client.addCardsToCollection({
  collection: myCollectionsResult.records[1], // should be my gardening one - or maybe it's a random error
  cards: [card1.urlCard, card2.urlCard],
  //   viaCard: someCard, // Optional: applies to all cards being added
});
logSuccess(`Added ${linksResult.results.length} cards to garden collection`);
logInfo("Collection links", linksResult.results);
