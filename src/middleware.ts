import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const LOCATION_COOKIE = "thaali_loc";

export async function middleware(request: NextRequest) {
  // First visit to the customer app: splash + location screen.
  // In demo mode the demo customer (and their location) is set up automatically instead.
  if (request.nextUrl.pathname === "/" && !request.cookies.has(LOCATION_COOKIE)) {
    const url = request.nextUrl.clone();
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      url.pathname = "/demo/enter";
      url.search = "?as=customer&next=/";
    } else url.pathname = "/welcome";
    return NextResponse.redirect(url);
  }
  // Role guards live in each app's layout (see requireRole); here we only refresh the session.
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|api/geocode|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
