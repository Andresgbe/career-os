import { useState, type FormEvent } from "react";
import { Lock } from "lucide-react";

export const FINANCE_PIN = "200218";
export const FINANCE_SESSION_KEY = "finance_unlocked";

export default function FinancePinGate({
  onUnlock,
}: {
  onUnlock: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (pin === FINANCE_PIN) {
      sessionStorage.setItem(FINANCE_SESSION_KEY, "true");
      setError("");
      onUnlock();
    } else {
      setError("Incorrect code.");
      setPin("");
    }
  };

  return (
    <div className="flex items-center justify-center py-24">
      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-border rounded-xl p-8 w-full max-w-sm text-center space-y-4"
      >
        <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center mx-auto">
          <Lock className="w-5 h-5 text-muted" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Finance is locked</h2>
          <p className="text-sm text-muted mt-1">
            Enter the code to access this section.
          </p>
        </div>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError("");
          }}
          className="bg-background border border-border rounded px-3 py-2 w-full text-center tracking-widest"
          placeholder="Code"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          className="w-full px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
