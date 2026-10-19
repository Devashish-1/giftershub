import './globals.css';
import CartProvider from '../components/CartProvider';
import AuthProvider from '../components/AuthProvider';
import Shell from '../components/Shell';
import Cursor from '../components/Cursor';
export const metadata = { title: 'The Gifter’s Hub | Gifts & Decor', description: 'Photo frames, car murtis, idols and festive gift hampers.' };
export default function RootLayout({ children }) {
  return (<html lang="en"><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  </head><body><AuthProvider><CartProvider><Cursor /><Shell>{children}</Shell></CartProvider></AuthProvider></body></html>);
}
