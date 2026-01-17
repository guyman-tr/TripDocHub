import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { createHash } from "crypto";
import { nanoid } from "nanoid";
import type { DocumentDetails } from "../drizzle/schema";

export interface ParsedDocument {
  category: "flight" | "carRental" | "accommodation" | "medical" | "event" | "other";
  documentType: string;
  title: string;
  subtitle: string | null;
  details: DocumentDetails;
  documentDate: Date | null;
}

export interface ParseResult {
  documents: ParsedDocument[];
  contentHash: string;
}

const DOCUMENT_PARSING_PROMPT = `You are a travel document parser. Analyze the provided document (image or PDF) and extract all booking information.

For each booking found, extract:
1. category: One of "flight", "carRental", "accommodation", "medical", "event", or "other"
2. documentType: The type of document (e.g., "eTicket", "Boarding Pass", "Booking Confirmation", "Insurance Policy", "Event Ticket", "Receipt")
3. title: A short, clear title (e.g., "TLV → BUD" for flights, "Grand Budapest Hotel" for hotels)
4. subtitle: Additional context (e.g., airline name, car rental company)
5. documentDate: The primary date of the booking (flight date, check-in date, event date) in ISO format
6. details: An object with relevant fields based on the category

For flights, include in details:
- confirmationNumber, airline, flightNumber, departureAirport, arrivalAirport, departureTime, arrivalTime, seatNumber, terminal, gate, departureAddress (full airport address if available), arrivalAddress (full airport address if available)

For accommodations, include in details:
- confirmationNumber, hotelName, checkInDate, checkOutDate, roomType, address (full street address including city, country)

For car rentals, include in details:
- confirmationNumber, carCompany, pickupLocation, dropoffLocation, pickupTime, dropoffTime, vehicleType, pickupAddress (full street address), dropoffAddress (full street address)

For medical insurance, include in details:
- insuranceProvider, policyNumber, coveragePeriod

For events, include in details:
- eventName, eventDate, eventTime, venue, confirmationNumber, venueAddress (full street address including city, country)

Return a JSON object with a "documents" array containing all found bookings. If no bookings are found, return an empty array.`;

const EMAIL_PARSING_PROMPT = `You are a travel booking email parser. Analyze the provided email content and extract all booking/reservation information.

This is the content of a forwarded email that may contain booking confirmations, itineraries, or reservation details. Extract all travel-related bookings you can find.

For each booking found, extract:
1. category: One of "flight", "carRental", "accommodation", "medical", "event", or "other"
2. documentType: The type of document (e.g., "eTicket", "Booking Confirmation", "Itinerary", "Reservation", "Receipt")
3. title: A short, clear title (e.g., "TLV → BUD" for flights, "Grand Budapest Hotel" for hotels)
4. subtitle: Additional context (e.g., airline name, hotel chain, car rental company)
5. documentDate: The primary date of the booking (flight date, check-in date, event date) in ISO format
6. details: An object with relevant fields based on the category

For flights, include in details:
- confirmationNumber, airline, flightNumber, departureAirport, arrivalAirport, departureTime, arrivalTime, passengerName

For accommodations, include in details:
- confirmationNumber, hotelName, checkInDate, checkOutDate, roomType, address, guestName

For car rentals, include in details:
- confirmationNumber, carCompany, pickupLocation, dropoffLocation, pickupTime, dropoffTime, vehicleType

For events, include in details:
- eventName, eventDate, eventTime, venue, confirmationNumber

Return a JSON object with a "documents" array containing all found bookings. If no travel bookings are found in the email, return an empty array.

Important: Only extract actual booking/reservation information. Ignore promotional content, newsletters, or general travel tips.`;

export async function parseDocument(
  fileUrl: string,
  mimeType: string
): Promise<ParseResult> {
  // Generate content hash from URL for duplicate detection
  const contentHash = createHash("sha256").update(fileUrl).digest("hex").substring(0, 64);

  try {
    const isImage = mimeType.startsWith("image/");
    const isPdf = mimeType === "application/pdf";

    let content: any[];

    if (isImage) {
      content = [
        { type: "text", text: DOCUMENT_PARSING_PROMPT },
        {
          type: "image_url",
          image_url: {
            url: fileUrl,
            detail: "high",
          },
        },
      ];
    } else if (isPdf) {
      content = [
        { type: "text", text: DOCUMENT_PARSING_PROMPT },
        {
          type: "file_url",
          file_url: {
            url: fileUrl,
            mime_type: "application/pdf",
          },
        },
      ];
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }

    const response = await invokeLLM({
      messages: [
        {
          role: "user",
          content,
        },
      ],
      response_format: { type: "json_object" },
    });

    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("No response from LLM");
    }

    // Handle both string and array content types
    let responseText: string;
    if (typeof responseContent === "string") {
      responseText = responseContent;
    } else if (Array.isArray(responseContent)) {
      // Extract text from content array
      const textPart = responseContent.find((part) => part.type === "text");
      if (textPart && textPart.type === "text") {
        responseText = textPart.text;
      } else {
        throw new Error("No text content in LLM response");
      }
    } else {
      throw new Error("Unexpected response format from LLM");
    }

    const parsed = JSON.parse(responseText);
    const documents: ParsedDocument[] = [];

    if (parsed.documents && Array.isArray(parsed.documents)) {
      for (const doc of parsed.documents) {
        documents.push({
          category: validateCategory(doc.category),
          documentType: doc.documentType || "Document",
          title: doc.title || "Untitled Document",
          subtitle: doc.subtitle || null,
          details: doc.details || {},
          documentDate: doc.documentDate ? new Date(doc.documentDate) : null,
        });
      }
    }

    return { documents, contentHash };
  } catch (error) {
    console.error("[DocumentParser] Failed to parse document:", error);
    // Return a generic document if parsing fails
    return {
      documents: [
        {
          category: "other",
          documentType: "Document",
          title: "Uploaded Document",
          subtitle: null,
          details: {},
          documentDate: null,
        },
      ],
      contentHash,
    };
  }
}

