import { AuthForm } from "@/components/auth/auth-form";
export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ auth_error?: string | string[] }>;
}) {
  const { auth_error } = await searchParams;
  const initialAccessDenied = auth_error === "account_not_provisioned";
  const initialError = auth_error === "google_failed"
      ? "Google sign-in did not complete. Please try again."
      : null;
  return <AuthForm initialError={initialError} initialAccessDenied={initialAccessDenied} />;
}
