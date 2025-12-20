import { Router, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import multer from "multer";
import { parseDocument } from "../documentParser";
import * as db from "../db";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";

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
    console.warn("[Mailgun] No webhook signing key configured, skipping verification");
    return true; // Allow in development
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
 * Handle incoming email webhook from Mailgun
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
  try {
    console.log("[Mailgun] Received webhook");
    console.log("[Mailgun] Content-Type:", req.headers["content-type"]);
    console.log("[Mailgun] Body keys:", Object.keys(req.body));
    console.log("[Mailgun] Files:", req.files ? (req.files as Express.Multer.File[]).map(f => ({ fieldname: f.fieldname, originalname: f.originalname, mimetype: f.mimetype, size: f.size })) : "none");
    
    // Extract fields from the parsed message
    const {
      recipient,
      sender,
      from,
      subject,
      timestamp,
      token,
      signature,
      "attachment-count": attachmentCountStr,
      "body-plain": bodyPlain,
    } = req.body;

    console.log("[Mailgun] Recipient:", recipient);
    console.log("[Mailgun] Sender:", sender);
    console.log("[Mailgun] From:", from);
    console.log("[Mailgun] Subject:", subject);
    console.log("[Mailgun] Attachment count:", attachmentCountStr);

    // Verify signature if provided
    if (timestamp && token && signature) {
      if (!verifyMailgunSignature(timestamp, token, signature)) {
        console.error("[Mailgun] Invalid webhook signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
      console.log("[Mailgun] Signature verified");
    } else {
      console.log("[Mailgun] No signature provided, skipping verification");
    }

    if (!recipient) {
      console.error("[Mailgun] No recipient in webhook");
      return res.status(400).json({ error: "No recipient" });
    }

    // Find user by forwarding email
    const user = await db.getUserByForwardingEmail(recipient);
    if (!user) {
      console.error("[Mailgun] No user found for forwarding email:", recipient);
      return res.status(404).json({ error: "User not found" });
    }

    console.log(`[Mailgun] Found user ${user.id} for email ${recipient}`);

    // Check if user can process documents (has credits or subscription)
    const canProcess = await db.canProcessDocument(user.id);
    if (!canProcess) {
      console.log(`[Mailgun] User ${user.id} has no credits remaining`);
      return res.status(402).json({ error: "Insufficient credits" });
    }

    // Get attachments from multer
    const files = req.files as Express.Multer.File[] | undefined;
    const attachmentCount = parseInt(attachmentCountStr || "0", 10);

    if (!files || files.length === 0) {
      console.log("[Mailgun] No file attachments in email");
      
      // Even without attachments, we could process the email body
      // For now, just return success
      return res.status(200).json({ message: "No attachments to process" });
    }

    console.log(`[Mailgun] Processing ${files.length} file attachments`);

    let processedCount = 0;

    for (const file of files) {
      const mimeType = file.mimetype;
      const fileName = file.originalname || file.fieldname;

      console.log(`[Mailgun] Processing file: ${fileName} (${mimeType}, ${file.size} bytes)`);

      // Only process PDFs and images
      if (!mimeType.startsWith("image/") && mimeType !== "application/pdf") {
        console.log(`[Mailgun] Skipping unsupported type: ${mimeType}`);
        continue;
      }

      try {
        // Upload to our storage
        const fileKey = `documents/${user.id}/${nanoid(12)}-${fileName}`;
        const { url: fileUrl } = await storagePut(fileKey, file.buffer, mimeType);
        console.log(`[Mailgun] Uploaded to S3: ${fileUrl}`);

        // Parse the document using AI
        const parseResult = await parseDocument(fileUrl, mimeType);
        console.log(`[Mailgun] Parsed ${parseResult.documents.length} documents from ${fileName}`);

        // Create documents in database
        for (const doc of parseResult.documents) {
          // Try to auto-assign based on date
          let tripId: number | null = null;
          if (doc.documentDate) {
            const matchingTrip = await db.findMatchingTrip(user.id, doc.documentDate);
            if (matchingTrip) {
              tripId = matchingTrip.id;
              console.log(`[Mailgun] Auto-assigned to trip: ${matchingTrip.name}`);
            }
          }

          // Check credits before each document
          const hasCredits = await db.canProcessDocument(user.id);
          if (!hasCredits) {
            console.log(`[Mailgun] User ${user.id} ran out of credits during processing`);
            break;
          }

          await db.createDocument({
            userId: user.id,
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
          await db.deductCredit(user.id);
          processedCount++;
        }

        console.log(`[Mailgun] Created ${parseResult.documents.length} documents from ${fileName}`);
      } catch (error) {
        console.error(`[Mailgun] Failed to process attachment ${fileName}:`, error);
      }
    }

    console.log(`[Mailgun] Total documents created: ${processedCount}`);
    return res.status(200).json({ 
      message: "Email processed", 
      documentsCreated: processedCount 
    });
  } catch (error) {
    console.error("[Mailgun] Webhook error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Health check endpoint for Mailgun
 */
router.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

export default router;
