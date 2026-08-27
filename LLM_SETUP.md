# Kaitlyn AI Assistant Setup

Kaitlyn is the site's real AI learning and client-support assistant. The provider gateway is free-first and automatically injects current website data into every request.

## Recommended free setup: Google Gemini

Google currently provides a free tier for selected Gemini API models. The application defaults to `gemini-2.5-flash-lite`, which is designed for fast, high-volume use. Check Google's current limits before production launch.

Set:

```powershell
$env:GEMINI_API_KEY = "your_google_ai_studio_key"
$env:GEMINI_MODEL = "gemini-2.5-flash-lite"
```

Official pricing/free-tier information: https://ai.google.dev/gemini-api/docs/pricing

## Optional free fallback: OpenRouter

OpenRouter provides free model variants and a free-model router. Kaitlyn uses `openrouter/free` by default when an OpenRouter key is configured.

```powershell
$env:OPENROUTER_API_KEY = "your_key_here"
$env:OPENROUTER_MODEL = "openrouter/free"
```

## Optional additional providers

```powershell
$env:MISTRAL_API_KEY = "your_key_here"
$env:MISTRAL_MODEL = "mistral-small-latest"

$env:HUGGINGFACE_API_KEY = "your_key_here"
$env:HUGGINGFACE_MODEL = "meta-llama/Llama-3.2-3B-Instruct"
```

## Automatic website knowledge updates

Kaitlyn does **not** use a one-time hard-coded knowledge dump.

On every chat request, the backend reloads:

1. Administrator-managed `site_content` entries, including company information and procedures.
2. Current published downloadable resources/products.
3. Current tutor directory information when the tutor table is available.
4. The current conversation history.
5. Any request-specific context supplied by the application.

Therefore, when an administrator changes supported site content, publishes/unpublishes a resource, or changes tutor information in the database, Kaitlyn sees the new state on the next conversation without retraining or manually rebuilding a vector index.

Sensitive-looking site-content keys containing passwords, secrets, tokens or API keys are excluded from the AI context.

## Important distinction

Changes made only to source-code text that are not represented in the database are not automatically learned by Kaitlyn. Navigation/procedure information that should be changeable by administrators should therefore be maintained through the site's administrator-managed content/knowledge controls. This keeps operational answers editable without redeploying the model.

## Safety and reliability

- Kaitlyn never receives API keys or secret-looking content values.
- Existing prompt safety guardrails remain active.
- Provider failures are caught and the next configured provider is attempted.
- Gemini is attempted first, followed by OpenRouter, Mistral and Hugging Face.
- No AI API key is exposed to the browser; calls are server-side only.
- The assistant is instructed not to invent unsupported company facts or navigation steps.

## Backend/frontend locations

- Frontend widget: `public/js/ai-chat.js`
- Backend route: `/api/chat` in `server.js`
- Provider gateway and live knowledge loader: `tools/llm.js`
- Admin/company knowledge: database-backed `site_content` entries
