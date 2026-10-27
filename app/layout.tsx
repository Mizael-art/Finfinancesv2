import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "@/components/ui/AppShell";
import { SPLASH_BOOT_SCRIPT } from "@/features/splash";
import { THEME_BOOT_SCRIPT } from "@/features/theme/themes";

export const metadata: Metadata = { title: "FinFinance" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#000000" };

/** (versão de desenvolvimento: sem next/font porque o ambiente de teste não acessa o Google Fonts) */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="preto" suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo antes da primeira pintura (evita piscar o tema errado). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT + SPLASH_BOOT_SCRIPT }} />
      </head>
      <body className="bg-canvas font-sans text-white antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
