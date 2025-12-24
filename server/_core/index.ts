import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import multer from "multer";
import cookieParser from "cookie-parser";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import mailgunWebhook from "../webhooks/mailgun";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import { COOKIE_NAME } from "../../shared/const";
import { sdk } from "./sdk";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
});

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(cookieParser());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Public Privacy Policy page for Google Play Store
  app.get("/privacy", (_req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - TripHub</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333; }
    h1 { color: #007AFF; }
    h2 { color: #555; margin-top: 30px; }
    .updated { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="updated">Last updated: December 24, 2024</p>
  
  <p>TripHub ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile application.</p>

  <h2>Information We Collect</h2>
  <p><strong>Account Information:</strong> When you sign in, we collect your name and email address through our authentication provider.</p>
  <p><strong>Travel Documents:</strong> Documents you upload or forward to your TripHub email address, including PDFs and images of booking confirmations, tickets, and reservations.</p>
  <p><strong>Trip Information:</strong> Trip names, dates, and destinations you create within the app.</p>
  <p><strong>Usage Data:</strong> Information about how you interact with the app to improve our services.</p>

  <h2>How We Use Your Information</h2>
  <p>We use your information to:</p>
  <ul>
    <li>Process and parse your travel documents using AI to extract booking details</li>
    <li>Organize your documents into trips automatically based on dates</li>
    <li>Store your documents securely so you can access them anytime</li>
    <li>Provide customer support and respond to your inquiries</li>
  </ul>

  <h2>Third-Party Services</h2>
  <p>We use the following third-party services:</p>
  <ul>
    <li><strong>Authentication Providers:</strong> For secure sign-in (Google, Microsoft, Apple)</li>
    <li><strong>Mailgun:</strong> To receive emails forwarded to your unique TripHub email address</li>
    <li><strong>OpenAI:</strong> To parse and extract information from your travel documents</li>
    <li><strong>Cloud Storage:</strong> To securely store your uploaded documents</li>
  </ul>

  <h2>Data Security</h2>
  <p>We implement appropriate security measures to protect your personal information, including encrypted connections (HTTPS) and secure cloud storage.</p>

  <h2>Your Rights</h2>
  <p>You have the right to:</p>
  <ul>
    <li>Access your personal data stored in the app</li>
    <li>Delete your account and all associated data</li>
    <li>Export your documents</li>
    <li>Opt out of email forwarding by not using the feature</li>
  </ul>

  <h2>Data Retention</h2>
  <p>We retain your data for as long as your account is active. When you delete your account, all your personal data, trips, and documents are permanently removed from our systems.</p>

  <h2>Children's Privacy</h2>
  <p>TripHub is not intended for children under 13. We do not knowingly collect personal information from children under 13.</p>

  <h2>Changes to This Policy</h2>
  <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.</p>

  <h2>Contact Us</h2>
  <p>If you have questions about this Privacy Policy, please contact us at:</p>
  <p>Email: <a href="mailto:privacy@in.mytripdochub.com">privacy@in.mytripdochub.com</a></p>
</body>
</html>
    `);
  });

  // Public Terms of Service page for Google Play Store
  app.get("/terms", (_req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service - TripHub</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333; }
    h1 { color: #007AFF; }
    h2 { color: #555; margin-top: 30px; }
    .updated { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <h1>Terms of Service</h1>
  <p class="updated">Last updated: December 24, 2024</p>
  
  <p>Welcome to TripHub. By using our mobile application, you agree to these Terms of Service.</p>

  <h2>1. Acceptance of Terms</h2>
  <p>By accessing or using TripHub, you agree to be bound by these Terms. If you do not agree, please do not use the app.</p>

  <h2>2. Description of Service</h2>
  <p>TripHub is a travel document organizer that helps you store, parse, and organize your travel bookings and confirmations. The service includes document upload, email forwarding, AI-powered parsing, and trip organization features.</p>

  <h2>3. User Accounts</h2>
  <p>You must create an account to use TripHub. You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account.</p>

  <h2>4. Acceptable Use</h2>
  <p>You agree not to:</p>
  <ul>
    <li>Use the service for any illegal purpose</li>
    <li>Upload malicious files or content</li>
    <li>Attempt to gain unauthorized access to our systems</li>
    <li>Use the service to store non-travel-related documents at scale</li>
    <li>Resell or redistribute the service without permission</li>
  </ul>

  <h2>5. Credits and Payments</h2>
  <p>TripHub uses a credit system for document processing. New users receive free credits. Additional credits or unlimited subscriptions may be purchased through the app. All purchases are processed through Google Play and are subject to Google's payment terms.</p>

  <h2>6. Intellectual Property</h2>
  <p>The TripHub app, including its design, features, and content, is owned by us and protected by intellectual property laws. Your uploaded documents remain your property.</p>

  <h2>7. Disclaimer of Warranties</h2>
  <p>TripHub is provided "as is" without warranties of any kind. We do not guarantee that the AI parsing will be 100% accurate. Always verify important booking details with the original documents.</p>

  <h2>8. Limitation of Liability</h2>
  <p>We shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of TripHub, including missed flights or bookings due to parsing errors.</p>

  <h2>9. Termination</h2>
  <p>We may terminate or suspend your account at any time for violations of these Terms. You may delete your account at any time through the app.</p>

  <h2>10. Changes to Terms</h2>
  <p>We may modify these Terms at any time. Continued use of the app after changes constitutes acceptance of the new Terms.</p>

  <h2>11. Contact</h2>
  <p>For questions about these Terms, contact us at:</p>
  <p>Email: <a href="mailto:privacy@in.mytripdochub.com">privacy@in.mytripdochub.com</a></p>
</body>
</html>
    `);
  });

  // File upload endpoint
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      // Check authentication using the SDK
      // Support both cookie-based auth (web) and Bearer token auth (mobile)
      let session = null;
      
      // First try Bearer token from Authorization header (mobile)
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        session = await sdk.verifySession(token);
      }
      
      // Fall back to cookie-based auth (web)
      if (!session) {
        const sessionCookie = req.cookies[COOKIE_NAME];
        if (sessionCookie) {
          session = await sdk.verifySession(sessionCookie);
        }
      }
      
      if (!session) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // Get the user from the database
      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "Database not available" });
        return;
      }

      const [user] = await db.select().from(users).where(eq(users.openId, session.openId)).limit(1);
      if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }

      // Generate a unique file key
      const ext = file.originalname.split(".").pop() || "bin";
      const fileKey = `documents/${user.id}/${nanoid()}.${ext}`;

      // Upload to S3
      const result = await storagePut(fileKey, file.buffer, file.mimetype);

      res.json({ url: result.url, key: result.key });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: error.message || "Upload failed" });
    }
  });

  // Mailgun webhook for email forwarding
  app.use("/api/webhooks/mailgun", mailgunWebhook);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
