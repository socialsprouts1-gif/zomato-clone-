"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, KeyRound, Loader2, Mail, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { DemoBadge } from "@/components/shared/demo-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  requestPhoneOtp,
  sendMagicLink,
  signInWithGoogle,
  signInWithPassword,
  verifyPhoneOtp,
} from "@/lib/auth/actions";

const phoneForm = z.object({ phone: z.string().regex(/^\d{10}$/, "Enter your 10-digit mobile number") });
const otpForm = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") });
const emailForm = z.object({ email: z.string().email("Enter a valid email") });
const passwordForm = z.object({ email: z.string().email("Enter a valid email"), password: z.string().min(6, "At least 6 characters") });

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.3 0-6-2.74-6-6.1s2.7-6.1 6-6.1c1.9 0 3.15.8 3.87 1.5l2.64-2.54C16.84 3.4 14.66 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.54 0 9.2-3.9 9.2-9.38 0-.63-.07-1.1-.16-1.6H12z" />
    </svg>
  );
}

export function LoginForm({ next, initialError, demoMode }: { next?: string; initialError?: string; demoMode: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [phone, setPhone] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const [usePassword, setUsePassword] = useState(false);

  useEffect(() => {
    if (initialError) toast.error(initialError);
  }, [initialError]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const pForm = useForm<z.infer<typeof phoneForm>>({ resolver: zodResolver(phoneForm), defaultValues: { phone: "" } });
  const oForm = useForm<z.infer<typeof otpForm>>({ resolver: zodResolver(otpForm), defaultValues: { code: "" } });
  const eForm = useForm<z.infer<typeof emailForm>>({ resolver: zodResolver(emailForm), defaultValues: { email: "" } });
  const pwForm = useForm<z.infer<typeof passwordForm>>({ resolver: zodResolver(passwordForm), defaultValues: { email: "", password: "" } });

  function sendOtp(values: z.infer<typeof phoneForm>) {
    startTransition(async () => {
      const res = await requestPhoneOtp(values.phone);
      if (!res.ok) return void toast.error(res.error);
      setPhone(values.phone);
      setResendIn(30);
      if (res.data?.demoCode) {
        toast.info(`Demo OTP: ${res.data.demoCode}`, { description: "No SMS is sent in demo mode.", duration: 10000 });
      } else {
        toast.success("OTP sent by SMS");
      }
    });
  }

  function verify(values: z.infer<typeof otpForm>) {
    if (!phone) return;
    startTransition(async () => {
      const res = await verifyPhoneOtp(phone, values.code, next);
      if (!res.ok) return void oForm.setError("code", { message: res.error });
      toast.success("Signed in");
      router.replace(res.data?.redirectTo ?? "/");
      router.refresh();
    });
  }

  function magicLink(values: z.infer<typeof emailForm>) {
    startTransition(async () => {
      const res = await sendMagicLink(values.email, next);
      if (!res.ok) return void toast.error(res.error);
      setEmailSent(values.email);
      toast.success(res.message ?? "Link sent");
    });
  }

  function password(values: z.infer<typeof passwordForm>) {
    startTransition(async () => {
      const res = await signInWithPassword(values.email, values.password, next);
      if (!res.ok) return void pwForm.setError("password", { message: res.error });
      toast.success("Signed in");
      router.replace(res.data?.redirectTo ?? "/");
      router.refresh();
    });
  }

  function google() {
    startTransition(async () => {
      const res = await signInWithGoogle(next);
      if (!res.ok) return void toast.error(res.error);
      window.location.href = res.data!.url;
    });
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="phone">
        <TabsList className="w-full">
          <TabsTrigger value="phone">
            <Phone /> Phone
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail /> Email
          </TabsTrigger>
        </TabsList>

        <TabsContent value="phone">
          {!phone ? (
            <form onSubmit={pForm.handleSubmit(sendOtp)} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile number</Label>
                <div className="flex gap-2">
                  <span className="flex h-11 items-center rounded-xl border bg-muted px-3 text-sm font-semibold">+91</span>
                  <Input
                    id="phone"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={10}
                    placeholder="98765 43210"
                    aria-invalid={Boolean(pForm.formState.errors.phone)}
                    {...pForm.register("phone")}
                  />
                </div>
                {pForm.formState.errors.phone ? (
                  <p className="text-sm text-destructive">{pForm.formState.errors.phone.message}</p>
                ) : null}
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : null} Send OTP
              </Button>
              {demoMode ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <DemoBadge /> Any number works. The code is always 123456.
                </p>
              ) : null}
            </form>
          ) : (
            <form onSubmit={oForm.handleSubmit(verify)} className="space-y-4" noValidate>
              <button
                type="button"
                onClick={() => {
                  setPhone(null);
                  oForm.reset();
                }}
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" /> Change number
              </button>
              <div className="space-y-2">
                <Label htmlFor="code">Enter the code sent to +91 {phone}</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="••••••"
                  className="text-center text-2xl tracking-[0.6em]"
                  autoFocus
                  aria-invalid={Boolean(oForm.formState.errors.code)}
                  {...oForm.register("code")}
                />
                {oForm.formState.errors.code ? (
                  <p className="text-sm text-destructive">{oForm.formState.errors.code.message}</p>
                ) : null}
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : null} Verify and continue
              </Button>
              <Button
                type="button"
                variant="link"
                className="w-full"
                disabled={resendIn > 0 || pending}
                onClick={() => sendOtp({ phone })}
              >
                {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              </Button>
            </form>
          )}
        </TabsContent>

        <TabsContent value="email">
          {usePassword ? (
            <form onSubmit={pwForm.handleSubmit(password)} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="pw-email">Email</Label>
                <Input id="pw-email" type="email" autoComplete="email" {...pwForm.register("email")} />
                {pwForm.formState.errors.email ? <p className="text-sm text-destructive">{pwForm.formState.errors.email.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw">Password</Label>
                <Input id="pw" type="password" autoComplete="current-password" {...pwForm.register("password")} />
                {pwForm.formState.errors.password ? <p className="text-sm text-destructive">{pwForm.formState.errors.password.message}</p> : null}
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <KeyRound />} Sign in
              </Button>
              <Button type="button" variant="link" className="w-full" onClick={() => setUsePassword(false)}>
                Email me a sign-in link instead
              </Button>
            </form>
          ) : emailSent ? (
            <div className="space-y-3 rounded-2xl border bg-secondary/50 p-5 text-center">
              <Mail className="mx-auto size-8 text-primary" />
              <p className="font-semibold">Check your inbox</p>
              <p className="text-sm text-muted-foreground">We sent a sign-in link to {emailSent}. It expires in 1 hour.</p>
              <Button variant="link" onClick={() => setEmailSent(null)}>Use a different email</Button>
            </div>
          ) : (
            <form onSubmit={eForm.handleSubmit(magicLink)} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...eForm.register("email")} />
                {eForm.formState.errors.email ? <p className="text-sm text-destructive">{eForm.formState.errors.email.message}</p> : null}
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Mail />} Send magic link
              </Button>
              <Button type="button" variant="link" className="w-full" onClick={() => setUsePassword(true)}>
                Sign in with a password
              </Button>
            </form>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <Button type="button" variant="outline" size="lg" className="w-full" onClick={google} disabled={pending}>
        <GoogleIcon /> Continue with Google
      </Button>
    </div>
  );
}
