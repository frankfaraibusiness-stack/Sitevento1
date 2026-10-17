import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'sitevento — Connect your site. Run it from here.',
  description:
    'Drop a single meta tag into your site and get a control panel for everything that happens on it: who visits, who converts, and what they see right now.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
