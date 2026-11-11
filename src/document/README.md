# Shared document core

`index.ts` is the canonical pure version 1 document model used by the demo and intended shared consumer. It owns runtime validation, parsing/migration, deterministic serialization, and atomic command execution. It has no clock, random ID source, storage, network, provider, renderer, or UI dependency; callers supply IDs and timestamps.

Import the named exports from `src/document/index.ts`. Call `createDocument` with externally generated UUID v4 identifiers and an ISO UTC timestamp. Use `validateDocument` for unknown runtime values, `parseDocument` for bounded JSON input, and `executeCommand` for every semantic mutation. `serializeDocument` validates before writing. Commands require the current expected revision and caller-supplied timestamp.
