import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  useEffect(() => {
    authClient.getSession().then(() => {
      window.location.href = "/";
    }).catch(() => {
      window.location.href = "/";
    });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <span className="size-6 animate-spin rounded-full border-2 border-border border-t-gilt" />
    </div>
  );
}
