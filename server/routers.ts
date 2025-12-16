import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { parseDocument } from "./documentParser";

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
        await db.deleteTrip(input.id, ctx.user.id);
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

    // Parse document and check for duplicates (does not save)
    parseOnly: protectedProcedure
      .input(
        z.object({
          fileUrl: z.string().url(),
          mimeType: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const parseResult = await parseDocument(input.fileUrl, input.mimeType);
        
        // Check for duplicates for each parsed document
        const documentsWithDuplicates = await Promise.all(
          parseResult.documents.map(async (doc) => {
            const duplicates = await db.findPotentialDuplicates(
              ctx.user.id,
              doc.category,
              doc.details || {}
            );
            return {
              ...doc,
              potentialDuplicates: duplicates.map((d) => ({
                id: d.document.id,
                title: d.document.title,
                subtitle: d.document.subtitle,
                category: d.document.category,
                tripId: d.document.tripId,
                matchScore: d.matchScore,
                matchedFields: d.matchedFields,
                createdAt: d.document.createdAt,
              })),
            };
          })
        );

        return {
          documents: documentsWithDuplicates,
          contentHash: parseResult.contentHash,
          fileUrl: input.fileUrl,
        };
      }),

    // Create document after user confirms (handles duplicate decision)
    createAfterParse: protectedProcedure
      .input(
        z.object({
          fileUrl: z.string().url(),
          category: z.string(),
          documentType: z.string(),
          title: z.string(),
          subtitle: z.string().nullable().optional(),
          details: z.record(z.string(), z.string()).optional(),
          documentDate: z.string().nullable().optional(),
          contentHash: z.string().optional(),
          tripId: z.number().nullable().optional(),
          // Duplicate handling
          duplicateAction: z.enum(["create", "update", "skip"]).optional(),
          existingDocumentId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Handle duplicate action
        if (input.duplicateAction === "skip") {
          return { documentId: null, action: "skipped" };
        }

        if (input.duplicateAction === "update" && input.existingDocumentId) {
          // Update existing document with new details
          await db.updateDocumentDetails(input.existingDocumentId, ctx.user.id, {
            title: input.title,
            subtitle: input.subtitle,
            details: input.details,
            documentDate: input.documentDate ? new Date(input.documentDate) : null,
            originalFileUrl: input.fileUrl,
          });
          return { documentId: input.existingDocumentId, action: "updated" };
        }

        // Create new document (default action)
        let assignedTripId = input.tripId ?? null;
        let autoAssignedTripId: number | null = null;
        let autoAssignedTripName: string | null = null;
        let needsManualAssignment = false;

        // If no tripId provided, try to auto-assign based on document date
        if (assignedTripId === null && input.documentDate) {
          const matchingTrip = await db.findMatchingTrip(ctx.user.id, new Date(input.documentDate));
          if (matchingTrip) {
            assignedTripId = matchingTrip.id;
            autoAssignedTripId = matchingTrip.id;
            autoAssignedTripName = matchingTrip.name;
          } else {
            needsManualAssignment = true;
          }
        } else if (assignedTripId === null && !input.documentDate) {
          needsManualAssignment = true;
        }

        const docId = await db.createDocument({
          userId: ctx.user.id,
          tripId: assignedTripId,
          category: input.category as any,
          documentType: input.documentType,
          title: input.title,
          subtitle: input.subtitle,
          details: input.details,
          originalFileUrl: input.fileUrl,
          source: "upload",
          documentDate: input.documentDate ? new Date(input.documentDate) : null,
          contentHash: input.contentHash,
        });

        return {
          documentId: docId,
          action: "created",
          autoAssignedTripId,
          autoAssignedTripName,
          needsManualAssignment,
        };
      }),

    // Legacy: Parse and create document from uploaded file URL (for backward compatibility)
    parseAndCreate: protectedProcedure
      .input(
        z.object({
          fileUrl: z.string().url(),
          mimeType: z.string(),
          tripId: z.number().nullable().optional(),
          skipDuplicateCheck: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const parseResult = await parseDocument(input.fileUrl, input.mimeType);
        const createdDocs: number[] = [];
        let autoAssignedTripId: number | null = null;
        let autoAssignedTripName: string | null = null;
        let needsManualAssignment = false;
        let hasDuplicates = false;
        let duplicateInfo: any[] = [];

        for (const doc of parseResult.documents) {
          // Check for duplicates if not skipping
          if (!input.skipDuplicateCheck) {
            const duplicates = await db.findPotentialDuplicates(
              ctx.user.id,
              doc.category,
              doc.details || {}
            );
            if (duplicates.length > 0) {
              hasDuplicates = true;
              duplicateInfo.push({
                parsedDoc: doc,
                duplicates: duplicates.map((d) => ({
                  id: d.document.id,
                  title: d.document.title,
                  subtitle: d.document.subtitle,
                  category: d.document.category,
                  tripId: d.document.tripId,
                  matchScore: d.matchScore,
                  matchedFields: d.matchedFields,
                })),
              });
              continue; // Don't create, let client handle
            }
          }

          let assignedTripId = input.tripId ?? null;

          // If no tripId provided, try to auto-assign based on document date
          if (assignedTripId === null && doc.documentDate) {
            const matchingTrip = await db.findMatchingTrip(ctx.user.id, doc.documentDate);
            if (matchingTrip) {
              assignedTripId = matchingTrip.id;
              autoAssignedTripId = matchingTrip.id;
              autoAssignedTripName = matchingTrip.name;
            } else {
              needsManualAssignment = true;
            }
          } else if (assignedTripId === null && !doc.documentDate) {
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
            contentHash: parseResult.contentHash,
          });
          createdDocs.push(docId);
        }

        return {
          documentIds: createdDocs,
          count: createdDocs.length,
          autoAssignedTripId,
          autoAssignedTripName,
          needsManualAssignment,
          hasDuplicates,
          duplicateInfo,
          fileUrl: input.fileUrl,
          contentHash: parseResult.contentHash,
        };
      }),
  }),

  // ============ USER ============
  user: router({
    getForwardingEmail: protectedProcedure.query(async ({ ctx }) => {
      return { email: ctx.user.forwardingEmail };
    }),
  }),
});

export type AppRouter = typeof appRouter;
