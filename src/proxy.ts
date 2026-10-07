import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const apiOrigin = process.env.API_ORIGIN ?? "http://127.0.0.1:4000";
  try {
    const session = await fetch(`${apiOrigin}/api/auth/session`, {
      headers: { Cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    let response: NextResponse;
    if (session.status === 401) {
      response = NextResponse.redirect(new URL("/login", request.url));
    } else if (session.status === 403) {
      response = NextResponse.redirect(new URL("/login?auth_error=account_not_provisioned", request.url));
    } else if (session.ok) {
      response = NextResponse.next();
    } else {
      response = new NextResponse("Unable to verify your session. Please try again.", { status: 503 });
    }
    // Forward refreshed/cleared Supabase cookies from Express to the browser.
    for (const cookie of session.headers.getSetCookie()) response.headers.append("Set-Cookie", cookie);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return new NextResponse("Unable to reach the login service. Please try again.", { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}

export const config = { matcher: ["/dashboard/:path*"] };
