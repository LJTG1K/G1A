"use client";

import { useActionState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { spring } from "@/components/ui/motion";
import { sendMagicLink, signInWithGoogle, type LoginState } from "./actions";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(sendMagicLink, {
    status: initialError ? "error" : "idle",
    message: initialError,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring.soft}
      className="bubble w-full max-w-sm p-8"
    >
      <h1 className="text-3xl font-semibold tracking-tight">Sign in to G1A</h1>
      <p className="mt-2 text-sm text-muted">All your buying spreadsheets in one storefront.</p>

      <form action={signInWithGoogle} className="mt-8">
        <Button type="submit" variant="secondary" className="w-full">
          <GoogleMark /> Continue with Google
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-hairline" /> or <span className="h-px flex-1 bg-hairline" />
      </div>

      <form action={formAction} className="space-y-3">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="field"
        />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Sending…" : "Email me a sign-in link"}
        </Button>
      </form>

      <AnimatePresence>
        {state.message && (
          <motion.p
            key={state.message}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`mt-4 text-sm ${state.status === "error" ? "text-danger" : "text-accent"}`}
          >
            {state.message}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
    </svg>
  );
}
