import { Router, Request, Response } from "express";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { parseDocument } from "../documentParser";
import * as db from "../db";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";

const router = Router();

// Mailgun webhook secret for signature verification
const MAILGUN_WEBHOOK_SIGNING_KEY = process.env.MAILGUN_WEBHOOK_SIGNING_KEY || "";

interface MailgunAttachment {
  url: string;
  "content-type": string;
  name: string;
  size: number;
}

interface MailgunWebhookPayload {
  signature: {
    timestamp: string;
    token: string;
    signature: string;
  };
  "event-data": {
    event: string;
    timestamp: number;
    message: {
      headers: {
        from: string;
        to: string;
        subject: string;
        "message-id": string;
      };
      attachments?: MailgunAttachment[];
    };
    storage?: {
      url: string;
      key: string;
    };
  };
}

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
 * Extract forwarding email address from the recipient
 * Format: {unique_id}@triphub.yourdomain.com
 */
function extractForwardingId(recipient: string): string | null {
  // Extract the local part before @ symbol
  const match = recipient.match(/^([a-zA-Z0-9]+)@/);
  return match ? match[1] : null;
}

/**
 * Download attachment from Mailgun storage
 */
async function downloadAttachment(
  attachmentUrl: string,
  apiKey: string
): Promise<Buffer> {
  const response = await fetch(attachmentUrl, {
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download attachment: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Handle incoming email webhook from Mailgun
 */
router.post("/inbound", async (req: Request, res: Response) => {
  try {
    console.log("[Mailgun] Received webhook");

    // Parse the webhook payload
    const payload = req.body as MailgunWebhookPayload;

    // Verify signature
    if (payload.signature) {
      const { timestamp, token, signature } = payload.signature;
      if (!verifyMailgunSignature(timestamp, token, signature)) {
        console.error("[Mailgun] Invalid webhook signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const eventData = payload["event-data"];
    if (!eventData || !eventData.message) {
      console.error("[Mailgun] Invalid webhook payload - missing event data");
      return res.status(400).json({ error: "Invalid payload" });
    }

    const { headers, attachments } = eventData.message;
    const recipient = headers.to;
    const subject = headers.subject || "Forwarded Document";

    // Find user by forwarding email
    const forwardingId = extractForwardingId(recipient);
    if (!forwardingId) {
      console.error("[Mailgun] Could not extract forwarding ID from:", recipient);
      return res.status(400).json({ error: "Invalid recipient" });
    }

    const user = await db.getUserByForwardingEmail(recipient);
    if (!user) {
      console.error("[Mailgun] No user found for forwarding email:", recipient);
      return res.status(404).json({ error: "User not found" });
    }

    console.log(`[Mailgun] Processing email for user ${user.id}: ${subject}`);

    // Process attachments
    if (!attachments || attachments.length === 0) {
      console.log("[Mailgun] No attachments found in email");
      return res.status(200).json({ message: "No attachments to process" });
    }

    const mailgunApiKey = process.env.MAILGUN_API_KEY || "";
    let processedCount = 0;

    for (const attachment of attachments) {
      const mimeType = attachment["content-type"];

      // Only process PDFs and images
      if (!mimeType.startsWith("image/") && mimeType !== "application/pdf") {
        console.log(`[Mailgun] Skipping unsupported attachment type: ${mimeType}`);
        continue;
      }

      try {
        // Download the attachment
        const fileBuffer = await downloadAttachment(attachment.url, mailgunApiKey);

        // Upload to our storage
        const fileKey = `documents/${user.id}/${nanoid(12)}-${attachment.name}`;
        const { url: fileUrl } = await storagePut(fileKey, fileBuffer, mimeType);

        // Parse the document using AI
        const parseResult = await parseDocument(fileUrl, mimeType);

        // Check for duplicates
        const existingDoc = await db.getDocumentByContentHash(
          user.id,
          parseResult.contentHash
        );
        if (existingDoc) {
          console.log(`[Mailgun] Duplicate document detected, skipping: ${attachment.name}`);
          continue;
        }

        // Create documents in database
        for (const doc of parseResult.documents) {
          await db.createDocument({
            userId: user.id,
            tripId: null, // Goes to inbox
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
          processedCount++;
        }

        console.log(`[Mailgun] Processed attachment: ${attachment.name}`);
      } catch (error) {
        console.error(`[Mailgun] Failed to process attachment ${attachment.name}:`, error);
      }
    }

    console.log(`[Mailgun] Processed ${processedCount} documents from email`);
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
