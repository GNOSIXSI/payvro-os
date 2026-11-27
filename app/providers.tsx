"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "https://placeholder.convex.cloud";
const convex = new ConvexReactClient(convexUrl);
// The owner client waits for the first token without holding back payer queries.
const convexDueno = new ConvexReactClient(convexUrl, { expectAuth: true });
type Props = Readonly<{ children: ReactNode }>;

export function Providers({ children }: Props) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}

export function ProveedorClerk({ children }: Props) {
  return (
    <ClerkProvider signInUrl="/entrar" afterSignOutUrl="/entrar" signUpUrl="/entrar" localization={{ locale: "es-MX" }}>
      {children}
    </ClerkProvider>
  );
}

export function ProveedorDueno({ children }: Props) {
  return (
    <ProveedorClerk>
      <ConvexProviderWithClerk client={convexDueno} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ProveedorClerk>
  );
}
