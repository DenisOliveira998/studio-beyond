// ---------------------------------------------------------------------------
// Better Auth — cliente (lado do browser)
// ---------------------------------------------------------------------------

import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});

export type AuthSession = typeof authClient.$Infer.Session;
