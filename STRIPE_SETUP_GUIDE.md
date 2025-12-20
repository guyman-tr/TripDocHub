# TripHub Stripe Setup Guide

This guide walks you through setting up Stripe payments for TripHub's credit system.

## Pricing Model

| Option | Price | What User Gets |
|--------|-------|----------------|
| Free Tier | $0 | 20 credits (one-time) |
| Credit Pack | $1 | 10 credits |
| Monthly Subscription | $2/month | Unlimited processing |

**1 credit = 1 document processed**

---

## Step 1: Create a Stripe Account

1. Go to **https://stripe.com**
2. Click **"Start now"** or **"Create account"**
3. Enter your email and create a password
4. Verify your email address
5. You'll land on the Stripe Dashboard

> **Note:** You can use Stripe in "Test Mode" first (no real money) to verify everything works, then switch to "Live Mode" when ready.

---

## Step 2: Get Your API Keys

1. In the Stripe Dashboard, look at the top-right corner
2. Make sure **"Test mode"** toggle is ON (orange badge visible)
3. Click **"Developers"** in the left sidebar
4. Click **"API keys"**
5. You'll see two keys:
   - **Publishable key**: starts with `pk_test_...`
   - **Secret key**: click "Reveal" - starts with `sk_test_...`

**Copy both keys** - you'll give me the Secret key to add to the app.

---

## Step 3: Create Your Products in Stripe

### Product 1: Credit Pack ($1 for 10 credits)

1. In Stripe Dashboard, click **"Products"** in the left sidebar
2. Click **"+ Add product"**
3. Fill in:
   - **Name:** `TripHub Credits - 10 Pack`
   - **Description:** `10 document processing credits for TripHub`
   - **Image:** (optional) upload your app icon
4. Under **Pricing**:
   - **Pricing model:** One time
   - **Price:** `$1.00`
   - **Currency:** USD
5. Click **"Save product"**
6. **Copy the Price ID** (starts with `price_...`) - you'll see it on the product page

### Product 2: Monthly Subscription ($2/month)

1. Click **"+ Add product"** again
2. Fill in:
   - **Name:** `TripHub Unlimited`
   - **Description:** `Unlimited document processing - monthly subscription`
3. Under **Pricing**:
   - **Pricing model:** Recurring
   - **Price:** `$2.00`
   - **Billing period:** Monthly
5. Click **"Save product"**
6. **Copy the Price ID** (starts with `price_...`)

---

## Step 4: Set Up Webhook Endpoint

Webhooks let Stripe notify TripHub when a payment succeeds.

1. In Stripe Dashboard, go to **"Developers"** → **"Webhooks"**
2. Click **"+ Add endpoint"**
3. For the endpoint URL, enter:
   ```
   https://YOUR_PRODUCTION_URL/api/webhooks/stripe
   ```
   > **Note:** We'll update this URL after you publish the app on Manus. For now, you can skip this step or use the development URL.

4. Under **"Select events to listen to"**, click **"+ Select events"**
5. Search and select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.deleted`
   - `invoice.paid`
6. Click **"Add endpoint"**
7. **Copy the Webhook Signing Secret** (starts with `whsec_...`)

---

## Step 5: Give Me the Keys

Once you have these 3 values, share them with me:

1. **STRIPE_SECRET_KEY** - `sk_test_...` (Secret key)
2. **STRIPE_PRICE_CREDITS** - `price_...` (Price ID for 10-credit pack)
3. **STRIPE_PRICE_SUBSCRIPTION** - `price_...` (Price ID for monthly subscription)
4. **STRIPE_WEBHOOK_SECRET** - `whsec_...` (Webhook signing secret)

I'll securely add these to your app's environment.

---

## Step 6: Complete Your Stripe Account (Before Going Live)

Before accepting real payments, Stripe requires:

1. **Business Information**
   - Go to **Settings** → **Business settings** → **Account details**
   - Add your business name (can be your name if individual)
   - Add your address

2. **Bank Account for Payouts**
   - Go to **Settings** → **Payouts**
   - Add your bank account to receive money

3. **Tax Settings** (if applicable)
   - Go to **Settings** → **Tax**
   - Configure based on your location

4. **Switch to Live Mode**
   - Toggle off "Test mode" in the top-right
   - Get your live API keys (`sk_live_...`, `pk_live_...`)
   - Create the same products in Live mode
   - Update the webhook with live endpoint

---

## Testing Payments (Test Mode)

While in Test Mode, use these test card numbers:

| Card Number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Card declined |
| `4000 0000 0000 9995` | Insufficient funds |

Use any future expiry date (e.g., 12/34) and any 3-digit CVC.

---

## Summary Checklist

- [ ] Created Stripe account
- [ ] Got API keys (test mode)
- [ ] Created "TripHub Credits - 10 Pack" product ($1)
- [ ] Created "TripHub Unlimited" subscription ($2/month)
- [ ] Set up webhook endpoint
- [ ] Shared keys with Manus

---

## Questions?

If you get stuck on any step, just let me know and I'll help you through it!
