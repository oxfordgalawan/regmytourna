"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ClipboardList, Eye, EyeOff, Loader2 } from "lucide-react";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { signUp } from "@/app/actions/auth";
import { authHref } from "@/lib/auth/safe-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { PlaceSearchCombobox, type PlaceSelection } from "@/components/places/place-search-combobox";

function PaddleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <rect x="5" y="2.5" width="11" height="13" rx="5.5" transform="rotate(-30 10.5 9)" />
      <path d="m12.5 15.5 4.5 6" strokeLinecap="round" />
      <circle cx="19" cy="6" r="2" />
    </svg>
  );
}

const accountTypes = [
  { value: "player", label: "I'm playing", hint: "Find events and register", icon: PaddleIcon },
  { value: "organizer", label: "I'm organizing", hint: "Run events and take entries", icon: ClipboardList },
] as const;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-[#e58a72]">{message}</p>;
}

export function SignupForm({ defaultAccountType, next }: { defaultAccountType?: string; next?: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [place, setPlace] = useState<PlaceSelection | null>(null);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      accountType: defaultAccountType === "organizer" ? "organizer" : "player",
      placePsgcCode: "",
      placeLabel: "",
      acceptTerms: false as unknown as true,
    },
  });
  const errors = form.formState.errors;

  async function onSubmit(values: SignupInput) {
    setServerError(null);
    setLoading(true);
    const fd = new FormData();
    fd.set("fullName", values.fullName);
    fd.set("email", values.email);
    fd.set("password", values.password);
    fd.set("accountType", values.accountType);
    if (place) {
      fd.set("placePsgcCode", place.psgcCode);
      fd.set("placeLabel", place.label);
    }
    if (next) fd.set("next", next);
    try {
      const result = await signUp(fd);
      if (result?.error) {
        setServerError(result.error);
        setLoading(false);
      }
    } catch (err) {
      if (isRedirectError(err)) throw err;
      setLoading(false);
      throw err;
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {next?.includes("#register") && !serverError && (
        <Alert>
          <AlertDescription>After you sign up, we&apos;ll bring you back to finish registration.</AlertDescription>
        </Alert>
      )}
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <Controller
        control={form.control}
        name="accountType"
        render={({ field }) => (
          <fieldset>
            <legend className="sr-only">Account type</legend>
            <div className="grid grid-cols-2 gap-2" role="radiogroup">
              {accountTypes.map((t) => {
                const active = field.value === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => field.onChange(t.value)}
                    className={cn(
                      "flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all",
                      active
                        ? "border-bone bg-bone text-ink"
                        : "border-line text-bone hover:border-bone/40"
                    )}
                  >
                    <t.icon className="size-5" />
                    <span>
                      <span className="block text-sm font-semibold">{t.label}</span>
                      <span className={cn("block text-xs", active ? "text-ink/65" : "text-muted-foreground")}>
                        {t.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Just a starting point — every account can both play and organize.
            </p>
          </fieldset>
        )}
      />

      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          autoComplete="name"
          placeholder="Juan Dela Cruz"
          aria-invalid={Boolean(errors.fullName)}
          {...form.register("fullName")}
        />
        <FieldError message={errors.fullName?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@email.com"
          aria-invalid={Boolean(errors.email)}
          {...form.register("email")}
        />
        <FieldError message={errors.email?.message} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className="pr-11"
              aria-invalid={Boolean(errors.password)}
              {...form.register("password")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-0.5 size-10 -translate-y-1/2"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          <FieldError message={errors.password?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...form.register("confirmPassword")}
          />
          <FieldError message={errors.confirmPassword?.message} />
        </div>
      </div>

      <PlaceSearchCombobox
        value={place}
        onChange={(next) => {
          setPlace(next);
          form.setValue("placePsgcCode", next?.psgcCode ?? "");
          form.setValue("placeLabel", next?.label ?? "");
        }}
      />
      <FieldError message={errors.placeLabel?.message} />

      <label className="flex cursor-pointer items-start gap-3 text-sm text-bone/80">
        <Checkbox
          className="mt-0.5"
          checked={form.watch("acceptTerms") === true}
          onCheckedChange={(c) =>
            form.setValue("acceptTerms", c === true ? true : (false as unknown as true), {
              shouldValidate: form.formState.isSubmitted,
            })
          }
        />
        <span>
          I agree to the{" "}
          <Link href="/terms" className="text-bone underline underline-offset-4">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-bone underline underline-offset-4">
            Privacy Policy
          </Link>
        </span>
      </label>
      <FieldError message={errors.acceptTerms?.message} />

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading && <Loader2 className="animate-spin" />}
        Create account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={authHref("/login", next)} className="font-medium text-bone underline underline-offset-4">
          Log in
        </Link>
      </p>
    </form>
  );
}
