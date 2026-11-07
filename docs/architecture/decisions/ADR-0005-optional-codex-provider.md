# ADR-0005: Optional Codex provider through the app-server boundary

- **Status:** Proposed, gated on current terms and auth-registration validation.
- **Date:** 2026-11-07.

## Context

The product asks for an embedded assistant using the user's subscription, with streaming, document context, tools, preview, and explicit approval. A local desktop app must not ship a shared API key or require AI to edit documents.

## Options

1. Sign in with ChatGPT OAuth and Codex app-server for eligible plan usage.
2. OpenAI Platform API key supplied by each user.
3. A hosted PeerCanvas proxy with centrally held credentials.
4. Provider abstraction with a default optional Codex adapter and later alternatives.

## Decision

Design for an optional provider abstraction and investigate Sign in with ChatGPT OAuth plus the Codex app-server as the first provider. Do not implement authentication until OpenAI registration, eligibility, current preview limitations, callback UX, token storage, and terms are verified. BYOK may be a separate later adapter; no hosted shared-key proxy is planned.

## Rationale and consequences

Official OpenAI documentation describes a plan-usage path for eligible open-source/local applications and a Codex app-server integration. The preview has restrictions such as streaming with storage disabled and unsupported hosted tools. The design must not promise all Codex capabilities or access to ChatGPT history.

## Risks and validation

WP-09 must verify the official flow on each OS, native token storage, host identity, refresh/sign-out, supported model discovery, error/usage-limit handling, request restrictions, and current legal/registration terms. The provider must be disableable without affecting local editing.

## Sources

- [Sign in with ChatGPT plan usage](https://developers.openai.com/siwc/token-sharing-open-source)
- [Codex app-server OAuth integration](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server)
- [Preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)
