# AI Chat Assistant Setup

This site now supports an optional LLM-backed chat assistant. By default it answers using your FAQ content, but if you provide a free-tier API key, it will call a real model.

## Providers

- OpenRouter (recommended): aggregates multiple models. Free-tier available (requires API key).
- Hugging Face Inference API: free-tier with rate limits (requires API key).

## Configure locally

Set environment variables before starting the server:

```powershell
# OpenRouter (recommended)
$env:OPENROUTER_API_KEY = "your_key_here"
# Optional: choose a model; default is openrouter/auto
$env:OPENROUTER_MODEL = "mistralai/mistral-7b-instruct"

# OR Hugging Face
$env:HUGGINGFACE_API_KEY = "your_key_here"
# Optional: choose a model; default is meta-llama/Llama-3.2-3B-Instruct
$env:HUGGINGFACE_MODEL = "google/gemma-2-9b-it"

# Start the server
node server.js
```

## Configure on Heroku

```powershell
heroku config:set OPENROUTER_API_KEY=your_key_here
heroku config:set OPENROUTER_MODEL=mistralai/mistral-7b-instruct
# or
heroku config:set HUGGINGFACE_API_KEY=your_key_here
heroku config:set HUGGINGFACE_MODEL=meta-llama/Llama-3.2-3B-Instruct
```

Deploy and the chat widget will automatically use the configured provider.

## Safety guardrails

- Harmful, hateful, racist, sexist, lewd, or violent prompts are blocked, returning: `Sorry, I can't assist with that.`
- Model temperature is kept low for concise, helpful responses.

## Troubleshooting

- If the chat shows a generic fallback answer, the provider may be missing or rate-limited.
- Check server logs for `LLM error:` messages.
- Verify your API key is valid and set in environment.

## Where is the code?

- Frontend widget: `public/js/ai-chat.js`
- Backend route: `/api/chat` in `server.js`
- Provider wrapper: `tools/llm.js`
