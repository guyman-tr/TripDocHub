import { Platform } from "react-native";

// Product IDs - these must match what you create in Google Play Console
export const PRODUCT_IDS = {
  CREDITS_10: "10_credits",
  CREDITS_50: "50_credits",
  CREDITS_100: "100_credits",
} as const;

export type ProductId = (typeof PRODUCT_IDS)[keyof typeof PRODUCT_IDS];

// Credit amounts for each product
export const CREDIT_AMOUNTS: Record<ProductId, number> = {
  [PRODUCT_IDS.CREDITS_10]: 10,
  [PRODUCT_IDS.CREDITS_50]: 50,
  [PRODUCT_IDS.CREDITS_100]: 100,
};

// Product display info
export interface Product {
  productId: ProductId;
  title: string;
  description: string;
  credits: number;
  price: string;
  priceAmountMicros?: number;
  currencyCode?: string;
}

// Purchase result interface
export interface PurchaseResult {
  productId: string;
  purchaseToken?: string;
  transactionId?: string;
}

let isInitialized = false;
let purchaseUpdateSubscription: any = null;
let purchaseErrorSubscription: any = null;

// Mock products for web preview
const MOCK_PRODUCTS: Product[] = [
  {
    productId: PRODUCT_IDS.CREDITS_10,
    title: "10 Credits",
    description: "Process 10 documents",
    credits: 10,
    price: "$0.99",
  },
  {
    productId: PRODUCT_IDS.CREDITS_50,
    title: "50 Credits",
    description: "Process 50 documents",
    credits: 50,
    price: "$3.99",
  },
  {
    productId: PRODUCT_IDS.CREDITS_100,
    title: "100 Credits",
    description: "Process 100 documents",
    credits: 100,
    price: "$6.99",
  },
];

/**
 * Initialize the billing system
 */
export async function initializeBilling(): Promise<boolean> {
  if (Platform.OS === "web") {
    console.log("[Billing] Web platform - billing not available");
    return false;
  }

  if (isInitialized) {
    return true;
  }

  try {
    const RNIap = require("react-native-iap");
    await RNIap.initConnection();
    isInitialized = true;
    console.log("[Billing] Connected to billing service");
    return true;
  } catch (error) {
    console.error("[Billing] Failed to connect:", error);
    return false;
  }
}

/**
 * Disconnect from billing service
 */
export async function disconnectBilling(): Promise<void> {
  if (Platform.OS === "web" || !isInitialized) return;

  try {
    const RNIap = require("react-native-iap");
    await RNIap.endConnection();
    isInitialized = false;
    
    // Remove listeners
    if (purchaseUpdateSubscription) {
      purchaseUpdateSubscription.remove();
      purchaseUpdateSubscription = null;
    }
    if (purchaseErrorSubscription) {
      purchaseErrorSubscription.remove();
      purchaseErrorSubscription = null;
    }
    
    console.log("[Billing] Disconnected from billing service");
  } catch (error) {
    console.error("[Billing] Failed to disconnect:", error);
  }
}

/**
 * Get available products from Google Play
 */
export async function getProducts(): Promise<Product[]> {
  if (Platform.OS === "web") {
    // Return mock products for web preview
    return MOCK_PRODUCTS;
  }

  if (!isInitialized) {
    const connected = await initializeBilling();
    if (!connected) return MOCK_PRODUCTS; // Return mock products if connection fails
  }

  try {
    const RNIap = require("react-native-iap");
    const products = await RNIap.getProducts({
      skus: Object.values(PRODUCT_IDS),
    });

    if (!products || products.length === 0) {
      console.log("[Billing] No products found, returning mock products");
      return MOCK_PRODUCTS;
    }

    return products.map((item: any) => ({
      productId: item.productId as ProductId,
      title: item.title || item.name || `${CREDIT_AMOUNTS[item.productId as ProductId]} Credits`,
      description: item.description || `Process ${CREDIT_AMOUNTS[item.productId as ProductId]} documents`,
      credits: CREDIT_AMOUNTS[item.productId as ProductId] || 0,
      price: item.localizedPrice || item.price || "N/A",
      priceAmountMicros: item.priceAmountMicros,
      currencyCode: item.currency,
    }));
  } catch (error) {
    console.error("[Billing] Failed to get products:", error);
    return MOCK_PRODUCTS;
  }
}

