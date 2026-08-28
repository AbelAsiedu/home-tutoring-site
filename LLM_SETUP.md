# Kaitlyn AI Assistant Setup

Kaitlyn is the site's real AI learning and client-support assistant. The provider gateway is free-first and automatically injects current website data into every request.

## Recommended free setup: Google Gemini

Kaitlyn now uses the current **Gemini Interactions API first**, which is the recommended Gemini interface and supports Google's newer authorization (`AQ.*`) keys. The legacy `generateContent` endpoint remains as a fallback.

Set the key in the Codespace/server environment — never commit it to Git:

```bash
export GEMINI_API_KEY="your_gemini_key"
export GEMINI_INTERACTIONS_MODEL="gemini-3.6-flash"
```

`GOOGLE_API_KEY` is also accepted if that is the variable used by your deployment.

Google's current API-key documentation says new AI Studio keys are authorization keys bound to a service account, and recommends the Interactions API for current Gemini applications. See the official documentation for current models, quotas and pricing.

## Optional free fallback: OpenRouter

OpenRouter can route free models when an OpenRouter key is configured:

```bash
export OPENROUTER_API_KEY="your_key_here"
export OPENROUTER_MODEL="openrouter/free"
```

## Optional additional providers

```bash
export MISTRAL_API_KEY="your_key_here"
export MISTRAL_MODEL="mistral-small-latest"

export HUGGINGFACE_API_KEY="your_key_here"
export HUGGINGFACE_MODEL="meta-llama/Llama-3.2-3B-Instruct"
```

## Automatic website knowledge updates

Kaitlyn does **not** use a one-time hard-coded knowledge dump.

On every chat request, the backend reloads:

1. Administrator-managed `site_content` entries, including company information and procedures.
2. Current published downloadable resources/products.
3. Current tutor directory information.
4. Current LMS course/assignment/announcement information when those tables exist.
5. The current conversation history.
6. Any request-specific context supplied by the application.

Therefore, when an administrator changes supported site content, publishes/unpublishes a resource, changes tutor information, or updates supported LMS information, Kaitlyn sees the new state on the next conversation without retraining or manually rebuilding a vector index.

Sensitive-looking site-content keys containing passwords, secrets, tokens or API keys are excluded from the AI context.

## Important distinction

Changes made only to source-code text that are not represented in the database are not automatically learned by Kaitlyn. Navigation/procedure information that should be changeable by administrators should therefore be maintained through the site's administrator-managed content/knowledge controls.

## Safety and reliability

- Kaitlyn never receives API keys or secret-looking content values.
- API calls are server-side only; the browser never receives the Gemini key.
- Gemini Interactions is attempted first, followed by legacy Gemini, OpenRouter, Mistral and Hugging Face.
- Provider failures are caught and the next configured provider is attempted.
- Site-specific answers are grounded in administrator-entered and live database information.
- Kaitlyn is instructed not to invent unsupported company facts or navigation steps.
- `store: false` is used for Gemini interactions so the provider does not need to retain the conversation as server-side interaction state.

## Backend/frontend locations

- Frontend widget: `public/js/ai-chat.js`
- Backend route: `/api/chat` in `server.js`
- Provider gateway and live knowledge loader: `tools/llm.js`
- Admin/company knowledge: database-backed `site_content` entries
