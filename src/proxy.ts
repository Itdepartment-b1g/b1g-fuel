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
      const adminPage = ["/users", "/roles", "/companies"].some((path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`));
      if (adminPage) {
        const data = await session.json() as { global_roles?: unknown; access?: { pages?: unknown } };
        const superAdmin = Array.isArray(data.global_roles) && data.global_roles.includes("super_admin");
        const pages = Array.isArray(data.access?.pages) ? data.access.pages : [];
        const usersPage = request.nextUrl.pathname === "/users" || request.nextUrl.pathname.startsWith("/users/");
        response = superAdmin || (usersPage && pages.includes("users"))
          ? NextResponse.next()
          : NextResponse.redirect(new URL("/dashboard", request.url));
      } else response = NextResponse.next();
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

export const config = { matcher: ["/dashboard/:path*", "/users/:path*", "/roles/:path*", "/companies/:path*", "/hubs/:path*", "/material-requests/:path*"] };
