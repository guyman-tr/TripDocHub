import { Router, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import multer from "multer";
import { parseDocument, parseEmailBody } from "../documentParser";
import * as db from "../db";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import { sendPushNotification, EmailProcessingNotifications } from "../pushNotification";

const router = Router();

// Configure multer for handling multipart form data from Mailgun
// Mailgun sends attachments as multipart/form-data with fields like attachment-1, attachment-2, etc.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit per file
    files: 10, // Max 10 attachments
  },
});

// Mailgun webhook secret for signature verification
const MAILGUN_WEBHOOK_SIGNING_KEY = process.env.MAILGUN_WEBHOOK_SIGNING_KEY || "";

/**
 * Verify Mailgun webhook signature
 */
function verifyMailgunSignature(
  timestamp: string,
  token: string,
  signature: string
): boolean {
  if (!MAILGUN_WEBHOOK_SIGNING_KEY) {
    // AUDIT FIX: In production, reject requests when no signing key is configured
    // instead of silently allowing all requests (security risk).
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction) {
      console.error("[Mailgun] CRITICAL: No webhook signing key configured in production! Rejecting request.");
      return false;
    }
    console.warn("[Mailgun] No webhook signing key configured, skipping verification (dev only)");
    return true;
  }

  const encodedToken = createHmac("sha256", MAILGUN_WEBHOOK_SIGNING_KEY)
    .update(timestamp.concat(token))
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(encodedToken));
  } catch {
    return false;
  }
}

/**
 * Send push notification to user about email processing status
 */
async function sendProcessingNotification(
  userId: number,
  type: "received" | "completed" | "error" | "no_credits" | "no_bookings",
  details: {
    documentCount?: number;
    errorMessage?: string;
    subject?: string;
  }
): Promise<void> {
  try {
    let payload;

    switch (type) {
      case "received":
        payload = EmailProcessingNotifications.received(details.subject);
        break;
      case "completed":
        payload = EmailProcessingNotifications.completed(details.documentCount || 0);
        break;
      case "error":
        payload = EmailProcessingNotifications.error(details.errorMessage);
        break;
      case "no_credits":
        payload = EmailProcessingNotifications.noCredits();
        break;
      case "no_bookings":
        payload = EmailProcessingNotifications.noBookingsFound(details.subject);
        break;
    }

    const timestamp = new Date().toISOString();
    const result = await sendPushNotification(userId, payload);
    if (result.success) {
      console.log(`[Mailgun] [${timestamp}] Successfully sent ${type} push notification to user ${userId}`);
    } else {
      console.warn(`[Mailgun] [${timestamp}] Failed to send ${type} notification to user ${userId}. Error: ${result.error}. This may indicate the user hasn't opened the app yet or doesn't have notifications enabled.`);
    }
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`[Mailgun] [${timestamp}] Exception while sending ${type} notification to user ${userId}:`, error);
  }
}

/**
 * Process email attachments asynchronously
 * This runs in the background after we've already responded to Mailgun
 */
async function processAttachmentsAsync(
  userId: number,
  files: Express.Multer.File[],
  emailSubject: string | undefined
): Promise<void> {
  console.log(`[Mailgun Async] Starting attachment processing for user ${userId}, ${files.length} files`);
  
  let processedCount = 0;
  let hasError = false;

  for (const file of files) {
    const mimeType = file.mimetype;
    const fileName = file.originalname || file.fieldname;

    console.log(`[Mailgun Async] Processing file: ${fileName} (${mimeType}, ${file.size} bytes)`);

    // Only process PDFs and images
    if (!mimeType.startsWith("image/") && mimeType !== "application/pdf") {
      console.log(`[Mailgun Async] Skipping unsupported type: ${mimeType}`);
      continue;
    }

    try {
      // Upload to our storage
      const fileKey = `documents/${userId}/${nanoid(12)}-${fileName}`;
      const { url: fileUrl } = await storagePut(fileKey, file.buffer, mimeType);
      console.log(`[Mailgun Async] Uploaded to S3: ${fileUrl}`);

      // Parse the document using AI
      const parseResult = await parseDocument(fileUrl, mimeType);
      console.log(`[Mailgun Async] Parsed ${parseResult.documents.length} documents from ${fileName}`);

      // AUDIT FIX: If parser returned 0 documents (e.g., LLM error or unparseable image),
      // log it clearly so we can diagnose failures instead of silently succeeding.
      if (parseResult.documents.length === 0) {
        console.warn(`[Mailgun Async] Parser returned 0 documents for ${fileName} – LLM may have failed to parse this file`);
        hasError = true;
        continue;
      }

      // Create documents in database
      for (const doc of parseResult.documents) {
        // Try to auto-assign based on date
        let tripId: number | null = null;
        if (doc.documentDate) {
          const matchingTrip = await db.findMatchingTrip(userId, doc.documentDate);
          if (matchingTrip) {
            tripId = matchingTrip.id;
            console.log(`[Mailgun Async] Auto-assigned to trip: ${matchingTrip.name}`);
          }
        }

        // Check credits before each document
        const hasCredits = await db.canProcessDocument(userId);
        if (!hasCredits) {
          console.log(`[Mailgun Async] User ${userId} ran out of credits during processing`);
          await sendProcessingNotification(userId, "no_credits", {});
          return;
        }

        await db.createDocument({
          userId,
          tripId,
          category: doc.category,
          documentType: doc.documentType,
          title: doc.title,
          subtitle: doc.subtitle,
          details: doc.details,
          originalFileUrl: fileUrl,
          source: "email",
          documentDate: doc.documentDate,
          contentHash: parseResult.contentHash,
        });

        // Deduct credit for each document processed
        await db.deductCredit(userId);
        processedCount++;
      }

      console.log(`[Mailgun Async] Created ${parseResult.documents.length} documents from ${fileName}`);
    } catch (error) {
      console.error(`[Mailgun Async] Failed to process attachment ${fileName}:`, error);
      hasError = true;
    }
  }

  // Send completion notification
  if (hasError && processedCount === 0) {
    await sendProcessingNotification(userId, "error", { 
      errorMessage: "Failed to process email attachments. Please try uploading directly in the app." 
    });
  } else if (processedCount > 0) {
    await sendProcessingNotification(userId, "completed", { documentCount: processedCount });
  }

  console.log(`[Mailgun Async] Completed attachment processing for user ${userId}. Total documents created: ${processedCount}`);
}

