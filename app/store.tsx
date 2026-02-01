import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { trpc } from "@/lib/trpc";
import {
  getProducts,
  initializeBilling,
  purchaseProduct,
  setPurchaseListener,
  acknowledgePurchase,
  Product,
  ProductId,
  CREDIT_AMOUNTS,
} from "@/lib/billing";
import { FontScaling } from "@/constants/accessibility";

export default function StoreScreen() {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: creditsData } = trpc.user.getCredits.useQuery();
  
  const processPurchaseMutation = trpc.billing.processPurchase.useMutation({
    onSuccess: async (data) => {
      if (data.success && 'creditsAdded' in data) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Purchase Complete!",
          `${data.creditsAdded} credits have been added to your account.`
        );
        utils.user.getCredits.invalidate();
      } else {
        Alert.alert("Error", ('error' in data ? data.error : undefined) || "Failed to process purchase");
      }
      setPurchasingId(null);
    },
    onError: (error) => {
      Alert.alert("Error", error.message || "Failed to process purchase");
      setPurchasingId(null);
    },
  });

  useEffect(() => {
    loadProducts();
    
    // Set up purchase listener
    const cleanup = setPurchaseListener(async (purchase) => {
      console.log("[Store] Purchase received:", purchase.productId);
      
      // Process the purchase on our server
      const creditsToAdd = CREDIT_AMOUNTS[purchase.productId as ProductId] || 0;
      if (creditsToAdd > 0) {
        processPurchaseMutation.mutate({
          productId: purchase.productId,
          purchaseToken: purchase.purchaseToken || "",
        });
        
        // Acknowledge the purchase
        if (purchase.purchaseToken) {
          await acknowledgePurchase(purchase.purchaseToken);
        }
      }
    });

    return cleanup;
  }, []);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      await initializeBilling();
      const fetchedProducts = await getProducts();
      setProducts(fetchedProducts);
    } catch (error) {
      console.error("[Store] Failed to load products:", error);
    }
    setIsLoading(false);
  };

  const handlePurchase = async (product: Product) => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Not Available",
        "In-app purchases are only available on mobile devices."
      );
      return;
    }

    setPurchasingId(product.productId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await purchaseProduct(product.productId);
    
    if (!result.success && result.error !== "Purchase cancelled") {
      Alert.alert("Purchase Failed", result.error || "Unknown error");
      setPurchasingId(null);
    } else if (result.error === "Purchase cancelled") {
      setPurchasingId(null);
    }
    // If successful, the purchase listener will handle the rest
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 20),
            paddingBottom: Math.max(insets.bottom, 20) + 20,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ThemedText style={styles.backText}>Close</ThemedText>
          </Pressable>
          <ThemedText type="title" style={styles.title} maxFontSizeMultiplier={FontScaling.title}>
            Get Credits
          </ThemedText>
          <View style={styles.backButton} />
        </View>

        {/* Current Balance */}
        <View style={styles.balanceCard}>
          <ThemedText style={styles.balanceLabel} maxFontSizeMultiplier={FontScaling.label}>Current Balance</ThemedText>
          <ThemedText style={styles.balanceValue} maxFontSizeMultiplier={FontScaling.display}>
            {creditsData?.credits ?? 0} credits
          </ThemedText>
        </View>

        {/* Products */}
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Credit Packs
        </ThemedText>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <ThemedText style={styles.loadingText}>
              Loading products...
            </ThemedText>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>
              No products available at this time.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.productsGrid}>
            {products.map((product) => (
              <Pressable
                key={product.productId}
                style={[
                  styles.productCard,
                  purchasingId === product.productId && styles.productCardActive,
                ]}
                onPress={() => handlePurchase(product)}
                disabled={purchasingId !== null}
              >
                {purchasingId === product.productId ? (
                  <ActivityIndicator color="#007AFF" />
                ) : (
                  <>
                    <ThemedText style={styles.productCredits} maxFontSizeMultiplier={FontScaling.display}>
                      {product.credits}
                    </ThemedText>
                    <ThemedText style={styles.productLabel} maxFontSizeMultiplier={FontScaling.label}>credits</ThemedText>
                    <ThemedText style={styles.productPrice} maxFontSizeMultiplier={FontScaling.button}>
                      {product.price}
                    </ThemedText>
                  </>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {/* Promo Code Section */}
        <View style={styles.promoSection}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Have a Promo Code?
          </ThemedText>
          <Pressable
            style={styles.promoButton}
            onPress={() => router.push("/redeem" as any)}
          >
            <ThemedText style={styles.promoButtonText} maxFontSizeMultiplier={FontScaling.button}>
              Redeem Promo Code
            </ThemedText>
          </Pressable>
        </View>

        {/* Info */}
        <View style={styles.infoSection}>
          <ThemedText style={styles.infoText} maxFontSizeMultiplier={FontScaling.body}>
            1 credit = 1 document processed
          </ThemedText>
          <ThemedText style={styles.infoText} maxFontSizeMultiplier={FontScaling.body}>
            Credits never expire
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  backButton: {
    width: 60,
  },
  backText: {
    color: "#007AFF",
    fontSize: 17,
  },
  title: {
    fontSize: 20,
    textAlign: "center",
  },
  balanceCard: {
    backgroundColor: "#007AFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 32,
  },
  balanceLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    marginBottom: 4,
  },
  balanceValue: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
  },
  sectionTitle: {
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    opacity: 0.6,
  },
  emptyContainer: {
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    opacity: 0.6,
    textAlign: "center",
  },
  productsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 32,
  },
  productCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: "#f5f5f5",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  productCardActive: {
    opacity: 0.7,
  },
  productCredits: {
    fontSize: 32,
    fontWeight: "700",
    color: "#007AFF",
  },
  productLabel: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: "600",
  },
  promoSection: {
    marginBottom: 32,
  },
  promoButton: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  promoButtonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
  infoSection: {
    alignItems: "center",
    gap: 4,
  },
  infoText: {
    fontSize: 13,
    opacity: 0.5,
  },
});
