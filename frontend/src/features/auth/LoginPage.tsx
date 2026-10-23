import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Boxes, Eye, EyeOff, Loader2, Phone, Lock } from "lucide-react";
import { useAuth } from "./AuthContext";
import { FieldError } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/branding";

const schema = z.object({
  mobile: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { rememberMe: true } });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      const loggedInUser = await login(values);
      const isSuperAdmin = loggedInUser.roles.includes("SUPER_ADMIN");
      const defaultPath = isSuperAdmin ? "/super-admin/dashboard" : "/dashboard";
      const from = (location.state as any)?.from?.pathname;
      navigate(from && from !== "/" ? from : defaultPath, { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy-950 px-4 py-10">
      {/* Ambient brand glow — purely decorative, matches the app's navy/brand palette */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 10%, #2563eb 0, transparent 35%), radial-gradient(circle at 85% 90%, #1d4ed8 0, transparent 40%)",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-900/40">
            <Boxes className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-extrabold leading-tight tracking-tight text-white sm:text-2xl">{PRODUCT_NAME}</h1>
          <p className="mt-1.5 text-sm text-slate-400 dark:text-slate-500">{PRODUCT_TAGLINE}</p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-2xl shadow-black/30 sm:p-7 dark:bg-navy-900">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Welcome Back</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sign in with your mobile number to continue.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
            {serverError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">{serverError}</div>
            )}

            <div>
              <label htmlFor="mobile" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Mobile Number
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5 text-slate-400 dark:text-slate-500">
                  <Phone className="h-4 w-4" />
                  <span className="text-sm font-medium">+91</span>
                </span>
                <input
                  id="mobile"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="9876543210"
                  autoComplete="tel"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-[4.5rem] pr-3.5 text-[15px] font-medium tracking-wide text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/15 dark:border-navy-700 dark:bg-navy-800/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-navy-900"
                  {...register("mobile")}
                />
              </div>
              <FieldError message={errors.mobile?.message} />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-11 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/15 dark:border-navy-700 dark:bg-navy-800/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-navy-900"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <FieldError message={errors.password?.message} />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-navy-600 dark:text-brand-400" {...register("rememberMe")} />
                Remember Me
              </label>
              <Link to="/forgot-password" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
                Forgot Password?
              </Link>
            </div>

            <Button type="submit" className="h-12 w-full rounded-xl text-[15px] font-semibold shadow-lg shadow-brand-600/25" isLoading={isSubmitting}>
              {isSubmitting ? "Signing in..." : "LOGIN"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-navy-950">
      <Loader2 className="h-6 w-6 animate-spin text-brand-600 dark:text-brand-400" />
    </div>
  );
}
