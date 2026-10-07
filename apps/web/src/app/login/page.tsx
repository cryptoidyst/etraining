"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Button, Field } from "@/components/ui";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required").max(150),
  password: z.string().min(1, "Password is required").max(256),
});

type LoginForm = z.infer<typeof loginSchema>;

/* ---------- inline icons (stroke, currentColor) ---------- */
const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const GradCapIcon = () => (
  <svg {...iconProps}>
    <path d="M22 10 12 5 2 10l10 5 10-5z" />
    <path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
    <path d="M22 10v6" />
  </svg>
);
const ArrowLeftIcon = () => (
  <svg {...iconProps}>
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </svg>
);

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = async (values: LoginForm) => {
    setFormError(null);
    try {
      await login(values.username.trim(), values.password);
      const next = searchParams.get("next");
      router.replace(next && next.startsWith("/") ? next : "/dashboard");
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Unable to sign in. Please try again.",
      );
    }
  };

  return (
    <form className="authcard" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="authcard__head">
        <p className="mono eyebrow" style={{ marginBottom: "var(--space-2xs)" }}>
          Welcome back
        </p>
        <h1 className="authcard__title">Sign in to continue your learning journey.</h1>
      </div>

      {formError && (
        <div className="form-error" role="alert">
          <strong>Could not sign you in.</strong>
          {formError}
        </div>
      )}

      <Field
        label="Company username"
        htmlFor="username"
        error={errors.username?.message}
        hint={!errors.username ? "The username you use at work." : undefined}
      >
        <input
          id="username"
          type="text"
          autoComplete="username"
          placeholder="e.g. s.tan"
          aria-invalid={Boolean(errors.username)}
          {...register("username")}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={errors.password?.message}
      >
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="•••••••••••"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
      </Field>

      <Button type="submit" variant="primary" disabled={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Sign In"}
      </Button>

      <p className="authcard__note">
        No account yet?{" "}
        <Link
          href="/register"
          style={{ color: "var(--color-accent)", fontWeight: 500 }}
        >
          Register
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="authpage">
      <main className="authpage__main">
        <div className="authpage__top">
          <Link href="/" className="backlink">
            <ArrowLeftIcon />
            Back to Traininglah
          </Link>
        </div>

        <div className="authpage__center">
          <Link href="/" className="brandlock brandlock--center" aria-label="Traininglah home">
            <span className="brandlock__mark">
              <GradCapIcon />
            </span>
            <span className="brandlock__word">
              <span className="brandlock__name">Traininglah</span>
              <span className="brandlock__tag">Training Academy</span>
            </span>
          </Link>

          <Suspense
            fallback={
              <div className="authcard">
                <p className="mono text-muted">Loading…</p>
              </div>
            }
          >
            <LoginForm />
          </Suspense>

          <p className="authpage__help">
            Trouble signing in?{" "}
            <span style={{ color: "var(--color-ink)", fontWeight: 500 }}>
              Contact the IT service desk
            </span>
          </p>
        </div>
      </main>
      <footer className="authpage__foot">
        <span className="mono">
          Traininglah · Training Academy · Internal learning system
        </span>
      </footer>
    </div>
  );
}
