import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WattsUp Energy Intelligence',
  description: 'Enterprise energy monitoring and analytics platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