/**
 * Process email body (when no attachments) asynchronously
 */
async function processEmailBodyAsync(
  userId: number,
  emailHtml: string | undefined,
  emailPlain: string | undefined,
  emailSubject: string | undefined,
  sender: string | undefined
): Promise<void> {
  console.log(`[Mailgun Async] Starting email body processing for user ${userId}`);

  try {
    // Check credits first
    const hasCredits = await db.canProcessDocument(userId);
    if (!hasCredits) {
      console.log(`[Mailgun Async] User ${userId} has no credits`);
      await sendProcessingNotification(userId, "no_credits", {});
      return;
    }

    // Parse the email body
    const parseResult = await parseEmailBody(emailHtml, emailPlain, emailSubject, sender);

    if (parseResult.documents.length === 0) {
      console.log(`[Mailgun Async] No bookings found in email body`);
      await sendProcessingNotification(userId, "no_bookings", { subject: emailSubject });
      return;
    }

    // Always process - user explicitly forwarded this email
    // (Removed duplicate detection per user request)

    let processedCount = 0;

    // Create documents in database
    for (const doc of parseResult.documents) {
      // Try to auto-assign based on date
      let tripId: number | null = null;
      if (doc.documentDate) {
        const matchingTrip = await db.findMatchingTrip(userId, doc.documentDate);
        if (matchingTrip) {
          tripId = matchingTrip.id;
          console.log(`[Mailgun Async] Auto-assigned to trip: ${matchingTrip.name}`);
        }
      }

      // Check credits before each document
      const hasCredits = await db.canProcessDocument(userId);
      if (!hasCredits) {
        console.log(`[Mailgun Async] User ${userId} ran out of credits during processing`);
        if (processedCount > 0) {
          await sendProcessingNotification(userId, "completed", { documentCount: processedCount });
        }
        await sendProcessingNotification(userId, "no_credits", {});
        return;
      }

      await db.createDocument({
        userId,
        tripId,
        category: doc.category,
        documentType: doc.documentType,
        title: doc.title,
        subtitle: doc.subtitle,
        details: doc.details,
        originalFileUrl: null, // No file URL for email body parsing
        originalEmailBody: emailHtml || emailPlain || null, // Store original email for display
        source: "email",
        documentDate: doc.documentDate,
        contentHash: parseResult.contentHash,
      });

      // Deduct credit for each document processed
      await db.deductCredit(userId);
      processedCount++;
    }

    // Send completion notification
    if (processedCount > 0) {
      await sendProcessingNotification(userId, "completed", { documentCount: processedCount });
    }

    console.log(`[Mailgun Async] Completed email body processing for user ${userId}. Total documents created: ${processedCount}`);
  } catch (error) {
    console.error(`[Mailgun Async] Failed to process email body:`, error);
    await sendProcessingNotification(userId, "error", { 
      errorMessage: "Failed to extract booking information from your email." 
    });
  }
}

/**
 * Handle incoming email webhook from Mailgun
 * 
 * IMPORTANT: Mailgun has a 10-second timeout for webhook responses.
 * We must respond immediately and process the email asynchronously.
 * 
 * Mailgun sends parsed messages as multipart/form-data with these fields:
 * - recipient: the email address the message was sent to
 * - sender: the sender's email address
 * - from: the From header (e.g., "Bob <bob@example.com>")
 * - subject: the email subject
 * - body-plain: plain text body
 * - body-html: HTML body
 * - attachment-count: number of attachments
 * - attachment-1, attachment-2, etc.: the actual file attachments
 * - timestamp, token, signature: for webhook verification
 */
