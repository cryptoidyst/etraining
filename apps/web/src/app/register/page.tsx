"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Button, Field } from "@/components/ui";

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, "At least 3 characters")
      .max(100)
      .regex(
        /^[a-zA-Z0-9._-]+$/,
        "Letters, numbers, dot, underscore, dash only",
      ),
    fullName: z.string().min(1, "Full name is required").max(200),
    email: z
      .union([z.string().email("Invalid email"), z.literal("")])
      .optional(),
    password: z.string().min(8, "At least 8 characters").max(256),
    confirmPassword: z.string().min(8, "At least 8 characters").max(256),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

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
const CheckCircleIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.5 2.5 2.5 5-5" />
  </svg>
);

function RegisterBrand() {
  return (
    <Link href="/" className="brandlock brandlock--center" aria-label="Traininglah home">
      <span className="brandlock__mark">
        <GradCapIcon />
      </span>
      <span className="brandlock__word">
        <span className="brandlock__name">Traininglah</span>
        <span className="brandlock__tag">Training Academy</span>
      </span>
    </Link>
  );
}

export default function RegisterPage() {
  const { register: registerAccount } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: RegisterForm) => {
    setFormError(null);
    try {
      const message = await registerAccount({
        username: values.username.trim(),
        fullName: values.fullName.trim(),
        email: values.email || undefined,
        password: values.password,
      });
      setSuccessMessage(message);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Unable to register. Please try again.",
      );
    }
  };

  if (successMessage) {
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
            <RegisterBrand />

            <div className="authcard authcard--success">
              <span className="authcard__success-icon" aria-hidden="true">
                <CheckCircleIcon />
              </span>
              <div className="authcard__head" style={{ borderBottom: 0, marginBottom: 0, paddingBottom: 0 }}>
                <p className="mono eyebrow" style={{ marginBottom: "var(--space-2xs)" }}>
                  Registration received
                </p>
                <h1 className="authcard__title">
                  An administrator will review your account shortly.
                </h1>
              </div>
              <p className="authcard__note" style={{ marginTop: "var(--space-sm)" }}>
                {successMessage}
              </p>
              <p className="authcard__note">
                You will be able to sign in once an administrator approves your
                account.
              </p>
              <div style={{ marginTop: "var(--space-lg)" }}>
                <Link href="/login" className="btn btn--primary" style={{ width: "100%" }}>
                  Back to sign in
                </Link>
              </div>
            </div>
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
          <RegisterBrand />

          <form className="authcard" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="authcard__head">
              <p className="mono eyebrow" style={{ marginBottom: "var(--space-2xs)" }}>
                Create account
              </p>
              <h1 className="authcard__title">
                Register to start your learning journey.
              </h1>
            </div>

            {formError && (
              <div className="form-error" role="alert">
                <strong>Could not register.</strong>
                {formError}
              </div>
            )}

            <Field
              label="Username"
              htmlFor="username"
              error={errors.username?.message}
              hint={!errors.username ? "Letters, numbers, dot, underscore, dash." : undefined}
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
              label="Full name"
              htmlFor="fullName"
              error={errors.fullName?.message}
            >
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                placeholder="e.g. Sarah Tan"
                aria-invalid={Boolean(errors.fullName)}
                {...register("fullName")}
              />
            </Field>

            <Field
              label="Email (optional)"
              htmlFor="email"
              error={errors.email?.message}
            >
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="e.g. s.tan@company.com"
                {...register("email")}
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
                autoComplete="new-password"
                placeholder="At least 8 characters"
                aria-invalid={Boolean(errors.password)}
                {...register("password")}
              />
            </Field>

            <Field
              label="Confirm password"
              htmlFor="confirmPassword"
              error={errors.confirmPassword?.message}
            >
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="•••••••••••"
                aria-invalid={Boolean(errors.confirmPassword)}
                {...register("confirmPassword")}
              />
            </Field>

            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? "Registering…" : "Register"}
            </Button>

            <p className="authcard__note">
              Already have an account?{" "}
              <Link
                href="/login"
                style={{ color: "var(--color-accent)", fontWeight: 500 }}
              >
                Sign in
              </Link>
            </p>
          </form>

          <p className="authpage__help">
            Accounts require administrator approval before first sign in.
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
