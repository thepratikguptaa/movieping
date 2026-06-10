import { RouteGuard } from "@/components/route-guard";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export default function OnboardingPage() {
  return (
    <RouteGuard allowUnonboarded>
      <OnboardingWizard />
    </RouteGuard>
  );
}
