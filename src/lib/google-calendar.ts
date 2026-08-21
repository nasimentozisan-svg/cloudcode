// Lets this app authenticate as the club's Google account
// (emfrentekumamoto@gmail.com) and create/update/delete real events on its
// primary calendar. Uses a one-time-obtained OAuth refresh token stored in
// Vercel env vars (see /api/admin/google-calendar-authorize for how that
// token is obtained) rather than a service account, since we're writing to
// a normal Google user's calendar, not a domain-owned resource.
import { google } from "googleapis";

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET が設定されていません"
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, googleOAuthRedirectUri());
}

export function googleOAuthRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL が設定されていません");
  }
  return `${appUrl}/api/admin/google-calendar-authorize/callback`;
}

export function buildGoogleAuthUrl(): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    // Forces Google to hand back a refresh_token every time, even if this
    // app was already authorized before - without this, re-authorizing
    // after losing the token would silently return no refresh_token.
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar"],
  });
}

export async function exchangeCodeForRefreshToken(code: string): Promise<string> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "refresh_tokenが返されませんでした。Googleアカウントの「サードパーティのアクセス権」からEFK membersを一度削除してから、もう一度やり直してください"
    );
  }
  return tokens.refresh_token;
}

export function isGoogleSyncConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  );
}

export function getCalendarClient() {
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error("GOOGLE_OAUTH_REFRESH_TOKEN が設定されていません");
  }
  const client = getOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth: client });
}
