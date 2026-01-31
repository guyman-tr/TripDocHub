import { describe, it, expect } from "vitest";

/**
 * Tests for document parsing improvements:
 * 1. Phone number formatting with + prefix for international numbers
 * 2. Address validation for navigation (only real addresses or airport codes)
 * 3. Airport code to address mapping
 */

// Mock the formatPhoneNumber function logic
function formatPhoneNumber(phone: string): string {
  if (!phone) return phone;
  
  let formatted = phone.trim();
  
  if (formatted.startsWith("+")) {
    return formatted;
  }
  
  if (formatted.startsWith("00")) {
    return "+" + formatted.substring(2);
  }
  
  const intlPrefixes = [
    "1", "44", "49", "33", "39", "34", "972", "971", "61", "81", "86", "91",
    "7", "31", "32", "41", "43", "45", "46", "47", "48", "30", "90", "20",
    "27", "55", "52", "64", "65", "66", "82", "852", "886", "60", "62", "63", "84"
  ];
  
  for (const prefix of intlPrefixes) {
    if (formatted.startsWith(prefix) && formatted.length > prefix.length + 6) {
      return "+" + formatted;
    }
  }
  
  const digitsOnly = formatted.replace(/\D/g, "");
  if (digitsOnly.length >= 10) {
    for (const prefix of intlPrefixes) {
      if (digitsOnly.startsWith(prefix)) {
        return "+" + formatted;
      }
    }
  }
  
  return formatted;
}

// Mock the isValidAddress function logic
function isValidAddress(addr: string | undefined): boolean {
  if (!addr) return false;
  const hasNumber = /\d/.test(addr);
  const hasAddressKeyword = /street|str\.|avenue|ave\.|road|rd\.|boulevard|blvd\.|highway|hwy\.|lane|ln\.|drive|dr\.|airport|terminal|plaza|center|centre/i.test(addr);
  const hasCity = /,/.test(addr);
  return hasNumber || hasAddressKeyword || hasCity;
}

// Airport code mapping
const AIRPORT_ADDRESSES: Record<string, string> = {
  JFK: "John F. Kennedy International Airport, New York",
  LAX: "Los Angeles International Airport",
  TLV: "Ben Gurion Airport, Tel Aviv, Israel",
  VRN: "Verona Villafranca Airport, Italy",
  YYZ: "Toronto Pearson International Airport",
  MUC: "Munich Airport",
};

describe("Phone Number Formatting", () => {
  it("should keep numbers that already have + prefix", () => {
    expect(formatPhoneNumber("+1-555-123-4567")).toBe("+1-555-123-4567");
    expect(formatPhoneNumber("+972-3-123-4567")).toBe("+972-3-123-4567");
    expect(formatPhoneNumber("+49-22-028689605")).toBe("+49-22-028689605");
  });

  it("should convert 00 prefix to + prefix", () => {
    expect(formatPhoneNumber("0049-22-028689605")).toBe("+49-22-028689605");
    expect(formatPhoneNumber("00972-3-123-4567")).toBe("+972-3-123-4567");
  });

  it("should add + prefix to German numbers (49)", () => {
    expect(formatPhoneNumber("4922028689605")).toBe("+4922028689605");
    expect(formatPhoneNumber("49-220-28689605")).toBe("+49-220-28689605");
  });

  it("should add + prefix to Israeli numbers (972)", () => {
    expect(formatPhoneNumber("972-3-123-4567")).toBe("+972-3-123-4567");
    expect(formatPhoneNumber("97231234567")).toBe("+97231234567");
  });

  it("should add + prefix to US numbers (1)", () => {
    expect(formatPhoneNumber("1-555-123-4567")).toBe("+1-555-123-4567");
    expect(formatPhoneNumber("15551234567")).toBe("+15551234567");
  });

  it("should add + prefix to UK numbers (44)", () => {
    expect(formatPhoneNumber("44-20-1234-5678")).toBe("+44-20-1234-5678");
  });

  it("should not add + to short local numbers", () => {
    // Short numbers that don't look international
    // Note: Numbers starting with 1 may be treated as US numbers if long enough
    expect(formatPhoneNumber("555-4567")).toBe("555-4567");
    expect(formatPhoneNumber("12345")).toBe("12345"); // Too short
  });
});