/**
 * Purchase a product
 */
export async function purchaseProduct(
  productId: ProductId
): Promise<{ success: boolean; purchaseToken?: string; error?: string }> {
  if (Platform.OS === "web") {
    return { success: false, error: "Purchases not available on web" };
  }

  if (!isInitialized) {
    const connected = await initializeBilling();
    if (!connected) {
      return { success: false, error: "Failed to connect to billing service" };
    }
  }

  try {
    const RNIap = require("react-native-iap");
    
    // v14+ API requires platform-specific request format
    // For Android, skus must be in the request object
    // For iOS, sku (singular) is used
    const purchaseRequest = Platform.OS === 'android'
      ? { skus: [productId] }
      : { sku: productId };
    
    await RNIap.requestPurchase({
      request: purchaseRequest,
      type: 'inapp',
    });
    
    // The purchase result will come through the purchase listener
    // Return success here - the actual verification happens in the listener
    return { success: true };
  } catch (error: any) {
    console.error("[Billing] Purchase failed:", error);
    
    // Handle user cancellation
    if (error.code === "E_USER_CANCELLED" || error.message?.includes("cancelled")) {
      return { success: false, error: "Purchase cancelled" };
    }
    
    return { success: false, error: error.message || "Purchase failed" };
  }
}

/**
 * Set up purchase update listener
 */
export function setPurchaseListener(
  onPurchase: (purchase: PurchaseResult) => void
): () => void {
  if (Platform.OS === "web") {
    return () => {};
  }

  try {
    const RNIap = require("react-native-iap");
    
    // Listen for successful purchases
    purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(
      async (purchase: any) => {
        console.log("[Billing] Purchase update:", purchase.productId);
        
        const receipt = purchase.transactionReceipt || purchase.purchaseToken;
        if (receipt) {
          onPurchase({
            productId: purchase.productId,
            purchaseToken: purchase.purchaseToken,
            transactionId: purchase.transactionId,
          });
        }
      }
    );

    // Listen for purchase errors
    purchaseErrorSubscription = RNIap.purchaseErrorListener((error: any) => {
      console.error("[Billing] Purchase error:", error);
    });
  } catch (error) {
    console.error("[Billing] Failed to set purchase listener:", error);
  }

  return () => {
    if (purchaseUpdateSubscription) {
      purchaseUpdateSubscription.remove();
      purchaseUpdateSubscription = null;
    }
    if (purchaseErrorSubscription) {
      purchaseErrorSubscription.remove();
      purchaseErrorSubscription = null;
    }
  };
}

/**
 * Acknowledge/finish a purchase (required after successful verification)
 */
export async function acknowledgePurchase(purchaseToken: string): Promise<boolean> {
  if (Platform.OS === "web") return false;

  try {
    const RNIap = require("react-native-iap");
    
    // For Android, acknowledge the purchase
    if (Platform.OS === "android") {
      await RNIap.acknowledgePurchaseAndroid({ token: purchaseToken });
    }
    
    // Finish the transaction
    await RNIap.finishTransaction({ purchaseToken } as any, false);
    
    console.log("[Billing] Purchase acknowledged");
    return true;
  } catch (error) {
    console.error("[Billing] Failed to acknowledge purchase:", error);
    return false;
  }
}

/**
 * Get available purchases (for restoring)
 */
export async function getAvailablePurchases(): Promise<PurchaseResult[]> {
  if (Platform.OS === "web") return [];

  if (!isInitialized) {
    const connected = await initializeBilling();
    if (!connected) return [];
  }

  try {
    const RNIap = require("react-native-iap");
    const purchases = await RNIap.getAvailablePurchases();
    
    return purchases.map((p: any) => ({
      productId: p.productId,
      purchaseToken: p.purchaseToken,
      transactionId: p.transactionId,
    }));
  } catch (error) {
    console.error("[Billing] Failed to get available purchases:", error);
    return [];
  }
}
