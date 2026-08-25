"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { BarChart3 } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 mb-4 shadow-lg shadow-sky-500/20">
            <BarChart3 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">FundTracker</h1>
          <p className="text-gray-400 text-sm mt-1">Sign up with Google</p>
        </div>

        <div className="glass-card p-8 text-center">
          <p className="text-gray-400 text-sm mb-6">
            Account creation is handled via Google Sign-In. No separate signup needed — just continue with your Google account.
          </p>
          <Link href="/auth/login" className="btn-primary justify-center w-full">
            Go to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}