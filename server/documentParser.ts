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
- confirmationNumber, airline, flightNumber, departureAirport, arrivalAirport, departureTime, arrivalTime, seatNumber, terminal, gate

For accommodations, include in details:
- confirmationNumber, hotelName, checkInDate, checkOutDate, roomType, address

For car rentals, include in details:
- confirmationNumber, carCompany, pickupLocation, dropoffLocation, pickupTime, dropoffTime, vehicleType

For medical insurance, include in details:
- insuranceProvider, policyNumber, coveragePeriod

For events, include in details:
- eventName, eventDate, eventTime, venue, confirmationNumber

Return a JSON object with a "documents" array containing all found bookings. If no bookings are found, return an empty array.`;

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
