import { AuthProvider } from "@/components/providers/AuthProvider";
import "./globals.css";

export const metadata = {
  title: "Collaborative Room",
  description: "Watch movies and study together in real-time.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}