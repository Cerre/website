import { NextRequest, NextResponse } from "next/server";

// Local development only: sign in without Google against the local API
// (vps-api scripts/dev-stream.sh), which issues the token only with DEV_LOGIN=1.
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development" || !process.env.VPS_API_URL) {
    return new NextResponse(null, { status: 404 });
  }

  const backendRes = await fetch(`${process.env.VPS_API_URL}/auth/dev`, { method: "POST" }).catch(
    () => null
  );
  if (!backendRes?.ok) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "Dev sign-in failed: is the local stack running?");
    return NextResponse.redirect(url);
  }

  const { token } = await backendRes.json();
  const response = NextResponse.redirect(new URL("/admin", request.url));
  response.cookies.set("auth_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
  });
  return response;
}
