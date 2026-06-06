/**
 * Runtime configuration.
 *
 * SECURITY NOTE: For a shipped app you should NEVER embed an Anthropic API key
 * in the client bundle — anyone can extract it. The correct architecture is a
 * thin backend proxy that holds the key and forwards requests. To keep this
 * vertical slice runnable end-to-end without standing up a server, we read the
 * key from an env var (EXPO_PUBLIC_ANTHROPIC_API_KEY) at dev time. When no key
 * is present the app degrades gracefully to the on-device rules engine.
 *
 * To enable the Claude stylist locally:
 *   1. cp .env.example .env
 *   2. add EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...
 *   3. restart `npm start`
 */

// Models. Tagging is cheap/high-volume → Haiku. Styling benefits from stronger
// reasoning → Sonnet. Both are overridable via env.
export const TAGGING_MODEL =
  process.env.EXPO_PUBLIC_TAGGING_MODEL ?? 'claude-haiku-4-5';
export const STYLING_MODEL =
  process.env.EXPO_PUBLIC_STYLING_MODEL ?? 'claude-sonnet-4-6';

export const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

/** If set, Claude calls are routed here instead of api.anthropic.com directly. */
export const ANTHROPIC_PROXY_URL = process.env.EXPO_PUBLIC_ANTHROPIC_PROXY_URL ?? '';

export function isClaudeConfigured(): boolean {
  return ANTHROPIC_API_KEY.length > 0 || ANTHROPIC_PROXY_URL.length > 0;
}
