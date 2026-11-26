import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const conClerk = clerkMiddleware({ signInUrl: "/entrar" });

export function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    return NextResponse.next();
  }
  // The owner layout decides admission using the actual Convex mode and permissions.
  return conClerk(request, event);
}

export const config = {
  matcher: ["/panel/:path*", "/bienvenida/:path*", "/entrar/:path*"],
};
