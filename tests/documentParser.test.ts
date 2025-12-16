import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM module
vi.mock("../server/_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

// Mock the storage module
vi.mock("../server/storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://example.com/test.pdf" }),
}));

import { parseDocument } from "../server/documentParser";
import { invokeLLM } from "../server/_core/llm";

describe("Document Parser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse a flight document correctly", async () => {
    const mockLLMResponse = {
      id: "test-id",
      created: Date.now(),
      model: "gemini-2.5-flash",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant" as const,
            content: JSON.stringify({
              documents: [
                {
                  category: "flight",
                  documentType: "eTicket",
                  title: "TLV → BUD",
                  subtitle: "Wizz Air",
                  documentDate: "2025-08-15T10:00:00Z",
                  details: {
                    confirmationNumber: "ABC123",
                    airline: "Wizz Air",
                    flightNumber: "W6 1234",
                    departureAirport: "TLV",
                    arrivalAirport: "BUD",
                    departureTime: "10:00",
                    arrivalTime: "12:30",
                  },
                },
              ],
            }),
          },
          finish_reason: "stop",
        },
      ],
    };

    vi.mocked(invokeLLM).mockResolvedValue(mockLLMResponse);

    const result = await parseDocument(
      "https://example.com/flight-ticket.pdf",
      "application/pdf"
    );

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].category).toBe("flight");
    expect(result.documents[0].documentType).toBe("eTicket");
    expect(result.documents[0].title).toBe("TLV → BUD");
    expect(result.documents[0].details.airline).toBe("Wizz Air");
    expect(result.contentHash).toBeDefined();
    expect(result.contentHash.length).toBe(64);
  });

  it("should parse a hotel booking correctly", async () => {
    const mockLLMResponse = {
      id: "test-id",
      created: Date.now(),
      model: "gemini-2.5-flash",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant" as const,
            content: JSON.stringify({
              documents: [
                {
                  category: "accommodation",
                  documentType: "Booking Confirmation",
                  title: "Grand Budapest Hotel",
                  subtitle: "Booking.com",
                  documentDate: "2025-08-15",
                  details: {
                    confirmationNumber: "HOTEL456",
                    hotelName: "Grand Budapest Hotel",
                    checkInDate: "2025-08-15",
                    checkOutDate: "2025-08-20",
                    roomType: "Deluxe Suite",
                    address: "123 Main St, Budapest",
                  },
                },
              ],
            }),
          },
          finish_reason: "stop",
        },
      ],
    };

    vi.mocked(invokeLLM).mockResolvedValue(mockLLMResponse);

    const result = await parseDocument(
      "https://example.com/hotel-booking.png",
      "image/png"
    );

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].category).toBe("accommodation");
    expect(result.documents[0].documentType).toBe("Booking Confirmation");
    expect(result.documents[0].details.hotelName).toBe("Grand Budapest Hotel");
  });

  it("should handle multiple documents in one file", async () => {
    const mockLLMResponse = {
      id: "test-id",
      created: Date.now(),
      model: "gemini-2.5-flash",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant" as const,
            content: JSON.stringify({
              documents: [
                {
                  category: "flight",
                  documentType: "eTicket",
                  title: "TLV → BUD",
                  subtitle: "Outbound",
                  details: {},
                },
                {
                  category: "flight",
                  documentType: "eTicket",
                  title: "BUD → TLV",
                  subtitle: "Return",
                  details: {},
                },
              ],
            }),
          },
          finish_reason: "stop",
        },
      ],
    };

    vi.mocked(invokeLLM).mockResolvedValue(mockLLMResponse);

    const result = await parseDocument(
      "https://example.com/round-trip.pdf",
      "application/pdf"
    );

    expect(result.documents).toHaveLength(2);
    expect(result.documents[0].title).toBe("TLV → BUD");
    expect(result.documents[1].title).toBe("BUD → TLV");
  });

  it("should handle LLM errors gracefully", async () => {
    vi.mocked(invokeLLM).mockRejectedValue(new Error("LLM API error"));

    const result = await parseDocument(
      "https://example.com/document.pdf",
      "application/pdf"
    );

    // Should return a fallback document
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].category).toBe("other");
    expect(result.documents[0].title).toBe("Uploaded Document");
  });

  it("should validate and normalize category values", async () => {
    const mockLLMResponse = {
      id: "test-id",
      created: Date.now(),
      model: "gemini-2.5-flash",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant" as const,
            content: JSON.stringify({
              documents: [
                {
                  category: "invalid_category",
                  documentType: "Document",
                  title: "Test",
                  details: {},
                },
              ],
            }),
          },
          finish_reason: "stop",
        },
      ],
    };

    vi.mocked(invokeLLM).mockResolvedValue(mockLLMResponse);

    const result = await parseDocument(
      "https://example.com/document.pdf",
      "application/pdf"
    );

    // Invalid category should be normalized to "other"
    expect(result.documents[0].category).toBe("other");
  });

  it("should handle array content in LLM response", async () => {
    const mockLLMResponse = {
      id: "test-id",
      created: Date.now(),
      model: "gemini-2.5-flash",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant" as const,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  documents: [
                    {
                      category: "event",
                      documentType: "Event Ticket",
                      title: "Concert",
                      details: {},
                    },
                  ],
                }),
              },
            ],
          },
          finish_reason: "stop",
        },
      ],
    };

    vi.mocked(invokeLLM).mockResolvedValue(mockLLMResponse);

    const result = await parseDocument(
      "https://example.com/ticket.png",
      "image/png"
    );

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].category).toBe("event");
  });
});
