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
} as const;

export function isClaudeConfigured(): boolean {
  return config.anthropicApiKey.length > 0;
}
