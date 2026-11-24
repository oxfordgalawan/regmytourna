"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ClipboardList, Eye, EyeOff, Loader2 } from "lucide-react";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";
import { splitPersonName } from "@/lib/validations/person-name";
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
import { showError } from "@/lib/ui/error-dialog";

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

export function SignupForm({
  defaultAccountType,
  next,
  defaultEmail,
  defaultName,
  inviteToken,
  substituteToken,
  embedded,
  onSwitchToLogin,
  onAuthenticated,
  idPrefix = "",
}: {
  defaultAccountType?: string;
  next?: string;
  defaultEmail?: string;
  defaultName?: string;
  /** partner invite — the entry is linked to the new account right after signup */
  inviteToken?: string;
  /** "take my place" invite — accepted right after signup */
  substituteToken?: string;
  embedded?: boolean;
  onSwitchToLogin?: () => void;
  onAuthenticated?: () => void;
  idPrefix?: string;
}) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [place, setPlace] = useState<PlaceSelection | null>(null);
  const nameDefaults = splitPersonName(defaultName);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: nameDefaults.firstName,
      lastName: nameDefaults.lastName,
      phone: "",
      email: defaultEmail ?? "",
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
    setLoading(true);
    const fd = new FormData();
    fd.set("firstName", values.firstName);
    fd.set("lastName", values.lastName);
    fd.set("phone", values.phone);
    fd.set("email", values.email);
    fd.set("password", values.password);
    fd.set("accountType", values.accountType);
    if (place) {
      fd.set("placePsgcCode", place.psgcCode);
      fd.set("placeLabel", place.label);
    }
    if (embedded) fd.set("embedded", "1");
    else if (next) fd.set("next", next);
    if (inviteToken) fd.set("invite", inviteToken);
    if (substituteToken) fd.set("substitute", substituteToken);
    try {
      const result = await signUp(fd);
      if (result?.error) {
        showError(result.error, { title: "Couldn't create your account" });
        setLoading(false);
        return;
      }
      if (embedded && result && "ok" in result && result.ok) {
        setLoading(false);
        router.refresh();
        onAuthenticated?.();
        return;
      }
    } catch (err) {
      if (isRedirectError(err)) throw err;
      setLoading(false);
      throw err;
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {(inviteToken || substituteToken) && (
        <Alert>
          <AlertDescription>
            {substituteToken
              ? "Use the email the invite was sent to and you'll join the team as soon as your account is created."
              : "Use the email your partner entered and your entry is added to your account automatically."}
          </AlertDescription>
        </Alert>
      )}
      {(next?.includes("#register") || next?.includes("drawer=register")) && (
        <Alert>
          <AlertDescription>After you sign up, we&apos;ll bring you back to finish registration.</AlertDescription>
        </Alert>
      )}

      {!embedded && (
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
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}firstName`}>First name</Label>
          <Input
            id={`${idPrefix}firstName`}
            autoComplete="given-name"
            placeholder="Juan"
            aria-invalid={Boolean(errors.firstName)}
            {...form.register("firstName")}
          />
          <FieldError message={errors.firstName?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}lastName`}>Last name</Label>
          <Input
            id={`${idPrefix}lastName`}
            autoComplete="family-name"
            placeholder="Dela Cruz"
            aria-invalid={Boolean(errors.lastName)}
            {...form.register("lastName")}
          />
          <FieldError message={errors.lastName?.message} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}phone`}>Mobile number</Label>
        <Input
          id={`${idPrefix}phone`}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="09XXXXXXXXX"
          maxLength={11}
          aria-invalid={Boolean(errors.phone)}
          {...form.register("phone")}
        />
        <p className="text-xs text-muted-foreground">11 digits, starts with 09.</p>
        <FieldError message={errors.phone?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}email`}>Email</Label>
        <Input
          id={`${idPrefix}email`}
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
          <Label htmlFor={`${idPrefix}password`}>Password</Label>
          <div className="relative">
            <Input
              id={`${idPrefix}password`}
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
              tabIndex={-1}
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
          <Label htmlFor={`${idPrefix}confirmPassword`}>Confirm password</Label>
          <div className="relative">
            <Input
              id={`${idPrefix}confirmPassword`}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className="pr-11"
              aria-invalid={Boolean(errors.confirmPassword)}
              {...form.register("confirmPassword")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              tabIndex={-1}
              className="absolute top-1/2 right-0.5 size-10 -translate-y-1/2"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </Button>
          </div>
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
        {embedded && onSwitchToLogin ? (
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-medium text-bone underline underline-offset-4"
          >
            Log in
          </button>
        ) : (
          <Link href={authHref("/login", next)} className="font-medium text-bone underline underline-offset-4">
            Log in
          </Link>
        )}
      </p>
    </form>
  );
}