router.post("/", upload.any(), async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log("[Mailgun] Received webhook");
    console.log("[Mailgun] Content-Type:", req.headers["content-type"]);
    console.log("[Mailgun] Body keys:", Object.keys(req.body));
    
    // Extract fields from the parsed message
    const {
      recipient,
      sender,
      from,
      subject,
      timestamp,
      token,
      signature,
      "body-plain": bodyPlain,
      "body-html": bodyHtml,
      "attachment-count": attachmentCountStr,
    } = req.body;

    console.log("[Mailgun] Recipient:", recipient);
    console.log("[Mailgun] Sender:", sender);
    console.log("[Mailgun] Subject:", subject);
    console.log("[Mailgun] Has HTML body:", !!bodyHtml);
    console.log("[Mailgun] Has plain body:", !!bodyPlain);

    // Verify signature if provided (do this quickly)
    if (timestamp && token && signature) {
      if (!verifyMailgunSignature(timestamp, token, signature)) {
        console.error("[Mailgun] Invalid webhook signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
      console.log("[Mailgun] Signature verified");
    }

    if (!recipient) {
      console.error("[Mailgun] No recipient in webhook");
      return res.status(400).json({ error: "No recipient" });
    }

    // Find user by forwarding email (quick DB lookup)
    const user = await db.getUserByForwardingEmail(recipient);
    if (!user) {
      console.error("[Mailgun] No user found for forwarding email:", recipient);
      return res.status(404).json({ error: "User not found" });
    }

    const logTimestamp = new Date().toISOString();
    console.log(`[Mailgun] [${logTimestamp}] Found user ${user.id} for forwarding email ${recipient}`);

    // Check if user can process documents (has credits or subscription)
    const canProcess = await db.canProcessDocument(user.id);
    if (!canProcess) {
      console.log(`[Mailgun] [${logTimestamp}] User ${user.id} (${recipient}) has no credits remaining`);
      // Send notification about no credits
      setImmediate(() => {
        sendProcessingNotification(user.id, "no_credits", {}).catch(console.error);
      });
      return res.status(402).json({ error: "Insufficient credits" });
    }

    // Get attachments from multer
    const files = req.files as Express.Multer.File[] | undefined;
    const hasAttachments = files && files.length > 0;
    const hasEmailBody = (bodyHtml && bodyHtml.length > 50) || (bodyPlain && bodyPlain.length > 50);

    if (!hasAttachments && !hasEmailBody) {
      console.log("[Mailgun] No attachments and no meaningful email body");
      return res.status(200).json({ message: "No content to process" });
    }

    console.log(`[Mailgun] Has ${files?.length || 0} attachments, hasEmailBody: ${hasEmailBody}`);

    // Send "received" notification immediately (before heavy processing)
    // This runs synchronously to ensure it executes in serverless environments
    try {
      await sendProcessingNotification(user.id, "received", { subject });
      console.log(`[Mailgun] [${logTimestamp}] Sent received notification for user ${user.id} (${recipient})`);
    } catch (notifError) {
      console.error(`[Mailgun] [${logTimestamp}] Failed to send received notification for user ${user.id} (${recipient}):`, notifError);
    }

    // AUDIT FIX: Respond 200 to Mailgun IMMEDIATELY, then process in background.
    // Previously we used Promise.race with an 8s timeout, but complex documents
    // (large images, multi-section itineraries) could exceed this and the
    // processing promise might be killed in serverless environments after the
    // response was sent. Now we respond first and process fully in background.
    console.log(`[Mailgun] Responding to Mailgun after ${Date.now() - startTime}ms (pre-processing)`);

    res.status(200).json({
      message: "Email received, processing started",
      attachmentCount: files?.length || 0,
      willParseBody: !hasAttachments && hasEmailBody,
    });

    // Fire-and-forget: process the email in the background
    // (setImmediate ensures this runs after the response is flushed)
    setImmediate(() => {
      (async () => {
        try {
          if (hasAttachments) {
            await processAttachmentsAsync(user.id, files!, subject);
          } else if (hasEmailBody) {
            await processEmailBodyAsync(user.id, bodyHtml, bodyPlain, subject, sender || from);
          }
          console.log(`[Mailgun] Background processing completed in ${Date.now() - startTime}ms`);
        } catch (error) {
          console.error("[Mailgun] Background processing failed:", error);
          await sendProcessingNotification(user.id, "error", {
            errorMessage: "Failed to process your email. Please try uploading directly in the app.",
          }).catch(console.error);
        }
      })();
    });

  } catch (error) {
    console.error("[Mailgun] Webhook error:", error);
    // Still try to respond quickly even on error
    if (!res.headersSent) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }
});

/**
 * Health check endpoint for Mailgun
 */
router.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

export default router;
