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

// Airport code to name mapping for navigation
const AIRPORT_CODES: Record<string, string> = {
  // Major international airports
  JFK: "John F. Kennedy International Airport, New York",
  LAX: "Los Angeles International Airport",
  LHR: "London Heathrow Airport",
  CDG: "Paris Charles de Gaulle Airport",
  FRA: "Frankfurt Airport",
  AMS: "Amsterdam Schiphol Airport",
  DXB: "Dubai International Airport",
  SIN: "Singapore Changi Airport",
  HKG: "Hong Kong International Airport",
  NRT: "Narita International Airport, Tokyo",
  HND: "Tokyo Haneda Airport",
  ICN: "Incheon International Airport, Seoul",
  SYD: "Sydney Kingsford Smith Airport",
  // Israel
  TLV: "Ben Gurion Airport, Tel Aviv, Israel",
  // Europe
  FCO: "Rome Fiumicino Airport",
  MXP: "Milan Malpensa Airport",
  BCN: "Barcelona El Prat Airport",
  MAD: "Madrid Barajas Airport",
  MUC: "Munich Airport",
  ZRH: "Zurich Airport",
  VIE: "Vienna International Airport",
  PRG: "Prague Vaclav Havel Airport",
  BUD: "Budapest Ferenc Liszt Airport",
  WAW: "Warsaw Chopin Airport",
  ATH: "Athens International Airport",
  IST: "Istanbul Airport",
  VRN: "Verona Villafranca Airport, Italy",
  VCE: "Venice Marco Polo Airport",
  BLQ: "Bologna Guglielmo Marconi Airport",
  // North America
  ORD: "Chicago O'Hare International Airport",
  SFO: "San Francisco International Airport",
  MIA: "Miami International Airport",
  ATL: "Hartsfield-Jackson Atlanta International Airport",
  DFW: "Dallas/Fort Worth International Airport",
  DEN: "Denver International Airport",
  SEA: "Seattle-Tacoma International Airport",
  BOS: "Boston Logan International Airport",
  EWR: "Newark Liberty International Airport",
  YYZ: "Toronto Pearson International Airport",
  YVR: "Vancouver International Airport",
  YUL: "Montreal Pierre Elliott Trudeau International Airport",
  // Asia
  PEK: "Beijing Capital International Airport",
  PVG: "Shanghai Pudong International Airport",
  BKK: "Bangkok Suvarnabhumi Airport",
  KUL: "Kuala Lumpur International Airport",
  DEL: "Indira Gandhi International Airport, Delhi",
  BOM: "Chhatrapati Shivaji International Airport, Mumbai",
  // Middle East
  DOH: "Hamad International Airport, Doha",
  AUH: "Abu Dhabi International Airport",
  AMM: "Queen Alia International Airport, Amman",
  // Australia/NZ
  MEL: "Melbourne Airport",
  AKL: "Auckland Airport",
};

