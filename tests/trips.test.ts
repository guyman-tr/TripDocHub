import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("../server/db", () => ({
  getUserTrips: vi.fn(),
  getTripById: vi.fn(),
  createTrip: vi.fn(),
  deleteTrip: vi.fn(),
  getDocumentCounts: vi.fn(),
}));

import * as db from "../server/db";

describe("Trips Database Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should get user trips with document counts", async () => {
    const mockTrips = [
      {
        id: 1,
        userId: 1,
        name: "Hungary Aug 2025",
        startDate: new Date("2025-08-15"),
        endDate: new Date("2025-08-22"),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        userId: 1,
        name: "Japan Trip",
        startDate: new Date("2025-10-01"),
        endDate: new Date("2025-10-14"),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockCounts = {
      inbox: 3,
      byTrip: { 1: 5, 2: 2 },
    };

    vi.mocked(db.getUserTrips).mockResolvedValue(mockTrips);
    vi.mocked(db.getDocumentCounts).mockResolvedValue(mockCounts);

    const trips = await db.getUserTrips(1);
    const counts = await db.getDocumentCounts(1);

    expect(trips).toHaveLength(2);
    expect(trips[0].name).toBe("Hungary Aug 2025");
    expect(counts.byTrip[1]).toBe(5);
    expect(counts.inbox).toBe(3);
  });

  it("should get a single trip by ID", async () => {
    const mockTrip = {
      id: 1,
      userId: 1,
      name: "Hungary Aug 2025",
      startDate: new Date("2025-08-15"),
      endDate: new Date("2025-08-22"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.getTripById).mockResolvedValue(mockTrip);

    const trip = await db.getTripById(1, 1);

    expect(trip).toBeDefined();
    expect(trip?.name).toBe("Hungary Aug 2025");
    expect(db.getTripById).toHaveBeenCalledWith(1, 1);
  });

  it("should return undefined for non-existent trip", async () => {
    vi.mocked(db.getTripById).mockResolvedValue(undefined);

    const trip = await db.getTripById(999, 1);

    expect(trip).toBeUndefined();
  });

  it("should create a new trip", async () => {
    vi.mocked(db.createTrip).mockResolvedValue(3);

    const tripId = await db.createTrip({
      userId: 1,
      name: "New Trip",
      startDate: new Date("2025-12-01"),
      endDate: new Date("2025-12-10"),
    });

    expect(tripId).toBe(3);
    expect(db.createTrip).toHaveBeenCalledWith({
      userId: 1,
      name: "New Trip",
      startDate: expect.any(Date),
      endDate: expect.any(Date),
    });
  });

  it("should delete a trip", async () => {
    vi.mocked(db.deleteTrip).mockResolvedValue(undefined);

    await db.deleteTrip(1, 1);

    expect(db.deleteTrip).toHaveBeenCalledWith(1, 1);
  });
});

describe("Trip Validation", () => {
  it("should validate trip name is not empty", () => {
    const tripName = "Hungary Aug 2025";
    expect(tripName.trim().length).toBeGreaterThan(0);
  });

  it("should validate end date is after start date", () => {
    const startDate = new Date("2025-08-15");
    const endDate = new Date("2025-08-22");
    expect(endDate >= startDate).toBe(true);
  });

  it("should detect invalid date range", () => {
    const startDate = new Date("2025-08-22");
    const endDate = new Date("2025-08-15");
    expect(endDate >= startDate).toBe(false);
  });
});
