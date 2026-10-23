import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Boxes } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PRODUCT_NAME } from "@/lib/branding";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiClient.post("/auth/reset-password", { token, newPassword });
      navigate("/login", { replace: true });
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
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Set a new password</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">{error}</div>}
          <div>
            <Label>New Password</Label>
            <Input required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <Label>Confirm New Password</Label>
            <Input required type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" isLoading={loading}>
            Reset Password
          </Button>
          <Link to="/login" className="block text-center text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300">
            Back to Sign In
          </Link>
        </form>
      </div>
    </div>
  );
}
