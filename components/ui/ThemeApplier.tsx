"use client";

import { useEffect } from "react";
import { applyTheme } from "@/features/theme/apply";
import { useTheme } from "@/features/theme/useTheme";

/** Mantém o tema do app igual ao salvo nas configurações (inclusive após restaurar um backup). Não renderiza nada. */
export default function ThemeApplier() {
  const { theme } = useTheme();
  useEffect(() => { if (theme) applyTheme(theme); }, [theme]);
  return null;
}
