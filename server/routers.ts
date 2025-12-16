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

    // Parse and create document from uploaded file URL
    parseAndCreate: protectedProcedure
      .input(
        z.object({
          fileUrl: z.string().url(),
          mimeType: z.string(),
          tripId: z.number().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const parseResult = await parseDocument(input.fileUrl, input.mimeType);
        const createdDocs: number[] = [];

        for (const doc of parseResult.documents) {
          const docId = await db.createDocument({
            userId: ctx.user.id,
            tripId: input.tripId ?? null,
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

        return { documentIds: createdDocs, count: createdDocs.length };
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
