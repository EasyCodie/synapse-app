import { NextRequest, NextResponse } from "next/server";
import {
  decodeGoogleState,
  exchangeGoogleCode,
  getGoogleConfig,
  GoogleDriveError,
  saveGoogleIntegration,
} from "@/lib/google-drive";

function errorRedirect(request: NextRequest, code = "callback_failed", returnTo = "/settings") {
  const redirectUrl = new URL(returnTo.startsWith("/") ? returnTo : "/settings", request.url);
  redirectUrl.searchParams.set("google", "error");
  redirectUrl.searchParams.set("google_error", code);
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: NextRequest) {
  const config = getGoogleConfig();
  if (!config) return errorRedirect(request, "not_configured");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state) return errorRedirect(request, "missing_callback_params");

  try {
    const decoded = decodeGoogleState(state, config.tokenKey);
    const tokens = await exchangeGoogleCode(code);
    await saveGoogleIntegration(decoded.userId, tokens);
    const redirectUrl = new URL(decoded.returnTo, request.url);
    redirectUrl.searchParams.set("google", "connected");
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    const failureCode = error instanceof GoogleDriveError ? error.code : "callback_failed";
    let returnTo = "/settings";
    try {
      returnTo = state ? decodeGoogleState(state, config.tokenKey).returnTo : "/settings";
    } catch {
      returnTo = "/settings";
    }
    console.error(
      "[google-drive] OAuth callback failed:",
      error instanceof Error ? error.message : error
    );
    return errorRedirect(request, failureCode, returnTo);
  }
}
