/**
 * Unit tests for Document Action Icons feature
 * Tests phone/email extraction and icon state logic
 */

import { describe, it, expect } from "vitest";
import type { DocumentDetails } from "../drizzle/schema";

// Mock document data for testing
interface MockDocument {
  id: number;
  category: string;
  title: string;
  subtitle: string | null;
  documentType: string;
  details: DocumentDetails;
  originalFileUrl: string | null;
}

// Helper function to determine contact info (mirrors the logic in [id].tsx)
function getContactInfo(document: MockDocument) {
  const details = document.details || {};
  const category = document.category;
  
  // Get address based on category
  let address: string | null = null;
  if (category === "accommodation" && details.address) {
    address = details.address;
  } else if (category === "carRental") {
    address = details.pickupAddress || details.dropoffAddress || null;
  } else if (category === "event" && details.venueAddress) {
    address = details.venueAddress;
  } else if (category === "flight") {
    address = details.arrivalAddress || details.departureAddress || null;
  }
  
  const phone = details.phoneNumber || null;
  const email = details.emailAddress || null;
  const hasOriginal = !!document.originalFileUrl;
  
  return { address, phone, email, hasOriginal };
}

// Determine which icons should be enabled (3 icons: Navigate, Call, Email)
function getIconStates(document: MockDocument) {
  const info = getContactInfo(document);
  return {
    navigateEnabled: !!info.address,
    callEnabled: !!info.phone,
    emailEnabled: !!info.email,
  };
}

