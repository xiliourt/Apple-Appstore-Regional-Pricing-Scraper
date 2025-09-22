import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Scraper',
  description: 'Example iOS regional price scraper',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
