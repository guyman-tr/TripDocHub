import { and, eq, isNull, desc, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  trips,
  documents,
  InsertTrip,
  InsertDocument,
  Trip,
  Document,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { nanoid } from "nanoid";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USER FUNCTIONS ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    // Generate forwarding email for new users
    if (!values.forwardingEmail) {
      values.forwardingEmail = `trip-${nanoid(8).toLowerCase()}@in.mytripdochub.com`;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserForwardingEmail(userId: number, forwardingEmail: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set({ forwardingEmail }).where(eq(users.id, userId));
}

// ============ TRIP FUNCTIONS ============

export async function getUserTrips(userId: number): Promise<Trip[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(trips)
    .where(and(eq(trips.userId, userId), eq(trips.isArchived, false)))
    .orderBy(desc(trips.startDate));
}

export async function getTripById(tripId: number, userId: number): Promise<Trip | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createTrip(data: InsertTrip): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(trips).values(data);
  return Number(result[0].insertId);
}

export async function deleteTrip(tripId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // First, move all documents from this trip to inbox
  await db
    .update(documents)
    .set({ tripId: null })
    .where(and(eq(documents.tripId, tripId), eq(documents.userId, userId)));

  // Then delete the trip
  await db.delete(trips).where(and(eq(trips.id, tripId), eq(trips.userId, userId)));
}

export async function deleteTripWithDocuments(tripId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete all documents associated with this trip
  await db
    .delete(documents)
    .where(and(eq(documents.tripId, tripId), eq(documents.userId, userId)));

  // Then delete the trip
  await db.delete(trips).where(and(eq(trips.id, tripId), eq(trips.userId, userId)));
}

export async function updateTrip(
  tripId: number,
  userId: number,
  data: { name: string; startDate: Date; endDate: Date }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(trips)
    .set({
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
    })
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)));
}

export async function archiveTrip(tripId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(trips)
    .set({ isArchived: true })
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)));
}

export async function unarchiveTrip(tripId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(trips)
    .set({ isArchived: false })
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)));
}

export async function getArchivedTrips(userId: number): Promise<Trip[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(trips)
    .where(and(eq(trips.userId, userId), eq(trips.isArchived, true)))
    .orderBy(desc(trips.startDate));
}

// ============ DOCUMENT FUNCTIONS ============

export async function getUserInboxDocuments(userId: number): Promise<Document[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(documents)
    .where(and(eq(documents.userId, userId), isNull(documents.tripId)))
    .orderBy(desc(documents.createdAt));
}

export async function getTripDocuments(tripId: number, userId: number): Promise<Document[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(documents)
    .where(and(eq(documents.tripId, tripId), eq(documents.userId, userId)))
    .orderBy(desc(documents.createdAt));
}

export async function getDocumentById(
  documentId: number,
  userId: number
): Promise<Document | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createDocument(data: InsertDocument): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(documents).values(data);
  return Number(result[0].insertId);
}

export async function updateDocument(
  documentId: number,
  userId: number,
  data: Partial<InsertDocument>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(documents)
    .set(data)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
}

export async function assignDocumentToTrip(
  documentId: number,
  userId: number,
  tripId: number | null
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(documents)
    .set({ tripId })
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
}

export async function deleteDocument(documentId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
}

export async function clearUserInbox(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete all documents that are not assigned to any trip (inbox documents)
  const result = await db
    .delete(documents)
    .where(and(eq(documents.userId, userId), isNull(documents.tripId)));

  return result[0]?.affectedRows ?? 0;
}

export async function findDuplicateDocument(
  userId: number,
  contentHash: string
): Promise<Document | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.contentHash, contentHash)))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function findMatchingTrip(
  userId: number,
  documentDate: Date
): Promise<Trip | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  // Find a trip where the document date falls within the trip's date range
  const result = await db
    .select()
    .from(trips)
    .where(
      and(
        eq(trips.userId, userId),
        lte(trips.startDate, documentDate),
        gte(trips.endDate, documentDate)
      )
    )
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getDocumentCounts(userId: number): Promise<{
  inbox: number;
  byTrip: Record<number, number>;
}> {
  const db = await getDb();
  if (!db) return { inbox: 0, byTrip: {} };

  const allDocs = await db
    .select({ tripId: documents.tripId })
    .from(documents)
    .where(eq(documents.userId, userId));

  let inbox = 0;
  const byTrip: Record<number, number> = {};

  for (const doc of allDocs) {
    if (doc.tripId === null) {
      inbox++;
    } else {
      byTrip[doc.tripId] = (byTrip[doc.tripId] || 0) + 1;
    }
  }

  return { inbox, byTrip };
}

export async function markDocumentAsRead(documentId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(documents)
    .set({ isRead: true })
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
}


