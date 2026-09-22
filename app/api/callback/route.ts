import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return new Response(`OAuth error: ${errorDescription || error}`, {
      status: 400,
    });
  }

  if (!code) {
    return new Response("Missing authorization code", { status: 400 });
  }

  const appId = process.env.SQUARE_APP_ID?.trim();
  const appSecret = process.env.SQUARE_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    return new Response("Server configuration error", { status: 500 });
  }

  const env = process.env.SQUARE_ENVIRONMENT || "sandbox";
  const baseUrl =
    env === "production"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";

  const redirectUri = process.env.SQUARE_REDIRECT_URI?.trim();
  if (!redirectUri) {
    return new Response("SQUARE_REDIRECT_URI not configured", { status: 500 });
  }

  try {
    const res = await fetch(`${baseUrl}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: appId,
        client_secret: appSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const rawBody = await res.text();

    if (!res.ok) {
      let data: any;
      try {
        data = JSON.parse(rawBody);
      } catch {
        return new Response(
          `Token exchange failed (${res.status}): ${rawBody}`,
          { status: res.status }
        );
      }
      const detail = data.errors?.[0]?.detail || data.message || rawBody;
      return new Response(`Token exchange failed: ${detail}`, {
        status: res.status,
      });
    }

    const data = JSON.parse(rawBody);

    const redirect = NextResponse.redirect(new URL("/scan", request.url));
    redirect.cookies.set("square_access_token", data.access_token, {
      httpOnly: true,
      secure: env === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return redirect;
  } catch {
    return new Response("Network error during token exchange", { status: 502 });
  }
}