/**
 * Parse email body content (HTML or plain text) to extract booking information
 * Used when emails are forwarded without attachments
 */
export async function parseEmailBody(
  emailHtml: string | undefined,
  emailPlain: string | undefined,
  subject: string | undefined,
  sender: string | undefined
): Promise<ParseResult> {
  // Use HTML if available, fall back to plain text
  const emailContent = emailHtml || emailPlain;
  
  if (!emailContent || emailContent.trim().length < 50) {
    console.log("[DocumentParser] Email content too short or empty");
    return {
      documents: [],
      contentHash: createHash("sha256").update(emailContent || "empty").digest("hex").substring(0, 64),
    };
  }

  // Generate content hash from email content for duplicate detection
  const contentHash = createHash("sha256").update(emailContent).digest("hex").substring(0, 64);

  try {
    // Build context with subject and sender if available
    let contextInfo = "";
    if (subject) {
      contextInfo += `Email Subject: ${subject}\n`;
    }
    if (sender) {
      contextInfo += `From: ${sender}\n`;
    }
    contextInfo += "\nEmail Content:\n";

    // Clean up HTML if present (basic cleanup)
    let cleanContent = emailContent;
    if (emailHtml) {
      // Remove script and style tags
      cleanContent = cleanContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
      cleanContent = cleanContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
      // Convert common HTML entities
      cleanContent = cleanContent.replace(/&nbsp;/g, " ");
      cleanContent = cleanContent.replace(/&amp;/g, "&");
      cleanContent = cleanContent.replace(/&lt;/g, "<");
      cleanContent = cleanContent.replace(/&gt;/g, ">");
      // Remove HTML tags but keep content
      cleanContent = cleanContent.replace(/<br\s*\/?>/gi, "\n");
      cleanContent = cleanContent.replace(/<\/p>/gi, "\n\n");
      cleanContent = cleanContent.replace(/<\/div>/gi, "\n");
      cleanContent = cleanContent.replace(/<\/tr>/gi, "\n");
      cleanContent = cleanContent.replace(/<\/td>/gi, " | ");
      cleanContent = cleanContent.replace(/<[^>]+>/g, "");
      // Clean up whitespace
      cleanContent = cleanContent.replace(/\s+/g, " ").trim();
    }

    // Truncate if too long (keep first 15000 chars)
    if (cleanContent.length > 15000) {
      cleanContent = cleanContent.substring(0, 15000) + "...";
    }

    const response = await invokeLLM({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: EMAIL_PARSING_PROMPT + "\n\n" + contextInfo + cleanContent,
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("No response from LLM");
    }

    // Handle both string and array content types
    let responseText: string;
    if (typeof responseContent === "string") {
      responseText = responseContent;
    } else if (Array.isArray(responseContent)) {
      const textPart = responseContent.find((part) => part.type === "text");
      if (textPart && textPart.type === "text") {
        responseText = textPart.text;
      } else {
        throw new Error("No text content in LLM response");
      }
    } else {
      throw new Error("Unexpected response format from LLM");
    }

    const parsed = JSON.parse(responseText);
    const documents: ParsedDocument[] = [];

    if (parsed.documents && Array.isArray(parsed.documents)) {
      for (const doc of parsed.documents) {
        documents.push({
          category: validateCategory(doc.category),
          documentType: doc.documentType || "Email Booking",
          title: doc.title || "Email Booking",
          subtitle: doc.subtitle || null,
          details: doc.details || {},
          documentDate: doc.documentDate ? new Date(doc.documentDate) : null,
        });
      }
    }

    console.log(`[DocumentParser] Parsed ${documents.length} bookings from email body`);
    return { documents, contentHash };
  } catch (error) {
    console.error("[DocumentParser] Failed to parse email body:", error);
    return {
      documents: [],
      contentHash,
    };
  }
}

function validateCategory(
  category: string
): "flight" | "carRental" | "accommodation" | "medical" | "event" | "other" {
  const validCategories = ["flight", "carRental", "accommodation", "medical", "event", "other"];
  if (validCategories.includes(category)) {
    return category as any;
  }
  return "other";
}

export async function uploadAndParseDocument(
  userId: number,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{
  fileUrl: string;
  parseResult: ParseResult;
}> {
  // Generate unique file key
  const fileKey = `documents/${userId}/${nanoid(12)}-${fileName}`;

  // Upload to S3
  const { url: fileUrl } = await storagePut(fileKey, fileBuffer, mimeType);

  // Parse the document
  const parseResult = await parseDocument(fileUrl, mimeType);

  return { fileUrl, parseResult };
}
