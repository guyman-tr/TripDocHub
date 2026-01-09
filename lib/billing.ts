import * as InAppPurchases from "expo-in-app-purchases";
import { Platform } from "react-native";

// Product IDs - these must match what you create in Google Play Console
export const PRODUCT_IDS = {
  CREDITS_10: "credits_10",
  CREDITS_50: "credits_50",
  CREDITS_100: "credits_100",
} as const;

export type ProductId = (typeof PRODUCT_IDS)[keyof typeof PRODUCT_IDS];

// Credit amounts for each product
export const CREDIT_AMOUNTS: Record<ProductId, number> = {
  [PRODUCT_IDS.CREDITS_10]: 10,
  [PRODUCT_IDS.CREDITS_50]: 50,
  [PRODUCT_IDS.CREDITS_100]: 100,
};

// Product display info (prices will be fetched from Google Play)
export interface Product {
  productId: ProductId;
  title: string;
  description: string;
  credits: number;
  price: string;
  priceAmountMicros?: number;
  currencyCode?: string;
}

let isConnected = false;
let purchaseListener: InAppPurchases.IAPItemDetails[] | null = null;

/**
 * Initialize the billing system
 */
export async function initializeBilling(): Promise<boolean> {
  if (Platform.OS === "web") {
    console.log("[Billing] Web platform - billing not available");
    return false;
  }

  try {
    await InAppPurchases.connectAsync();
    isConnected = true;
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
  if (!isConnected) return;

  try {
    await InAppPurchases.disconnectAsync();
    isConnected = false;
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
    return [
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
  }

  if (!isConnected) {
    const connected = await initializeBilling();
    if (!connected) return [];
  }

  try {
    const { results } = await InAppPurchases.getProductsAsync(
      Object.values(PRODUCT_IDS)
    );

    return (results ?? []).map((item) => ({
      productId: item.productId as ProductId,
      title: item.title,
      description: item.description,
      credits: CREDIT_AMOUNTS[item.productId as ProductId] || 0,
      price: item.price,
      priceAmountMicros: item.priceAmountMicros,
      currencyCode: item.priceCurrencyCode,
    }));
  } catch (error) {
    console.error("[Billing] Failed to get products:", error);
    return [];
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

  if (!isConnected) {
    const connected = await initializeBilling();
    if (!connected) {
      return { success: false, error: "Failed to connect to billing service" };
    }
  }

  try {
    await InAppPurchases.purchaseItemAsync(productId);
    
    // The purchase result will come through the purchase listener
    // Return success here - the actual verification happens in the listener
    return { success: true };
  } catch (error: any) {
    console.error("[Billing] Purchase failed:", error);
    
    if (error.code === "E_USER_CANCELLED") {
      return { success: false, error: "Purchase cancelled" };
    }
    
    return { success: false, error: error.message || "Purchase failed" };
  }
}

/**
 * Set up purchase update listener
 */
export function setPurchaseListener(
  onPurchase: (purchase: InAppPurchases.InAppPurchase) => void
): () => void {
  if (Platform.OS === "web") {
    return () => {};
  }

  const subscription = InAppPurchases.setPurchaseListener(({ responseCode, results }) => {
    if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
      for (const purchase of results ?? []) {
        if (!purchase.acknowledged) {
          onPurchase(purchase);
        }
      }
    }
  });

  return () => {
    // Cleanup if needed
  };
}

/**
 * Acknowledge a purchase (required after successful verification)
 */
export async function acknowledgePurchase(purchaseToken: string): Promise<boolean> {
  if (Platform.OS === "web") return false;

  try {
    await InAppPurchases.finishTransactionAsync(
      { purchaseToken } as InAppPurchases.InAppPurchase,
      true
    );
    console.log("[Billing] Purchase acknowledged");
    return true;
  } catch (error) {
    console.error("[Billing] Failed to acknowledge purchase:", error);
    return false;
  }
}

/**
 * Get pending purchases (for restoring)
 */
export async function getPendingPurchases(): Promise<InAppPurchases.InAppPurchase[]> {
  if (Platform.OS === "web") return [];

  if (!isConnected) {
    const connected = await initializeBilling();
    if (!connected) return [];
  }

  try {
    const { results } = await InAppPurchases.getPurchaseHistoryAsync();
    return results?.filter((p) => !p.acknowledged) || [];
  } catch (error) {
    console.error("[Billing] Failed to get pending purchases:", error);
    return [];
  }
}
