import { NextRequest, NextResponse } from "next/server";

const VPS_API_URL = process.env.VPS_API_URL;

function errorResponse(
  request: NextRequest,
  message: string,
  status: number
): NextResponse {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);
  const response = NextResponse.redirect(url);
  // Clear PKCE cookies on error so they don't linger
  response.cookies.set("pkce_verifier", "", {
    secure: true,
    sameSite: "lax",
    path: "/api/auth/callback",
    maxAge: 0,
  });
  response.cookies.set("oauth_state", "", {
    secure: true,
    sameSite: "lax",
    path: "/api/auth/callback",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  if (!VPS_API_URL) {
    return errorResponse(request, "VPS_API_URL not configured", 500);
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");

  if (!code) {
    return errorResponse(request, "Missing authorization code", 400);
  }

  // Validate OAuth state parameter for CSRF protection
  const storedState = request.cookies.get("oauth_state")?.value;
  if (!returnedState || !storedState || returnedState !== storedState) {
    return errorResponse(request, "State mismatch — possible CSRF attack", 400);
  }

  const codeVerifier = request.cookies.get("pkce_verifier")?.value;
  if (!codeVerifier) {
    return errorResponse(request, "PKCE verifier expired", 400);
  }

  // Build the redirect_uri — must match exactly what was sent in the auth request.
  // Use NEXT_PUBLIC_SITE_URL in production (same env var the login page uses),
  // otherwise derive from the request.
  const redirectUri = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`
    : `${request.headers.get("x-forwarded-proto") ?? "https"}://${request.nextUrl.host}/api/auth/callback`;

  // Exchange the code with the backend
  let backendRes: Response;
  try {
    backendRes = await fetch(`${VPS_API_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      }),
    });
  } catch {
    return errorResponse(request, "Failed to reach authentication backend", 502);
  }

  if (!backendRes.ok) {
    const errorBody = await backendRes.json().catch(() => ({}));
    return errorResponse(
      request,
      (errorBody.detail as string) || "Authentication failed",
      backendRes.status
    );
  }

  const { token } = await backendRes.json();

  // Set the JWT as an httpOnly cookie on the website domain
  const response = NextResponse.redirect(new URL("/admin", request.url));
  response.cookies.set("auth_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
  });

  // Delete the PKCE and state cookies
  response.cookies.set("pkce_verifier", "", {
    secure: true,
    sameSite: "lax",
    path: "/api/auth/callback",
    maxAge: 0,
  });
  response.cookies.set("oauth_state", "", {
    secure: true,
    sameSite: "lax",
    path: "/api/auth/callback",
    maxAge: 0,
  });

  return response;
}
