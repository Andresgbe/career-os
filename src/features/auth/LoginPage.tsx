import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { APP_NAME } from "../../lib/constants";

export default function LoginPage() {
  const { session, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect to home
  if (authLoading) return null;
  if (session) return <Navigate to="/" replace />;

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-xl p-6">
        <h1 className="text-2xl font-bold mb-1 text-center">
          <span className="text-primary">{APP_NAME}</span>
        </h1>
        <p className="text-muted text-sm text-center mb-6">
          {isSignUp ? "Create your account" : "Sign in to continue"}
        </p>

        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? "Loading..." : isSignUp ? "Sign up" : "Sign in"}
          </button>
        </div>

        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError("");
          }}
          className="w-full text-center text-xs text-muted hover:text-foreground mt-4 transition-colors"
        >
          {isSignUp
            ? "Already have an account? Sign in"
            : "Need an account? Sign up"}
        </button>
      </div>
    </div>
  );
}