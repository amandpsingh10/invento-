import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Boxes, CheckCircle2 } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PRODUCT_NAME } from "@/lib/branding";

export function ForgotPasswordPage() {
  const [mobile, setMobile] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    if (!/^[6-9]\d{9}$/.test(mobile.trim())) {
      setFieldError("Enter a valid 10-digit mobile number");
      return;
    }
    setLoading(true);
    try {
      await apiClient.post("/auth/forgot-password", { mobile });
      setSubmitted(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl dark:bg-navy-900">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600">
            <Boxes className="h-5 w-5 text-white" />
          </div>
          <p className="text-lg font-bold text-navy-950 dark:text-slate-100">{PRODUCT_NAME}</p>
        </div>

        {submitted ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Request received</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              If an account with this mobile number exists, a password reset link has been sent.
            </p>
            <Link to="/login" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Forgot your password?</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Enter your mobile number to receive a reset link.</p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">{error}</div>}
              <div>
                <Label>Mobile Number</Label>
                <Input
                  required
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="9876543210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                />
                <FieldError message={fieldError ?? undefined} />
              </div>
              <Button type="submit" className="w-full" isLoading={loading}>
                Send Reset Link
              </Button>
              <Link to="/login" className="block text-center text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300">
                Back to Sign In
              </Link>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