export async function getUserByForwardingEmail(forwardingEmail: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.forwardingEmail, forwardingEmail))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getDocumentByContentHash(
  userId: number,
  contentHash: string
): Promise<Document | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.contentHash, contentHash)))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ CREDITS FUNCTIONS ============

export async function getUserCredits(userId: number): Promise<{ credits: number; hasSubscription: boolean }> {
  const db = await getDb();
  if (!db) return { credits: 0, hasSubscription: false };

  const result = await db
    .select({ credits: users.credits, subscriptionExpiresAt: users.subscriptionExpiresAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (result.length === 0) return { credits: 0, hasSubscription: false };

  const user = result[0];
  const hasSubscription = user.subscriptionExpiresAt !== null && user.subscriptionExpiresAt > new Date();

  return { credits: user.credits, hasSubscription };
}

export async function deductCredit(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // First check if user has subscription or credits
  const { credits, hasSubscription } = await getUserCredits(userId);

  // If user has active subscription, don't deduct credits
  if (hasSubscription) return true;

  // If no credits left, return false
  if (credits <= 0) return false;

  // Deduct one credit
  await db
    .update(users)
    .set({ credits: credits - 1 })
    .where(eq(users.id, userId));

  return true;
}

export async function addCredits(userId: number, amount: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { credits } = await getUserCredits(userId);

  await db
    .update(users)
    .set({ credits: credits + amount })
    .where(eq(users.id, userId));
}

export async function setSubscription(userId: number, expiresAt: Date | null): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({ subscriptionExpiresAt: expiresAt })
    .where(eq(users.id, userId));
}

export async function canProcessDocument(userId: number): Promise<boolean> {
  const { credits, hasSubscription } = await getUserCredits(userId);
  return hasSubscription || credits > 0;
}


// ============ PROMO CODE FUNCTIONS ============

import { promoCodes, promoRedemptions, purchases, InsertPromoCode, InsertPurchase } from "../drizzle/schema";

export async function getPromoCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.code, code.toUpperCase()))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function hasUserRedeemedCode(userId: number, promoCodeId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .select()
    .from(promoRedemptions)
    .where(and(eq(promoRedemptions.userId, userId), eq(promoRedemptions.promoCodeId, promoCodeId)))
    .limit(1);

  return result.length > 0;
}

export async function redeemPromoCode(
  userId: number,
  promoCodeId: number,
  credits: number
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  // Get the promo code
  const codeResult = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.id, promoCodeId))
    .limit(1);

  if (codeResult.length === 0) {
    return { success: false, error: "Promo code not found" };
  }

  const code = codeResult[0];

  // Check if code is active
  if (!code.isActive) {
    return { success: false, error: "This promo code is no longer active" };
  }

  // Check if code has expired
  if (code.expiresAt && code.expiresAt < new Date()) {
    return { success: false, error: "This promo code has expired" };
  }

  // Check if max uses reached
  if (code.maxUses !== null && code.currentUses >= code.maxUses) {
    return { success: false, error: "This promo code has reached its maximum uses" };
  }

  // Check if user already redeemed this code
  const alreadyRedeemed = await hasUserRedeemedCode(userId, promoCodeId);
  if (alreadyRedeemed) {
    return { success: false, error: "You have already redeemed this promo code" };
  }

  // Add credits to user
  await addCredits(userId, credits);

  // Record the redemption
  await db.insert(promoRedemptions).values({
    userId,
    promoCodeId,
    creditsAdded: credits,
  });

  // Increment usage count
  await db
    .update(promoCodes)
    .set({ currentUses: code.currentUses + 1 })
    .where(eq(promoCodes.id, promoCodeId));

  return { success: true };
}

export async function createPromoCode(data: InsertPromoCode): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(promoCodes).values({
    ...data,
    code: data.code.toUpperCase(),
  });
  return Number(result[0].insertId);
}

// ============ PURCHASE FUNCTIONS ============

export async function recordPurchase(data: InsertPurchase): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(purchases).values(data);
  return Number(result[0].insertId);
}

export async function getPurchaseByToken(purchaseToken: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(purchases)
    .where(eq(purchases.purchaseToken, purchaseToken))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function processPurchase(
  userId: number,
  productId: string,
  purchaseToken: string,
  creditsToAdd: number,
  priceAmountMicros?: number,
  currencyCode?: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  // Check if this purchase was already processed
  const existingPurchase = await getPurchaseByToken(purchaseToken);
  if (existingPurchase) {
    return { success: false, error: "This purchase has already been processed" };
  }

  // Add credits to user
  await addCredits(userId, creditsToAdd);

  // Record the purchase
  await recordPurchase({
    userId,
    productId,
    purchaseToken,
    creditsAdded: creditsToAdd,
    priceAmountMicros,
    currencyCode,
  });

  return { success: true };
}
