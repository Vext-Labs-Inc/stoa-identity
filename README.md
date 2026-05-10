# @stoa/identity

Agent identity primitives for the Stoa open substrate. Implements hive-issued JWTs (`did:web` issuance and verification), DID document resolution, reputation log (Certificate Transparency-style), and model attestation (TEE attestation stubs for Phala, Marlin, and AWS Nitro).

Stoa is the open standard for agent-readable SaaS. Every agent presents a JWT signed by its **hive** when calling a Stoa-conformant capability. This package is the reference implementation of that identity layer.

Spec: [STOA.md §8 — Identity, DIDs, hives, JWTs, reputation](https://github.com/stoa-spec/stoa-spec)

---

## Install

```bash
npm install @stoa/identity jose zod
```

---

## Usage

### Mint a hive JWT

```ts
import { mintHiveJwt } from "@stoa/identity";
import { generateKeyPair } from "jose";

const { privateKey } = await generateKeyPair("ES256");

const token = await mintHiveJwt(
  {
    iss: "did:web:hive.vext.ai",
    sub: "agent:vext:cyber-7:8492",
    aud: "did:web:hubspot.com",
    scope: ["caps:hubspot.contacts.*"],
    rep_class: "tier-3",
    jit_policy: "ttl=300s,bind=ip+ja3",
    exp: Math.floor(Date.now() / 1000) + 300,
    iat: Math.floor(Date.now() / 1000),
    cnf: { jwk: { kty: "EC", crv: "P-256", x: "...", y: "..." } },
  },
  privateKey
);
```

### Verify an inbound agent JWT (vendor side)

```ts
import { verifyHiveJwt } from "@stoa/identity";

const { payload } = await verifyHiveJwt(token, {
  accepted_issuers: ["did:web:hive.vext.ai", "did:web:anthropic.com"],
  audience: "did:web:hubspot.com",
  // resolve_did: true (default) — fetches the issuer's DID document to get the public key
});

console.log(payload.rep_class);      // "tier-3"
console.log(payload.model_attestation?.model_id); // "theron-cyber-v71a"
```

### Resolve a hive's DID document

```ts
import { resolveDid } from "@stoa/identity";

const doc = await resolveDid("did:web:hive.vext.ai");
// => fetches https://hive.vext.ai/.well-known/did.json
```

### Reputation log

```ts
import { appendReputation, getReputation } from "@stoa/identity";

await appendReputation({
  hive_did: "did:web:hive.vext.ai",
  cap_urn: "urn:stoa:cap:hubspot.contacts.create@2.3.1",
  receipt_id: "rcpt_01HK...",
  outcome: "accepted",
  ts: Math.floor(Date.now() / 1000),
});

const summary = await getReputation("did:web:hive.vext.ai");
console.log(summary?.rep_score); // 99.7
console.log(summary?.rep_class); // "tier-3"
```

### Model attestation

```ts
import { verifyModelAttestation, requiresTeeAttestation } from "@stoa/identity";

const result = await verifyModelAttestation({
  model_id: "theron-cyber-v71a",
  model_hash: "sha256:0xab...",
  system_prompt_hash: "sha256:0xcd...",
  tee_provider: "none",
});

// Vendor policy: finance.* caps require TEE attestation
if (requiresTeeAttestation("finance") && !result.is_tee_rooted) {
  throw new Error("TEE attestation required for finance capabilities");
}
```

---

## The hive JWT (STOA.md §8.1)

The full payload schema (all fields match §8.1 exactly):

| Field | Type | Description |
|---|---|---|
| `iss` | `did:web:*` | Issuing hive's DID |
| `sub` | string | Agent identifier |
| `aud` | `did:web:*` | Vendor DID (audience) |
| `scope` | string[] | Capability scope claims |
| `rep_class` | tier-1..5 / bootstrap | Hive reputation class |
| `jit_policy` | string | JIT token binding policy |
| `exp` / `iat` | number | Unix timestamps |
| `cnf` | object | Proof-of-possession JWK |
| `act_as` | object | Delegated human identity |
| `model_attestation` | object | TEE or signed model claim |

---

## Links

- Stoa spec: https://github.com/stoa-spec/stoa-spec
- STOA.md §8: Identity — DIDs, hives, JWTs, reputation
- stoa-bus: https://github.com/Vext-Labs-Inc/stoa-bus
- stoa-conformance: https://github.com/Vext-Labs-Inc/stoa-conformance

---

## License

Apache-2.0. Copyright 2026 Vext Labs Inc.

The Stoa spec is CC-BY-4.0. This runtime package is Apache-2.0.
Everything is open source, forever. See [STOA.md §2](https://github.com/stoa-spec/stoa-spec).
