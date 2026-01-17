import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { parseDocument } from "./documentParser";

// Credit amounts for each product (must match lib/billing.ts)
const CREDIT_AMOUNTS: Record<string, number> = {
  credits_10: 10,
  credits_50: 50,
  credits_100: 100,
};

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============ TRIPS ============
  trips: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const trips = await db.getUserTrips(ctx.user.id);
      const counts = await db.getDocumentCounts(ctx.user.id);
      return trips.map((trip) => ({
        ...trip,
        documentCount: counts.byTrip[trip.id] || 0,
      }));
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getTripById(input.id, ctx.user.id);
      }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(255),
          startDate: z.string().transform((s) => new Date(s)),
          endDate: z.string().transform((s) => new Date(s)),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const tripId = await db.createTrip({
          userId: ctx.user.id,
          name: input.name,
          startDate: input.startDate,
          endDate: input.endDate,
        });
        return { id: tripId };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Delete trip and all associated documents
        await db.deleteTripWithDocuments(input.id, ctx.user.id);
        return { success: true };
      }),

    archive: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.archiveTrip(input.id, ctx.user.id);
        return { success: true };
      }),

    unarchive: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.unarchiveTrip(input.id, ctx.user.id);
        return { success: true };
      }),

    listArchived: protectedProcedure.query(async ({ ctx }) => {
      const trips = await db.getArchivedTrips(ctx.user.id);
      const counts = await db.getDocumentCounts(ctx.user.id);
      return trips.map((trip) => ({
        ...trip,
        documentCount: counts.byTrip[trip.id] || 0,
      }));
    }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).max(255),
          startDate: z.string().transform((s) => new Date(s)),
          endDate: z.string().transform((s) => new Date(s)),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.updateTrip(input.id, ctx.user.id, {
          name: input.name,
          startDate: input.startDate,
          endDate: input.endDate,
        });
        return { success: true };
      }),
  }),

  // ============ DOCUMENTS ============
  documents: router({
    inbox: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserInboxDocuments(ctx.user.id);
    }),

    inboxCount: protectedProcedure.query(async ({ ctx }) => {
      const counts = await db.getDocumentCounts(ctx.user.id);
      return { count: counts.inbox };
    }),

    byTrip: protectedProcedure
      .input(z.object({ tripId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getTripDocuments(input.tripId, ctx.user.id);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const doc = await db.getDocumentById(input.id, ctx.user.id);
        if (doc && !doc.isRead) {
          await db.markDocumentAsRead(input.id, ctx.user.id);
        }
        return doc;
      }),

    assign: protectedProcedure
      .input(
        z.object({
          documentId: z.number(),
          tripId: z.number().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.assignDocumentToTrip(input.documentId, ctx.user.id, input.tripId);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteDocument(input.id, ctx.user.id);
        return { success: true };
      }),

    clearInbox: protectedProcedure
      .mutation(async ({ ctx }) => {
        const deleted = await db.clearUserInbox(ctx.user.id);
        return { success: true, deletedCount: deleted };
      }),

    // Check if a document with the same content hash already exists
    checkDuplicate: protectedProcedure
      .input(
        z.object({
          contentHash: z.string().length(64),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existingDoc = await db.findDuplicateDocument(ctx.user.id, input.contentHash);
        
        if (existingDoc) {
          return {
            isDuplicate: true,
            existingDocument: {
              id: existingDoc.id,
              title: existingDoc.title,
              documentType: existingDoc.documentType,
              category: existingDoc.category,
              createdAt: existingDoc.createdAt,
            },
          };
        }
        
        return { isDuplicate: false, existingDocument: null };
      }),

    // Parse and create document from uploaded file URL
    parseAndCreate: protectedProcedure
      .input(
        z.object({
          fileUrl: z.string().url(),
          mimeType: z.string(),
          tripId: z.number().nullable().optional(),
          contentHash: z.string().length(64).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Check if user can process documents (has credits or subscription)
        const canProcess = await db.canProcessDocument(ctx.user.id);
        if (!canProcess) {
          throw new Error("INSUFFICIENT_CREDITS");
        }

        const parseResult = await parseDocument(input.fileUrl, input.mimeType);
        const createdDocs: number[] = [];
        let autoAssignedTripId: number | null = null;
        let autoAssignedTripName: string | null = null;
        let needsManualAssignment = false;

        for (const doc of parseResult.documents) {
          let assignedTripId = input.tripId ?? null;

          // If no tripId provided, try to auto-assign based on document date
          if (assignedTripId === null && doc.documentDate) {
            const matchingTrip = await db.findMatchingTrip(ctx.user.id, doc.documentDate);
            if (matchingTrip) {
              assignedTripId = matchingTrip.id;
              autoAssignedTripId = matchingTrip.id;
              autoAssignedTripName = matchingTrip.name;
            } else {
              // Document has a date but no matching trip found
              needsManualAssignment = true;
            }
          } else if (assignedTripId === null && !doc.documentDate) {
            // No date extracted, needs manual assignment
            needsManualAssignment = true;
          }

          const docId = await db.createDocument({
            userId: ctx.user.id,
            tripId: assignedTripId,
            category: doc.category,
            documentType: doc.documentType,
            title: doc.title,
            subtitle: doc.subtitle,
            details: doc.details,
            originalFileUrl: input.fileUrl,
            source: "upload",
            documentDate: doc.documentDate,
            contentHash: input.contentHash || parseResult.contentHash,
          });
          createdDocs.push(docId);

          // Deduct one credit for each document processed
          await db.deductCredit(ctx.user.id);
        }

        return {
          documentIds: createdDocs,
          count: createdDocs.length,
          autoAssignedTripId,
          autoAssignedTripName,
          needsManualAssignment,
        };
      }),
  }),

  // ============ USER ============
  user: router({
    getForwardingEmail: protectedProcedure.query(async ({ ctx }) => {
      return { email: ctx.user.forwardingEmail };
    }),

    // Get user's credits and subscription status
    getCredits: protectedProcedure.query(async ({ ctx }) => {
      const { credits, hasSubscription } = await db.getUserCredits(ctx.user.id);
      return {
        credits,
        hasSubscription,
        subscriptionExpiresAt: ctx.user.subscriptionExpiresAt,
      };
    }),

    // Check if user can process a document (has credits or subscription)
    canProcess: protectedProcedure.query(async ({ ctx }) => {
      const canProcess = await db.canProcessDocument(ctx.user.id);
      return { canProcess };
    }),

    // Register push token for notifications
    registerPushToken: protectedProcedure
      .input(z.object({ token: z.string().min(1).max(255) }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserPushToken(ctx.user.id, input.token);
        return { success: true };
      }),

    // Unregister push token
    unregisterPushToken: protectedProcedure
      .mutation(async ({ ctx }) => {
        await db.updateUserPushToken(ctx.user.id, null);
        return { success: true };
      }),
  }),

  // ============ BILLING ============
  billing: router({
    // Redeem a promo code
    redeemPromoCode: protectedProcedure
      .input(z.object({ code: z.string().min(1).max(50) }))
      .mutation(async ({ ctx, input }) => {
        const promoCode = await db.getPromoCode(input.code);
        
        if (!promoCode) {
          return { success: false, error: "Invalid promo code" };
        }

        const result = await db.redeemPromoCode(
          ctx.user.id,
          promoCode.id,
          promoCode.credits
        );

        if (result.success) {
          const { credits } = await db.getUserCredits(ctx.user.id);
          return { 
            success: true, 
            creditsAdded: promoCode.credits,
            newBalance: credits,
          };
        }

        return result;
      }),

    // Process a Google Play purchase
    processPurchase: protectedProcedure
      .input(
        z.object({
          productId: z.string(),
          purchaseToken: z.string(),
          priceAmountMicros: z.number().optional(),
          currencyCode: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const creditsToAdd = CREDIT_AMOUNTS[input.productId];
        
        if (!creditsToAdd) {
          return { success: false, error: "Invalid product ID" };
        }

        const result = await db.processPurchase(
          ctx.user.id,
          input.productId,
          input.purchaseToken,
          creditsToAdd,
          input.priceAmountMicros,
          input.currencyCode
        );

        if (result.success) {
          const { credits } = await db.getUserCredits(ctx.user.id);
          return {
            success: true,
            creditsAdded: creditsToAdd,
            newBalance: credits,
          };
        }

        return result;
      }),

    // Admin: Create a promo code (only for admin users)
    createPromoCode: protectedProcedure
      .input(
        z.object({
          code: z.string().min(1).max(50),
          credits: z.number().min(1).max(10000),
          maxUses: z.number().min(1).optional(),
          expiresAt: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Check if user is admin
        if (ctx.user.role !== "admin") {
          return { success: false, error: "Unauthorized" };
        }

        try {
          const id = await db.createPromoCode({
            code: input.code,
            credits: input.credits,
            maxUses: input.maxUses ?? null,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          });

          return { success: true, id };
        } catch (error: any) {
          if (error.code === "ER_DUP_ENTRY") {
            return { success: false, error: "Promo code already exists" };
          }
          throw error;
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