const DOCUMENT_PARSING_PROMPT = `You are a travel document parser optimized for SPEED and ACCURACY. Extract booking information with these priorities:

## EXTRACTION STRATEGY
1. **Speed First**: Extract mandatory fields quickly. If a field is not found, use null - do NOT search twice or guess.
2. **Mandatory Fields**: These are critical for the user interface. Always extract if present.
3. **Bonus Details**: Useful extras go in the appropriate field or are skipped if not clearly stated.
4. **No Garbage**: Only extract data that is EXPLICITLY stated. Never infer, guess, or fabricate information.

## DATE PARSING (CRITICAL)
- Parse ALL date formats including DD.MM.YY, DD/MM/YYYY, YYYY-MM-DD, and written dates
- For 2-digit years: 25 = 2025, 26 = 2026, etc.
- Hebrew dates: תאריך, יום, חודש, שנה
- Output dates in ISO format (YYYY-MM-DDTHH:mm:ss)

## PHONE NUMBER FORMATTING (CRITICAL)
- For international numbers, ALWAYS add + prefix before country code
- Examples: +1-555-123-4567 (US), +44-20-1234-5678 (UK), +972-3-123-4567 (Israel), +49-22-028689605 (Germany)
- If number starts with country code without +, add the +
- Keep the original formatting (dashes, spaces) but ensure + prefix for international

## MANDATORY FIELDS BY CATEGORY

### FLIGHTS (UX Essentials)
- confirmationNumber (PNR/booking reference)
- airline
- flightNumber
- departureAirport (3-letter IATA code like TLV, JFK, LHR)
- arrivalAirport (3-letter IATA code)
- departureTime (ISO datetime)
- arrivalTime (ISO datetime if available)
- terminal (if stated)
- gate (if stated)

### ACCOMMODATIONS (UX Essentials)
- confirmationNumber
- hotelName
- address (FULL street address with city and country - critical for navigation)
- checkInDate (ISO date)
- checkOutDate (ISO date)
- phoneNumber (hotel phone with + prefix if international)
- emailAddress (hotel email if shown)

### CAR RENTALS (UX Essentials)
- confirmationNumber
- carCompany
- pickupLocation (location name)
- pickupAddress (FULL street address - critical for navigation)
- dropoffLocation (location name)
- dropoffAddress (FULL street address if different)
- pickupTime (ISO datetime)
- dropoffTime (ISO datetime)
- vehicleType
- phoneNumber (rental company phone with + prefix)
- emailAddress (rental company email)

### EVENTS (UX Essentials)
- eventName
- venue
- venueAddress (FULL street address - critical for navigation)
- eventDate (ISO date)
- eventTime (time string)
- confirmationNumber
- phoneNumber (venue/organizer phone with + prefix)

### INSURANCE (UX Essentials)
- insuranceProvider
- policyNumber
- coveragePeriod
- phoneNumber (EMERGENCY helpline - critical! with + prefix)
- emailAddress

## OUTPUT FORMAT
Return JSON with "documents" array. Each document has:
- category: "flight" | "carRental" | "accommodation" | "medical" | "event" | "other"
- documentType: e.g., "eTicket", "Boarding Pass", "Booking Confirmation"
- title: Short clear title (e.g., "TLV → VRN" for flights, "Hilton Munich" for hotels)
- subtitle: Additional context (airline name, company name)
- documentDate: Primary date in ISO format
- details: Object with the mandatory fields above

## MULTILINGUAL SUPPORT
Parse content in ANY language including Hebrew, Arabic, German, French, Spanish, etc.
Common Hebrew terms:
- טיסה = flight, מספר טיסה = flight number
- תאריך = date, שעה = time
- שדה תעופה = airport
- המראה = departure, נחיתה = arrival
- מלון = hotel, השכרת רכב = car rental
- טלפון = phone, כתובת = address`;

