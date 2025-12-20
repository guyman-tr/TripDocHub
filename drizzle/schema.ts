import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Unique email forwarding address for this user (e.g., trip-inbox-abc123@triphub.dev)
  forwardingEmail: varchar("forwardingEmail", { length: 320 }),
  // Credits system: 20 free credits for new users, 1 credit = 1 document processed
  credits: int("credits").default(20).notNull(),
  // Subscription status: null = no subscription, date = subscription expires at
  subscriptionExpiresAt: timestamp("subscriptionExpiresAt"),
  // Stripe/Google Play customer ID for payment tracking
  paymentCustomerId: varchar("paymentCustomerId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Trips table - each user can have multiple trips
 */
export const trips = mysqlTable("trips", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Trip = typeof trips.$inferSelect;
export type InsertTrip = typeof trips.$inferInsert;

/**
 * Document categories
 */
export const documentCategoryEnum = mysqlEnum("documentCategory", [
  "flight",
  "carRental",
  "accommodation",
  "medical",
  "event",
  "other",
]);

/**
 * Documents table - parsed travel documents
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Null tripId means document is in inbox (unassigned)
  tripId: int("tripId"),
  
  // Document category and type
  category: documentCategoryEnum.notNull(),
  documentType: varchar("documentType", { length: 100 }).notNull(), // eTicket, Boarding Pass, Confirmation, etc.
  
  // Parsed display info
  title: varchar("title", { length: 255 }).notNull(), // e.g., "TLV → BUD"
  subtitle: varchar("subtitle", { length: 255 }), // e.g., "El Al Flight 123"
  
  // Parsed details as JSON (dates, times, confirmation numbers, etc.)
  details: json("details"),
  
  // Date range for auto-assignment matching
  documentDate: timestamp("documentDate"), // Primary date of the document (flight date, check-in date, etc.)
  
  // Original file storage
  originalFileUrl: text("originalFileUrl"), // S3 URL to original PDF/image
  originalFileName: varchar("originalFileName", { length: 255 }),
  originalFileMimeType: varchar("originalFileMimeType", { length: 100 }),
  
  // Source tracking
  source: mysqlEnum("source", ["upload", "email", "camera"]).default("upload").notNull(),
  emailSubject: varchar("emailSubject", { length: 500 }), // If from email forwarding
  
  // Content hash for duplicate detection
  contentHash: varchar("contentHash", { length: 64 }),
  
  // Status
  isRead: boolean("isRead").default(false).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// Type for document details JSON
export interface DocumentDetails {
  confirmationNumber?: string;
  departureTime?: string;
  arrivalTime?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  departureAddress?: string; // Full airport address for navigation
  arrivalAddress?: string; // Full airport address for navigation
  airline?: string;
  flightNumber?: string;
  seatNumber?: string;
  terminal?: string;
  gate?: string;
  hotelName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  roomType?: string;
  address?: string; // Full street address for accommodation
  carCompany?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupAddress?: string; // Full address for car rental pickup
  dropoffAddress?: string; // Full address for car rental dropoff
  pickupTime?: string;
  dropoffTime?: string;
  vehicleType?: string;
  insuranceProvider?: string;
  policyNumber?: string;
  coveragePeriod?: string;
  eventName?: string;
  eventDate?: string;
  eventTime?: string;
  venue?: string;
  venueAddress?: string; // Full address for event venue
  [key: string]: string | undefined;
}
