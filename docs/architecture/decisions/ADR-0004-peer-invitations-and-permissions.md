# ADR-0004: Capability links with host-controlled peer admission

- **Status:** Proposed, gated on threat-model review and WP-08.
- **Date:** 2026-11-07.

## Context

The product asks for private temporary sessions without centralized identity. A session link must permit invitation but must not be mistaken for identity or complete authorization. Peer content can already have been copied after access is granted.

## Options

1. High-entropy bearer secret, expiry, host admission, role checks, and revocation.
2. A public room identifier with no secret or admission.
3. Require accounts and a central identity server.

## Decision

Plan a high-entropy capability invitation with host approval, expiry, viewer/editor roles, and revocation. Place the secret in the URL fragment or equivalent local handoff so ordinary HTTP requests do not transmit it. Enforce role permissions at the document command boundary. Do not add centralized identity for the first release.

## Rationale and consequences

This matches a temporary peer session while keeping the app usable locally. Revocation can block future access, not erase data already received. Encryption, room-key derivation, Yjs validation, relay metadata, deep-link parsing, and read-only enforcement require a protocol design before implementation.

## Risks and validation

Do not treat Trystero room names as authorization. WP-08 must validate expiry, denial, role enforcement through every mutation path, host loss, secret redaction, and the cryptographic protocol with security review.
