"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { signInWithPassword } from "@/app/actions/auth";
import { authHref } from "@/lib/auth/safe-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LoginForm({ next }: { next?: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  });
  const errors = form.formState.errors;

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("email", values.email);
      fd.set("password", values.password);
      if (next) fd.set("next", next);
      const result = await signInWithPassword(fd);
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
          <AlertDescription>Log in and we&apos;ll take you straight back to registration.</AlertDescription>
        </Alert>
      )}
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
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
        {errors.email && <p className="text-sm text-[#e58a72]">{errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
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
        {errors.password && <p className="text-sm text-[#e58a72]">{errors.password.message}</p>}
        <p className="text-right">
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-bone hover:underline"
          >
            Forgot password?
          </Link>
        </p>
      </div>
      <label className="flex cursor-pointer items-center gap-3 text-sm text-bone/80">
        <Checkbox
          checked={form.watch("remember")}
          onCheckedChange={(c) => form.setValue("remember", Boolean(c))}
        />
        Keep me logged in
      </label>
      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading && <Loader2 className="animate-spin" />}
        Log in
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New to RegMyTourna?{" "}
        <Link href={authHref("/signup", next)} className="font-medium text-bone underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </form>
  );
}
