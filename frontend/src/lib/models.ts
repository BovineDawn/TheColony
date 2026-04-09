/**
 * Shared model label utilities.
 * Handles both the short settings keys ('gpt-4o') and the
 * LiteLLM-prefixed values the backend may store ('openai/gpt-4o').
 */

export const MODEL_DISPLAY: Record<string, string> = {
  'gpt-4o':                          'GPT-4o',
  'openai/gpt-4o':                   'GPT-4o',
  'claude-3-5-sonnet':               'Claude',
  'anthropic/claude-3-5-sonnet-20241022': 'Claude',
  'gemini-1.5-pro':                  'Gemini',
  'gemini/gemini-2.5-flash':         'Gemini',
  'gemini-2.5-flash':                'Gemini',
}

export function getModelLabel(model: string | undefined | null): string {
  if (!model) return '—'
  if (MODEL_DISPLAY[model]) return MODEL_DISPLAY[model]
  // Fuzzy fallback for any future variants
  const m = model.toLowerCase()
  if (m.includes('gpt') || m.includes('openai')) return 'GPT-4o'
  if (m.includes('gemini'))                       return 'Gemini'
  if (m.includes('claude') || m.includes('anthropic')) return 'Claude'
  return model
}
