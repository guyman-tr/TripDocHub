# TripDocHub Production Launch Checklist

**Last Updated:** January 30, 2026  
**Status:** Pre-Production

This checklist covers all steps required to safely launch TripDocHub to production on Google Play.

---

## Phase 1: Security Remediation (CRITICAL - Do First)

### 1.1 Rotate Firebase Admin SDK Key
**Why:** The private key was committed to the repository and is now compromised.

**Steps:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: `tripdochub`
3. Navigate to **IAM & Admin** → **Service Accounts**
4. Find: `firebase-adminsdk-fbsvc@tripdochub.iam.gserviceaccount.com`
5. Click on the service account → **Keys** tab
6. Find key ID: `871808a4087f30f4546d150dd5ca39231a44106e`
7. Click the trash icon to **DELETE** this key
8. Click **Add Key** → **Create new key** → **JSON**
9. Download the new key file (keep it secure, never commit to git)
10. If you use Firebase Admin SDK anywhere, update the credentials

**Verification:** Old key should show "Deleted" status in the console.

---

### 1.2 Purge Git History (Optional but Recommended)
**Why:** The leaked key still exists in git history and could be extracted.

**Option A: Use BFG Repo-Cleaner (Easier)**
```bash
# Install BFG
brew install bfg  # macOS
# or download from https://rtyley.github.io/bfg-repo-cleaner/

# Clone a fresh copy
git clone --mirror https://github.com/guyman-tr/TripDocHub.git

# Remove the file from history
bfg --delete-files 'tripdochub-firebase-adminsdk-*.json' TripDocHub.git

# Clean up
cd TripDocHub.git
git reflog expire --expire=now --all && git gc --prune=now --aggressive

# Force push
git push --force
```

**Option B: Use git filter-repo**
```bash
pip install git-filter-repo
git filter-repo --path tripdochub-firebase-adminsdk-fbsvc-871808a408.json --invert-paths
git push --force
```

**Note:** Force pushing rewrites history. Anyone with local clones will need to re-clone.

---

## Phase 2: Environment Configuration

### 2.1 Required Environment Variables for Production

Set these in your production environment (Manus Settings → Secrets):

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `JWT_SECRET` | ✅ Yes | Secret for signing auth tokens | `your-secure-random-string-64-chars` |
| `MAILGUN_WEBHOOK_SIGNING_KEY` | ✅ Yes | Mailgun webhook verification | From Mailgun dashboard |
| `CORS_ALLOWED_ORIGINS` | ✅ Yes | Comma-separated allowed origins | `https://your-app.com,https://api.your-app.com` |
| `ENABLE_DEBUG_ENDPOINTS` | ❌ No | Keep disabled in production | `false` (or unset) |
| `ALLOW_UNVERIFIED_PURCHASES` | ❌ No | Keep disabled until Google verification implemented | `false` (or unset) |

### 2.2 Get Mailgun Webhook Signing Key
1. Go to [Mailgun Dashboard](https://app.mailgun.com/)
2. Navigate to **Sending** → **Webhooks**
3. Find **Webhook signing key** (or create one)
4. Copy and set as `MAILGUN_WEBHOOK_SIGNING_KEY`

### 2.3 Configure CORS Origins
Add all domains that need to access your API:
```
CORS_ALLOWED_ORIGINS=https://8081-xxx.manus.computer,https://your-production-domain.com
```

---

## Phase 3: Google Play In-App Purchases

### 3.1 Create Products in Google Play Console

1. Go to [Google Play Console](https://play.google.com/console/)
2. Select your app: **TripDocHub**
3. Navigate to **Monetize** → **Products** → **In-app products**
4. Click **Create product** for each:

| Product ID | Name | Description | Price |
|------------|------|-------------|-------|
| `10_credits` | 10 Credits | Process 10 travel documents | $0.99 |
| `50_credits` | 50 Credits | Process 50 travel documents | $3.99 |
| `100_credits` | 100 Credits | Process 100 travel documents | $6.99 |

5. Set each product to **Active**

### 3.2 Implement Google Play Purchase Verification (Required for Real Purchases)

**Why:** Currently purchases are blocked in production because server-side verification isn't implemented.

**Steps to implement:**
1. Enable Google Play Android Developer API in Google Cloud Console
2. Create a service account with "View financial data" permission
3. Add the service account email to Google Play Console users
4. Implement server-side verification using the Android Publisher API

**Temporary workaround (NOT recommended for production):**
Set `ALLOW_UNVERIFIED_PURCHASES=true` to enable purchases without verification. This allows fraud.

---

## Phase 4: Final Pre-Launch Checks

### 4.1 Test Critical Flows
- [ ] User can sign in via OAuth
- [ ] Email forwarding creates documents (with credits deducted)
- [ ] Push notifications arrive on device
- [ ] Documents display correctly in trips
- [ ] Promo code redemption works

### 4.2 Verify Security Settings
- [ ] Debug endpoints return 404 (ENABLE_DEBUG_ENDPOINTS is not set)
- [ ] CORS blocks requests from unauthorized origins
- [ ] Mailgun webhook rejects unsigned requests
- [ ] Firebase Admin SDK key is rotated

### 4.3 App Store Listing
- [ ] Screenshots are up to date
- [ ] Description is accurate
- [ ] Privacy policy URL is valid
- [ ] App icon displays correctly

---

## Phase 5: Launch

### 5.1 Deploy to Production
1. In Manus, click **Publish** to deploy the latest checkpoint
2. Verify the production server is running
3. Test email forwarding with a real email

### 5.2 Google Play Release
1. In Google Play Console, go to **Release** → **Production**
2. Create a new release
3. Upload the signed APK/AAB
4. Complete the release notes
5. Submit for review

### 5.3 Post-Launch Monitoring
- Monitor error logs for the first 24-48 hours
- Check push notification delivery rates
- Monitor credit consumption patterns
- Watch for any security alerts

---

## Quick Reference: What's Currently Blocked

| Feature | Status | Reason | To Enable |
|---------|--------|--------|-----------|
| In-app purchases | ⛔ Blocked | No server-side verification | Implement Google Play API verification |
| Debug endpoints | ⛔ Hidden | Security hardening | Set `ENABLE_DEBUG_ENDPOINTS=true` (dev only) |
| Mailgun webhooks (prod) | ⛔ Blocked | No signing key | Set `MAILGUN_WEBHOOK_SIGNING_KEY` |

---

## Support Resources

- **Mailgun Webhooks:** https://documentation.mailgun.com/en/latest/user_manual.html#webhooks
- **Google Play Billing:** https://developer.android.com/google/play/billing
- **Android Publisher API:** https://developers.google.com/android-publisher
- **BFG Repo Cleaner:** https://rtyley.github.io/bfg-repo-cleaner/

---

**Checklist Version:** 1.0  
**Next Review:** After completing Phase 1 security remediation