describe("Address Validation for Navigation", () => {
  it("should accept addresses with street numbers", () => {
    expect(isValidAddress("32 Raiffeisenstrasse, Munich, Germany, 85356")).toBe(true);
    expect(isValidAddress("123 Main Street")).toBe(true);
    expect(isValidAddress("1 Airport Road")).toBe(true);
  });

  it("should accept addresses with address keywords", () => {
    expect(isValidAddress("Munich Airport")).toBe(true);
    expect(isValidAddress("Terminal 3")).toBe(true);
    expect(isValidAddress("Grand Plaza Hotel")).toBe(true);
    expect(isValidAddress("Convention Center")).toBe(true);
  });

  it("should accept addresses with city/country separators", () => {
    expect(isValidAddress("Hilton Hotel, Munich, Germany")).toBe(true);
    expect(isValidAddress("Ben Gurion Airport, Tel Aviv, Israel")).toBe(true);
  });

  it("should reject vague location names without address indicators", () => {
    expect(isValidAddress("Munich")).toBe(false);
    expect(isValidAddress("Downtown")).toBe(false);
    expect(isValidAddress("City")).toBe(false);
  });

  it("should reject empty or undefined addresses", () => {
    expect(isValidAddress("")).toBe(false);
    expect(isValidAddress(undefined)).toBe(false);
  });
});

describe("Airport Code to Address Mapping", () => {
  it("should map common airport codes to navigable addresses", () => {
    expect(AIRPORT_ADDRESSES["JFK"]).toBe("John F. Kennedy International Airport, New York");
    expect(AIRPORT_ADDRESSES["TLV"]).toBe("Ben Gurion Airport, Tel Aviv, Israel");
    expect(AIRPORT_ADDRESSES["YYZ"]).toBe("Toronto Pearson International Airport");
    expect(AIRPORT_ADDRESSES["VRN"]).toBe("Verona Villafranca Airport, Italy");
  });

  it("should return undefined for unknown airport codes", () => {
    expect(AIRPORT_ADDRESSES["XXX"]).toBeUndefined();
    expect(AIRPORT_ADDRESSES["INVALID"]).toBeUndefined();
  });
});

describe("Navigation Icon Logic", () => {
  // Simulates the contactInfo.address extraction logic
  function getNavigableAddress(category: string, details: any): string | null {
    if (category === "accommodation") {
      if (isValidAddress(details.address)) {
        return details.address;
      }
    } else if (category === "carRental") {
      if (isValidAddress(details.pickupAddress)) {
        return details.pickupAddress;
      } else if (isValidAddress(details.dropoffAddress)) {
        return details.dropoffAddress;
      } else if (isValidAddress(details.pickupLocation)) {
        return details.pickupLocation;
      } else if (isValidAddress(details.dropoffLocation)) {
        return details.dropoffLocation;
      }
    } else if (category === "flight") {
      if (isValidAddress(details.arrivalAddress)) {
        return details.arrivalAddress;
      } else if (isValidAddress(details.departureAddress)) {
        return details.departureAddress;
      } else {
        const arrCode = details.arrivalAirport?.toUpperCase();
        const depCode = details.departureAirport?.toUpperCase();
        
        if (arrCode && AIRPORT_ADDRESSES[arrCode]) {
          let address = AIRPORT_ADDRESSES[arrCode];
          if (details.terminal) {
            address += `, Terminal ${details.terminal}`;
          }
          return address;
        } else if (depCode && AIRPORT_ADDRESSES[depCode]) {
          let address = AIRPORT_ADDRESSES[depCode];
          if (details.terminal) {
            address += `, Terminal ${details.terminal}`;
          }
          return address;
        }
      }
    }
    return null;
  }

  it("should enable navigation for car rental with valid address", () => {
    const details = {
      pickupLocation: "32 Raiffeisenstrasse, Munich, Germany, 85356",
    };
    expect(getNavigableAddress("carRental", details)).toBe("32 Raiffeisenstrasse, Munich, Germany, 85356");
  });

  it("should enable navigation for flight with known airport code", () => {
    const details = {
      departureAirport: "TLV",
      arrivalAirport: "VRN",
    };
    expect(getNavigableAddress("flight", details)).toBe("Verona Villafranca Airport, Italy");
  });

  it("should include terminal in flight navigation address", () => {
    const details = {
      departureAirport: "TLV",
      arrivalAirport: "JFK",
      terminal: "4",
    };
    expect(getNavigableAddress("flight", details)).toBe("John F. Kennedy International Airport, New York, Terminal 4");
  });

  it("should disable navigation for flight with unknown airport code", () => {
    const details = {
      departureAirport: "XXX",
      arrivalAirport: "YYY",
    };
    expect(getNavigableAddress("flight", details)).toBeNull();
  });

  it("should enable navigation for hotel with valid address", () => {
    const details = {
      address: "123 Hotel Street, Munich, Germany",
    };
    expect(getNavigableAddress("accommodation", details)).toBe("123 Hotel Street, Munich, Germany");
  });

  it("should disable navigation for hotel with vague location", () => {
    const details = {
      address: "Downtown Munich",
    };
    expect(getNavigableAddress("accommodation", details)).toBeNull();
  });
});
