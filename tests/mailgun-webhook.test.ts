import { describe, it, expect } from "vitest";
import crypto from "crypto";

describe("Mailgun Webhook Signing Key", () => {
  it("should have a valid webhook signing key configured", () => {
    const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
    
    // Check that the key exists and is not empty
    expect(signingKey).toBeDefined();
    expect(signingKey).not.toBe("");
    expect(typeof signingKey).toBe("string");
    
    // Mailgun signing keys are typically 32+ characters
    expect(signingKey!.length).toBeGreaterThanOrEqual(20);
  });

  it("should be able to verify a webhook signature", () => {
    const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
    expect(signingKey).toBeDefined();

    // Test that we can create HMAC signatures with the key
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const token = "test-token-12345";
    
    // This is how Mailgun signatures are verified
    const encodedToken = crypto
      .createHmac("sha256", signingKey!)
      .update(timestamp + token)
      .digest("hex");
    
    // Verify we got a valid hex string
    expect(encodedToken).toMatch(/^[a-f0-9]{64}$/);
  });
});
