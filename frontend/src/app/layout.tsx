import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { LOCALE_COOKIE_KEY, resolveLocale } from "@/lib/i18n";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Sentra - Advanced Phishing Detection",
  description: "Enterprise-grade AI-powered phishing detection.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  // Embed backend JWT for the browser extension bridge script (sentra_bridge.js).
  // Only present when the user is authenticated; absent on the login page so the
  // extension clears its stored token when the user logs out.
  const extData = session?.accessToken
    ? JSON.stringify({
        token: session.accessToken,
        email: session.user?.email ?? "",
        locale,
      })
    : null;

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {extData && (
          <script
            id="sentra-ext-data"
            type="application/json"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: extData }}
          />
        )}
        <AuthProvider>
          <LanguageProvider initialLocale={locale}>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              {children}
            </ThemeProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
