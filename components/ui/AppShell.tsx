"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Splash from "./Splash";
import ThemeApplier from "./ThemeApplier";
import DriveAutoBackup from "./DriveAutoBackup";
import OnboardingGate from "./OnboardingGate";
import RecurrenceRunner from "./RecurrenceRunner";
import Sidebar from "./Sidebar";
import BottomNavigation from "./BottomNavigation";

/** Casca do app: porteiro do onboarding + sidebar (só fora do onboarding). */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bare = pathname?.startsWith("/onboarding") ?? false;
  return (
    <>
      <Splash />
      <OnboardingGate>
      <ThemeApplier />
      {!bare && <Sidebar />}
      {!bare && <RecurrenceRunner />}
      {!bare && <DriveAutoBackup />}
      <div className={bare ? undefined : "lg:pl-64"}>{children}</div>
      {!bare && <BottomNavigation />}
      </OnboardingGate>
    </>
  );
}
