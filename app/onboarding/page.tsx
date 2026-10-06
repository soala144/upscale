import { Suspense } from "react";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { Skeleton } from "@/components/ui/primitives";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<main className="container-page max-w-4xl py-10"><Skeleton className="h-80 w-full" /></main>}>
      <OnboardingWizard />
    </Suspense>
  );
}
