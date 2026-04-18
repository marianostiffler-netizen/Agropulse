import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: 'Agropulse · Monitoreo satelital',
  description:
    'Plataforma enterprise para monitoreo de sequías y vigor agrícola con Sentinel-2 y Google Earth Engine.',
};

export const viewport = {
  themeColor: '#111827',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
