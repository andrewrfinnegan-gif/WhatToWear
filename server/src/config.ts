/** Centralized server configuration, loaded from environment. */
import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required('JWT_SECRET', 'dev-insecure-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  taggingModel: process.env.TAGGING_MODEL ?? 'claude-haiku-4-5',
  stylingModel: process.env.STYLING_MODEL ?? 'claude-sonnet-4-6',
  dbPath: process.env.DB_PATH ?? './whattowear.db',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',

  // Purchase integration.
  webhookSecret: process.env.WEBHOOK_SECRET ?? '',
  /** Domain users forward receipts to, e.g. "inbound.whattowear.app". */
  ingestDomain: process.env.INGEST_DOMAIN ?? '',
  /** Public URL of this API, used to build the Gmail OAuth redirect. */
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? '').replace(/\/$/, ''),
  /** Deep link back into the app after OAuth completes. */
  appRedirect: process.env.APP_REDIRECT ?? 'whattowear://account',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
} as const;

export function isClaudeConfigured(): boolean {
  return config.anthropicApiKey.length > 0;
}

export function isGmailConfigured(): boolean {
  return (
    config.googleClientId.length > 0 &&
    config.googleClientSecret.length > 0 &&
    config.publicBaseUrl.length > 0
  );
}
