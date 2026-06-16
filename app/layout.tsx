import type { Metadata } from "next";
import "./globals.css";
import Navbar from "../components/layout/navbar";
import Footer from "../components/layout/footer";
import { ThemeProvider } from "@/context/ThemeContext";
import { checkEnvStatus } from "../lib/env-check";

// Run feature activation check on server startup
checkEnvStatus();


export const metadata: Metadata = {
  title: "EduFlow AI — Your AI-Powered Student Assistant",
  description:
    "EduFlow AI helps students plan smarter, solve doubts instantly, generate notes, track productivity, and stay focused — all in one intelligent platform.",
  keywords: [
    "EduFlow AI",
    "student AI assistant",
    "study planner",
    "AI doubt solver",
    "notes generator",
  ],
  authors: [{ name: "EduFlow AI" }],
  icons: {
    icon: "/images/logo.png",
    shortcut: "/images/logo.png",
    apple: "/images/logo.png",
  },
  openGraph: {
    title: "EduFlow AI",
    description:
      "Turn your academic chaos into clarity with AI-powered study tools.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
