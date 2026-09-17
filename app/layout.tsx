import type { Metadata } from 'next';
import { Space_Grotesk, Space_Mono } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  variable: '--font-sans-custom',
  subsets: ['latin'],
});

const spaceMono = Space_Mono({
  variable: '--font-mono-custom',
  weight: ['400', '700'],
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Grug Chat — tiny vocabulary, big thought',
  description: 'A tiny in-browser chatbot that uses Jev-style Choice decisions to pick every next word from a fixed vocabulary.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${spaceMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
