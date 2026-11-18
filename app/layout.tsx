import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import '../src/index.css';

export const metadata: Metadata = {
  title: 'AIE 600 — AI Engineering: From First Principles to Production',
  description: 'A 13-week, graduate-level AI engineering course: lectures, labs, graded quizzes and exams, spaced review and an AI tutor. Start free.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

const clerkEnabled = !!(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const html = (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
  return clerkEnabled ? <ClerkProvider>{html}</ClerkProvider> : html;
}
