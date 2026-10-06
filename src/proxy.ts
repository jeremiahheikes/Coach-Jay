import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every request and gates the app:
 *  - signed out  -> /login
 *  - coach       -> /coach/*
 *  - student     -> /student/*
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = path === "/login" || path === "/signup" || path.startsWith("/auth/") || path.startsWith("/api/ingest/");

  if (!user) {
    if (isPublic) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Role comes from user metadata so we don't hit the DB on every request.
  const role = (user.user_metadata?.role as string) ?? "student";
  const home = role === "coach" ? "/coach" : "/student";

  if (path === "/" || path === "/login" || path === "/signup") {
    const url = request.nextUrl.clone();
    url.pathname = home;
    return NextResponse.redirect(url);
  }
  if (role !== "coach" && path.startsWith("/coach")) {
    const url = request.nextUrl.clone();
    url.pathname = "/student";
    return NextResponse.redirect(url);
  }
  if (role !== "student" && path.startsWith("/student")) {
    const url = request.nextUrl.clone();
    url.pathname = "/coach";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
