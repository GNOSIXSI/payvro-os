"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";
import { AsegurarNegocio } from "@/components/asegurar-negocio";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "https://placeholder.convex.cloud";
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const convex = new ConvexReactClient(convexUrl);

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  if (clerkPublishableKey) {
    return (
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <ConvexWithClerk>
          <AsegurarNegocio>{children}</AsegurarNegocio>
        </ConvexWithClerk>
      </ClerkProvider>
    );
  }

  return (
    <ConvexProvider client={convex}>
      <AsegurarNegocio>{children}</AsegurarNegocio>
    </ConvexProvider>
  );
}

function ConvexWithClerk({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