const EMAIL_PARSING_PROMPT = `You are a travel booking email parser optimized for SPEED and ACCURACY.

## EXTRACTION STRATEGY
1. **Speed First**: Extract mandatory fields quickly. If not found, use null - do NOT guess.
2. **Only Real Bookings**: Extract actual reservations only. Ignore promotions, newsletters, tips.
3. **No Garbage**: Only extract EXPLICITLY stated information. Never fabricate.

## DATE PARSING (CRITICAL)
- Parse ALL date formats: DD.MM.YY, DD/MM/YYYY, YYYY-MM-DD, written dates
- For 2-digit years: 25 = 2025, 26 = 2026
- Hebrew: תאריך הטיסה, יום, חודש
- Output in ISO format

## PHONE NUMBER FORMATTING (CRITICAL)
- International numbers MUST have + prefix before country code
- Examples: +1-555-123-4567, +44-20-1234-5678, +972-3-123-4567, +49-22-028689605
- If number has country code without +, ADD the +

## MANDATORY FIELDS BY CATEGORY

### FLIGHTS
- confirmationNumber, airline, flightNumber
- departureAirport (3-letter IATA code)
- arrivalAirport (3-letter IATA code)
- departureTime, arrivalTime (ISO datetime)
- terminal, gate (if stated)
- phoneNumber (with + prefix)

### ACCOMMODATIONS
- confirmationNumber, hotelName
- address (FULL street address with city/country)
- checkInDate, checkOutDate (ISO)
- phoneNumber, emailAddress (with + prefix for phone)

### CAR RENTALS
- confirmationNumber, carCompany
- pickupLocation, pickupAddress (FULL address)
- dropoffLocation, dropoffAddress
- pickupTime, dropoffTime (ISO)
- vehicleType
- phoneNumber, emailAddress (with + prefix for phone)

### EVENTS
- eventName, venue, venueAddress (FULL address)
- eventDate, eventTime
- confirmationNumber
- phoneNumber (with + prefix)

### INSURANCE
- insuranceProvider, policyNumber, coveragePeriod
- phoneNumber (EMERGENCY line - critical! with + prefix)
- emailAddress

## MULTILINGUAL SUPPORT
Parse ANY language including Hebrew, Arabic, German, etc.
Hebrew terms: טיסה=flight, מספר טיסה=flight number, תאריך=date, שעה=time, שדה תעופה=airport, המראה=departure, מלון=hotel

## OUTPUT
Return JSON with "documents" array containing extracted bookings.`;

