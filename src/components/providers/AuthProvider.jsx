"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // 1. Get the current active session explicitly
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setUser(session?.user ?? null);
          setLoading(false);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    // 2. Continuous session event listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      console.log(`Auth event triggered: ${event}`);
      
      // Only update states on concrete changes to prevent tab-switching bugs
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setUser(session?.user ?? null);
        setLoading(false);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setLoading(false);
        router.push("/login");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  // 3. Resilient Route Guarding
  useEffect(() => {
    // If we are still checking the session from the cloud, do nothing!
    if (loading) return;

    // Only redirect if we are 100% certain the user is absent and trying to access a protected page
    const isPublicPath = pathname === "/login" || pathname === "/";
    
    if (!user && !isPublicPath) {
      console.log("Route guard activated: Redirecting unauthenticated user to login.");
      router.push("/login");
    }
  }, [user, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);