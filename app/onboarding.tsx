import { useRouter } from "expo-router";
import { useCallback } from "react";

import { OnboardingScreen } from "@/components/onboarding";
import { useOnboarding } from "@/hooks/use-onboarding";

export default function OnboardingRoute() {
  const router = useRouter();
  const { completeOnboarding } = useOnboarding();

  const handleComplete = useCallback(async () => {
    await completeOnboarding();
    router.replace("/(tabs)");
  }, [completeOnboarding, router]);

  return <OnboardingScreen onComplete={handleComplete} />;
}