export async function parseDocument(
  fileUrl: string,
  mimeType: string
): Promise<ParseResult> {
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
        // Post-process the details to ensure phone numbers have + prefix
        const details = postProcessDetails(doc.details || {}, doc.category);
        
        documents.push({
          category: validateCategory(doc.category),
          documentType: doc.documentType || "Document",
          title: doc.title || "Untitled Document",
          subtitle: doc.subtitle || null,
          details,
          documentDate: doc.documentDate ? new Date(doc.documentDate) : null,
        });
      }
    }

    return { documents, contentHash };
  } catch (error) {
    console.error("[DocumentParser] Failed to parse document:", error);
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
 */
export async function parseEmailBody(
  emailHtml: string | undefined,
  emailPlain: string | undefined,
  subject: string | undefined,
  sender: string | undefined
): Promise<ParseResult> {
  const emailContent = emailHtml || emailPlain;
  
  if (!emailContent || emailContent.trim().length < 50) {
    console.log("[DocumentParser] Email content too short or empty");
    return {
      documents: [],
      contentHash: createHash("sha256").update(emailContent || "empty").digest("hex").substring(0, 64),
    };
  }

  const contentHash = createHash("sha256").update(emailContent).digest("hex").substring(0, 64);

  try {
    let contextInfo = "";
    if (subject) {
      contextInfo += `Email Subject: ${subject}\n`;
    }
    if (sender) {
      contextInfo += `From: ${sender}\n`;
    }
    contextInfo += "\nEmail Content:\n";

    let cleanContent = emailContent;
    if (emailHtml) {
      cleanContent = cleanContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
      cleanContent = cleanContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
      cleanContent = cleanContent.replace(/&nbsp;/g, " ");
      cleanContent = cleanContent.replace(/&amp;/g, "&");
      cleanContent = cleanContent.replace(/&lt;/g, "<");
      cleanContent = cleanContent.replace(/&gt;/g, ">");
      cleanContent = cleanContent.replace(/<br\s*\/?>/gi, "\n");
      cleanContent = cleanContent.replace(/<\/p>/gi, "\n\n");
      cleanContent = cleanContent.replace(/<\/div>/gi, "\n");
      cleanContent = cleanContent.replace(/<\/tr>/gi, "\n");
      cleanContent = cleanContent.replace(/<\/td>/gi, " | ");
      cleanContent = cleanContent.replace(/<[^>]+>/g, "");
      cleanContent = cleanContent.replace(/\s+/g, " ").trim();
    }

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
        // Post-process the details to ensure phone numbers have + prefix
        const details = postProcessDetails(doc.details || {}, doc.category);
        
        documents.push({
          category: validateCategory(doc.category),
          documentType: doc.documentType || "Email Booking",
          title: doc.title || "Email Booking",
          subtitle: doc.subtitle || null,
          details,
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

/**
 * Post-process extracted details to ensure data quality
 */
function postProcessDetails(details: any, category: string): DocumentDetails {
  const processed = { ...details };
  
  // Ensure phone numbers have + prefix for international numbers
  if (processed.phoneNumber) {
    processed.phoneNumber = formatPhoneNumber(processed.phoneNumber);
  }
  
  // For flights, infer airport addresses from IATA codes if not provided
  if (category === "flight") {
    if (processed.departureAirport && !processed.departureAddress) {
      const airportName = AIRPORT_CODES[processed.departureAirport.toUpperCase()];
      if (airportName) {
        processed.departureAddress = airportName;
        if (processed.terminal) {
          processed.departureAddress += `, Terminal ${processed.terminal}`;
        }
      }
    }
    if (processed.arrivalAirport && !processed.arrivalAddress) {
      const airportName = AIRPORT_CODES[processed.arrivalAirport.toUpperCase()];
      if (airportName) {
        processed.arrivalAddress = airportName;
      }
    }
  }
  
  return processed;
}

/**
 * Format phone number to ensure international numbers have + prefix
 */
function formatPhoneNumber(phone: string): string {
  if (!phone) return phone;
  
  // Remove any leading/trailing whitespace
  let formatted = phone.trim();
  
  // If already has +, return as is
  if (formatted.startsWith("+")) {
    return formatted;
  }
  
  // If starts with 00 (international prefix), replace with +
  if (formatted.startsWith("00")) {
    return "+" + formatted.substring(2);
  }
  
  // Common country codes that indicate international numbers
  const intlPrefixes = [
    "1",    // US/Canada
    "44",   // UK
    "49",   // Germany
    "33",   // France
    "39",   // Italy
    "34",   // Spain
    "972",  // Israel
    "971",  // UAE
    "61",   // Australia
    "81",   // Japan
    "86",   // China
    "91",   // India
    "7",    // Russia
    "31",   // Netherlands
    "32",   // Belgium
    "41",   // Switzerland
    "43",   // Austria
    "45",   // Denmark
    "46",   // Sweden
    "47",   // Norway
    "48",   // Poland
    "30",   // Greece
    "90",   // Turkey
    "20",   // Egypt
    "27",   // South Africa
    "55",   // Brazil
    "52",   // Mexico
    "64",   // New Zealand
    "65",   // Singapore
    "66",   // Thailand
    "82",   // South Korea
    "852",  // Hong Kong
    "886",  // Taiwan
    "60",   // Malaysia
    "62",   // Indonesia
    "63",   // Philippines
    "84",   // Vietnam
  ];
  
  // Check if the number starts with a known country code
  for (const prefix of intlPrefixes) {
    if (formatted.startsWith(prefix) && formatted.length > prefix.length + 6) {
      return "+" + formatted;
    }
  }
  
  // If it's a long number (likely international), add +
  // Most international numbers are 10+ digits
  const digitsOnly = formatted.replace(/\D/g, "");
  if (digitsOnly.length >= 10) {
    // Check if it looks like it starts with a country code
    for (const prefix of intlPrefixes) {
      if (digitsOnly.startsWith(prefix)) {
        return "+" + formatted;
      }
    }
  }
  
  return formatted;
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
  const fileKey = `documents/${userId}/${nanoid(12)}-${fileName}`;
  const { url: fileUrl } = await storagePut(fileKey, fileBuffer, mimeType);
  const parseResult = await parseDocument(fileUrl, mimeType);
  return { fileUrl, parseResult };
}

// Export airport codes for use in UI
export { AIRPORT_CODES };
