"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";

const STORAGE_KEY = "ft_default_view";

export default function DefaultViewRedirector() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    // Only redirect when landing on /dashboard (the default initial route)
    if (pathname !== "/dashboard") return;

    const redirect = (target: string) => {
      if (target && target !== "/dashboard") {
        router.replace(target);
      }
    };

    // 1. Check localStorage for instant redirect (no network)
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached && cached !== "/dashboard") {
      redirect(cached);
      return;
    }

    // 2. If not in localStorage, check Firestore once
    getDoc(doc(db, "users", user.uid, "settings", "data"))
      .then((snap) => {
        const val = snap.data()?.default_view as string | undefined;
        if (val) {
          localStorage.setItem(STORAGE_KEY, val);
          redirect(val);
        }
      })
      .catch(() => { /* silently ignore */ });
  }, [user, pathname, router]);

  return null; // renders nothing
}