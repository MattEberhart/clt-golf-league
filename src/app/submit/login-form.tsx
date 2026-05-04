"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState | undefined, FormData>(
    loginAction,
    undefined,
  );

  return (
    <form action={formAction} className="max-w-sm space-y-4">
      <label className="block">
        <span className="block text-sm text-walnut-soft mb-1">League password</span>
        <input
          type="password"
          name="password"
          required
          autoFocus
          className="w-full border border-walnut-faint bg-cream-soft px-3 py-2 text-walnut focus:outline-none focus:border-accent rounded-[2px]"
        />
      </label>
      {state?.error && (
        <p className="text-sm text-red-700">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-cream px-5 py-2.5 text-sm font-medium hover:bg-accent-deep disabled:opacity-50 rounded-[2px]"
      >
        {pending ? "Checking…" : "Unlock"}
      </button>
    </form>
  );
}
