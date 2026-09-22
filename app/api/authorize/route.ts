import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const appId = process.env.SQUARE_APP_ID?.trim();
  if (!appId) {
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

  const params = new URLSearchParams({
    client_id: appId,
    scope: "ITEMS_READ",
    redirect_uri: redirectUri,
    session: "false",
  });

  return NextResponse.redirect(`${baseUrl}/oauth2/authorize?${params}`);
}
