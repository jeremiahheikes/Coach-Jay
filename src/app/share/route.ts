import { NextResponse, type NextRequest } from "next/server";

/**
 * Fallback for a gallery share that reached the server (service worker not active yet).
 * Files are too big to accept here, so we send the coach to the share page with a hint.
 */
export async function POST(req: NextRequest) {
  return NextResponse.redirect(new URL("/coach/share?err=nosw", req.url), 303);
}
export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/coach/share", req.url), 303);
}
