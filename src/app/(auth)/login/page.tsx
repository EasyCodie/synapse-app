"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="bg-surface-1 border border-hairline rounded-lg p-6 space-y-5">
      <div className="space-y-1">
        <h1 className="text-card-title text-ink">Sign in</h1>
        <p className="text-body-sm text-ink-subtle">
          Welcome back to your workspace.
        </p>
      </div>

      {/* Google OAuth */}
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={handleGoogleLogin}
        disabled={googleLoading}
      >
        {googleLoading ? (
          <span className="opacity-60">Connecting…</span>
        ) : (
          <>
            <GoogleIcon />
            Continue with Google
          </>
        )}
      </Button>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-hairline" />
        <span className="text-caption text-ink-tertiary">or</span>
        <div className="flex-1 h-px bg-hairline" />
      </div>

      {/* Email form */}
      <form onSubmit={handleEmailLogin} className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-body-sm text-ink-muted">
            Email
          </label>
          <Input
            id="email"
            type="email"
            placeholder="you@school.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className={cn(
              "bg-surface-2 border-hairline text-ink placeholder:text-ink-tertiary",
              "focus:border-hairline-strong focus:ring-0 focus:outline-2 focus:outline-primary/50"
            )}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-body-sm text-ink-muted">
            Password
          </label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className={cn(
              "bg-surface-2 border-hairline text-ink placeholder:text-ink-tertiary",
              "focus:border-hairline-strong focus:ring-0 focus:outline-2 focus:outline-primary/50"
            )}
          />
        </div>

        {error && (
          <p className="text-body-sm text-destructive">{error}</p>
        )}

        <Button
          type="submit"
          className="w-full bg-primary hover:bg-primary-hover text-on-primary"
          disabled={loading}
        >
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-body-sm text-ink-subtle">
        No account?{" "}
        <Link href="/signup" className="text-primary hover:text-primary-hover transition-colors">
          Create one
        </Link>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
