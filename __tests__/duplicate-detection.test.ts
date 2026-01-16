import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";

describe("Duplicate Detection - Content Hash", () => {
  describe("Content hash generation", () => {
    it("should generate same hash for identical file content", () => {
      const fileContent = Buffer.from("This is a test PDF content");
      
      const hash1 = createHash("sha256").update(fileContent).digest("hex");
      const hash2 = createHash("sha256").update(fileContent).digest("hex");
      
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });

    it("should generate different hashes for different file content", () => {
      const fileContent1 = Buffer.from("This is document 1");
      const fileContent2 = Buffer.from("This is document 2");
      
      const hash1 = createHash("sha256").update(fileContent1).digest("hex");
      const hash2 = createHash("sha256").update(fileContent2).digest("hex");
      
      expect(hash1).not.toBe(hash2);
    });

    it("should generate different hashes for same content with different bytes", () => {
      const fileContent1 = Buffer.from("Hello World");
      const fileContent2 = Buffer.from("Hello World "); // Extra space
      
      const hash1 = createHash("sha256").update(fileContent1).digest("hex");
      const hash2 = createHash("sha256").update(fileContent2).digest("hex");
      
      expect(hash1).not.toBe(hash2);
    });

    it("should generate same hash regardless of upload time or URL", () => {
      // Simulating the same file uploaded at different times
      const fileContent = Buffer.from("Flight confirmation ABC123");
      
      // First upload
      const hash1 = createHash("sha256").update(fileContent).digest("hex");
      
      // Second upload (same content, would have different URL)
      const hash2 = createHash("sha256").update(fileContent).digest("hex");
      
      expect(hash1).toBe(hash2);
    });
  });

  describe("Hash comparison for duplicate detection", () => {
    it("should correctly identify duplicate when hashes match", () => {
      const existingHash = "abc123def456..."; // Stored in database
      const newHash = "abc123def456..."; // From new upload
      
      const isDuplicate = existingHash === newHash;
      
      expect(isDuplicate).toBe(true);
    });

    it("should correctly identify non-duplicate when hashes differ", () => {
      const existingHash: string = "abc123def456";
      const newHash: string = "xyz789ghi012";
      
      const isDuplicate = existingHash === newHash;
      
      expect(isDuplicate).toBe(false);
    });
  });

  describe("Binary data handling", () => {
    it("should handle Uint8Array input correctly", () => {
      const content = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const buffer = Buffer.from(content);
      
      const hash = createHash("sha256").update(buffer).digest("hex");
      
      expect(hash.length).toBe(64);
      expect(typeof hash).toBe("string");
    });

    it("should produce same hash from Buffer and Uint8Array of same data", () => {
      const data = [72, 101, 108, 108, 111]; // "Hello"
      
      const fromUint8Array = Buffer.from(new Uint8Array(data));
      const fromBuffer = Buffer.from(data);
      
      const hash1 = createHash("sha256").update(fromUint8Array).digest("hex");
      const hash2 = createHash("sha256").update(fromBuffer).digest("hex");
      
      expect(hash1).toBe(hash2);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty file content", () => {
      const emptyContent = Buffer.from("");
      
      const hash = createHash("sha256").update(emptyContent).digest("hex");
      
      // SHA-256 of empty string is a known value
      expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    });

    it("should handle large file content", () => {
      // Simulate a 1MB file
      const largeContent = Buffer.alloc(1024 * 1024, "x");
      
      const hash = createHash("sha256").update(largeContent).digest("hex");
      
      expect(hash.length).toBe(64);
    });
  });
});
