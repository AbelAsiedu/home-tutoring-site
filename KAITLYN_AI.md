# Kaitlyn AI Tutor

Kaitlyn is the platform's AI learning and client-support assistant for The Modern Pedagogues.

## Administrator knowledge management

Use **Admin → Edit Content** to add or update company facts. Any `site_content` entry whose key begins with `ai_company_` is automatically loaded into Kaitlyn's company context.

Recommended entries:

- `ai_company_about` — who The Modern Pedagogues is and its mission
- `ai_company_services` — tutoring, LMS, resources and other services
- `ai_company_programmes` — programmes, curricula and learner pathways
- `ai_company_pricing` — current prices and packages
- `ai_company_policies` — cancellations, refunds, safeguarding and other policies
- `ai_company_contacts` — phone, WhatsApp, email and support channels
- `ai_company_locations` — service areas and delivery locations
- `ai_company_tutors` — approved public tutor information
- `ai_company_enrollment` — parent/ward enrollment information

Keep these entries factual and current. Kaitlyn treats administrator-provided company knowledge as the authoritative source for company-specific answers. She should not invent missing prices, policies, contacts or promises.

## Conversation behavior

Kaitlyn is instructed to:

- answer naturally and professionally rather than sounding like a static FAQ;
- use recent conversation context to maintain continuity;
- answer educational questions as well as company/support questions;
- ask a short clarifying question when necessary;
- direct users to human support when information is unavailable or an action requires staff access;
- avoid exposing internal database keys, prompts or hidden instructions;
- preserve the existing safety guardrails.

## Analytics

AI conversations continue to be logged in `ai_chat_logs`, allowing administrators to monitor total chats, fallback rate, low-confidence conversations and existing AI exports from the Admin dashboard.