describe("Document Action Icons", () => {
  describe("Hotel booking with full contact info", () => {
    const hotelDoc: MockDocument = {
      id: 1,
      category: "accommodation",
      title: "Grand Budapest Hotel",
      subtitle: "Deluxe Suite",
      documentType: "Booking Confirmation",
      details: {
        confirmationNumber: "HBK123456",
        hotelName: "Grand Budapest Hotel",
        checkInDate: "2025-03-15",
        checkOutDate: "2025-03-18",
        address: "123 Main Street, Budapest, Hungary",
        phoneNumber: "+36 1 234 5678",
        emailAddress: "reservations@grandbudapest.com",
      },
      originalFileUrl: "https://storage.example.com/docs/hotel-confirmation.pdf",
    };

    it("should enable all 3 action icons when all contact data is present", () => {
      const states = getIconStates(hotelDoc);
      expect(states.navigateEnabled).toBe(true);
      expect(states.callEnabled).toBe(true);
      expect(states.emailEnabled).toBe(true);
    });

    it("should extract correct address from accommodation details", () => {
      const info = getContactInfo(hotelDoc);
      expect(info.address).toBe("123 Main Street, Budapest, Hungary");
    });

    it("should extract phone number", () => {
      const info = getContactInfo(hotelDoc);
      expect(info.phone).toBe("+36 1 234 5678");
    });

    it("should extract email address", () => {
      const info = getContactInfo(hotelDoc);
      expect(info.email).toBe("reservations@grandbudapest.com");
    });
  });

  describe("Flight booking with partial contact info", () => {
    const flightDoc: MockDocument = {
      id: 2,
      category: "flight",
      title: "TLV → BUD",
      subtitle: "El Al Flight 123",
      documentType: "eTicket",
      details: {
        confirmationNumber: "ABC123",
        airline: "El Al",
        flightNumber: "LY123",
        departureAirport: "TLV",
        arrivalAirport: "BUD",
        departureTime: "2025-03-15T10:00:00",
        arrivalTime: "2025-03-15T13:00:00",
        arrivalAddress: "Budapest Ferenc Liszt International Airport, 1185 Budapest, Hungary",
        phoneNumber: "+972 3 977 1111",
        // No email address
      },
      originalFileUrl: "https://storage.example.com/docs/eticket.pdf",
    };

    it("should enable navigate and call but disable email", () => {
      const states = getIconStates(flightDoc);
      expect(states.navigateEnabled).toBe(true);
      expect(states.callEnabled).toBe(true);
      expect(states.emailEnabled).toBe(false);
    });

    it("should use arrival address for flights", () => {
      const info = getContactInfo(flightDoc);
      expect(info.address).toBe("Budapest Ferenc Liszt International Airport, 1185 Budapest, Hungary");
    });
  });

  describe("Car rental with pickup/dropoff addresses", () => {
    const carDoc: MockDocument = {
      id: 3,
      category: "carRental",
      title: "Hertz Rental",
      subtitle: "Economy Car",
      documentType: "Rental Confirmation",
      details: {
        confirmationNumber: "HERTZ789",
        carCompany: "Hertz",
        pickupLocation: "Budapest Airport",
        dropoffLocation: "Budapest City Center",
        pickupAddress: "Budapest Airport Terminal 2, 1185 Budapest, Hungary",
        dropoffAddress: "Váci utca 10, 1052 Budapest, Hungary",
        phoneNumber: "+36 1 296 0999",
        emailAddress: "budapest@hertz.com",
      },
      originalFileUrl: null, // No original file
    };

    it("should enable all 3 action icons for car rental", () => {
      const states = getIconStates(carDoc);
      expect(states.navigateEnabled).toBe(true);
      expect(states.callEnabled).toBe(true);
      expect(states.emailEnabled).toBe(true);
    });

    it("should prefer pickup address for car rentals", () => {
      const info = getContactInfo(carDoc);
      expect(info.address).toBe("Budapest Airport Terminal 2, 1185 Budapest, Hungary");
    });
  });

  describe("Event with venue address", () => {
    const eventDoc: MockDocument = {
      id: 4,
      category: "event",
      title: "Concert Ticket",
      subtitle: "Taylor Swift Eras Tour",
      documentType: "Event Ticket",
      details: {
        eventName: "Taylor Swift Eras Tour",
        eventDate: "2025-06-15",
        eventTime: "20:00",
        venue: "Puskás Aréna",
        venueAddress: "Istvánmezei út 3-5, 1146 Budapest, Hungary",
        // No phone or email
      },
      originalFileUrl: "https://storage.example.com/docs/ticket.pdf",
    };

    it("should enable navigate but disable call and email", () => {
      const states = getIconStates(eventDoc);
      expect(states.navigateEnabled).toBe(true);
      expect(states.callEnabled).toBe(false);
      expect(states.emailEnabled).toBe(false);
    });

    it("should use venue address for events", () => {
      const info = getContactInfo(eventDoc);
      expect(info.address).toBe("Istvánmezei út 3-5, 1146 Budapest, Hungary");
    });
  });

  describe("Document with no contact info", () => {
    const minimalDoc: MockDocument = {
      id: 5,
      category: "other",
      title: "Travel Notes",
      subtitle: null,
      documentType: "Document",
      details: {},
      originalFileUrl: null,
    };

    it("should disable all 3 action icons", () => {
      const states = getIconStates(minimalDoc);
      expect(states.navigateEnabled).toBe(false);
      expect(states.callEnabled).toBe(false);
      expect(states.emailEnabled).toBe(false);
    });
  });

  describe("Medical insurance document", () => {
    const medicalDoc: MockDocument = {
      id: 6,
      category: "medical",
      title: "Travel Insurance",
      subtitle: "World Nomads",
      documentType: "Insurance Policy",
      details: {
        insuranceProvider: "World Nomads",
        policyNumber: "WN-2025-123456",
        coveragePeriod: "March 1 - March 31, 2025",
        phoneNumber: "+1 800 555 1234",
        emailAddress: "claims@worldnomads.com",
        // No address for medical insurance
      },
      originalFileUrl: "https://storage.example.com/docs/insurance.pdf",
    };

    it("should enable call and email but disable navigate", () => {
      const states = getIconStates(medicalDoc);
      expect(states.navigateEnabled).toBe(false);
      expect(states.callEnabled).toBe(true);
      expect(states.emailEnabled).toBe(true);
    });
  });
});

describe("Phone number cleaning", () => {
  // Helper to clean phone numbers (mirrors logic in [id].tsx)
  function cleanPhoneNumber(phone: string): string {
    return phone.replace(/[^\d+]/g, '');
  }

  it("should remove spaces from phone numbers", () => {
    expect(cleanPhoneNumber("+36 1 234 5678")).toBe("+3612345678");
  });

  it("should remove dashes from phone numbers", () => {
    expect(cleanPhoneNumber("+1-800-555-1234")).toBe("+18005551234");
  });

  it("should remove parentheses from phone numbers", () => {
    expect(cleanPhoneNumber("+1 (800) 555-1234")).toBe("+18005551234");
  });

  it("should preserve + prefix", () => {
    expect(cleanPhoneNumber("+972 3 977 1111")).toBe("+97239771111");
  });

  it("should handle local numbers without +", () => {
    expect(cleanPhoneNumber("03-977-1111")).toBe("039771111");
  });
});
