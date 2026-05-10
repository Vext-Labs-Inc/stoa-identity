/**
 * Stoa Identity — type definitions.
 *
 * Zod schemas for the hive JWT payload as specified in STOA.md §8.1.
 * All field names match the spec exactly.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// DID Document (did:web resolution target)
// ---------------------------------------------------------------------------

export const VerificationMethodSchema = z.object({
  id: z.string(),
  type: z.string(),
  controller: z.string(),
  publicKeyJwk: z.record(z.unknown()).optional(),
  publicKeyMultibase: z.string().optional(),
});

export const ServiceSchema = z.object({
  id: z.string(),
  type: z.string(),
  serviceEndpoint: z.union([z.string(), z.record(z.unknown())]),
});

export const DidDocumentSchema = z.object({
  "@context": z.union([z.string(), z.array(z.string())]),
  id: z.string().regex(/^did:/),
  verificationMethod: z.array(VerificationMethodSchema).optional(),
  authentication: z
    .array(z.union([z.string(), VerificationMethodSchema]))
    .optional(),
  assertionMethod: z
    .array(z.union([z.string(), VerificationMethodSchema]))
    .optional(),
  keyAgreement: z
    .array(z.union([z.string(), VerificationMethodSchema]))
    .optional(),
  service: z.array(ServiceSchema).optional(),
  alsoKnownAs: z.array(z.string()).optional(),
});

export type DidDocument = z.infer<typeof DidDocumentSchema>;
export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;

// ---------------------------------------------------------------------------
// Model Attestation (STOA.md §8.7)
// ---------------------------------------------------------------------------

/** TEE provider the attestation originated from. */
export const TeeProviderSchema = z.enum(["phala", "marlin", "aws-nitro", "none"]);
export type TeeProvider = z.infer<typeof TeeProviderSchema>;

/**
 * Model attestation block embedded in the hive JWT.
 * For TEE-rooted hives this is a verifiable attestation; for non-TEE hives
 * it is a claim the hive signs and stakes reputation against.
 */
export const ModelAttestationSchema = z.object({
  /** Which model is running (e.g. "theron-cyber-v71a"). */
  model_id: z.string(),
  /**
   * Content hash of model weights or the TEE attestation quote.
   * Format: "sha256:0x<hex>" for weight hashes, "tee:<provider>:<quote_b64>" for TEE quotes.
   */
  model_hash: z.string(),
  /** Hash of the system prompt at session start. */
  system_prompt_hash: z.string(),
  /** TEE provider, if applicable. "none" for non-TEE hives. */
  tee_provider: TeeProviderSchema.default("none"),
});

export type ModelAttestation = z.infer<typeof ModelAttestationSchema>;

// ---------------------------------------------------------------------------
// Proof-of-Possession key binding (RFC 7800 / DPoP style)
// ---------------------------------------------------------------------------

export const CnfSchema = z.object({
  /** JWK public key bound to this token. */
  jwk: z.record(z.unknown()),
});

export type Cnf = z.infer<typeof CnfSchema>;

// ---------------------------------------------------------------------------
// act_as — delegated identity (STOA.md §8, SPEC_V0_1.md §7.3)
// ---------------------------------------------------------------------------

export const ActAsSchema = z.object({
  /** The human user on whose behalf the agent is acting. */
  user_id: z.string(),
  /**
   * Consent token proving the user authorised this delegation.
   * Typically an OIDC id_token or an Auth0 CIBA response.
   */
  consent_token: z.string(),
});

export type ActAs = z.infer<typeof ActAsSchema>;

// ---------------------------------------------------------------------------
// Reputation class (STOA.md §8.3)
// ---------------------------------------------------------------------------

export const RepClassSchema = z.enum([
  "tier-1",
  "tier-2",
  "tier-3",
  "tier-4",
  "tier-5",
  "bootstrap",
]);
export type RepClass = z.infer<typeof RepClassSchema>;

// ---------------------------------------------------------------------------
// JIT policy (just-in-time token binding) — STOA.md §8.1
// ---------------------------------------------------------------------------

/**
 * Compact string encoding the JIT policy.
 * Format: "ttl=<seconds>,bind=<bindings>" where bindings is a '+'-delimited list.
 * Example: "ttl=300s,bind=ip+ja3"
 */
export const JitPolicySchema = z.string().regex(/^ttl=\d+s?(,bind=[\w+]+)?$/);

// ---------------------------------------------------------------------------
// Hive JWT Payload (STOA.md §8.1) — the canonical schema
// ---------------------------------------------------------------------------

/**
 * The decoded payload of a hive-issued JWT.
 * Every field matches §8.1 of the Stoa master architecture spec exactly.
 */
export const HiveJwtPayloadSchema = z.object({
  /** Issuer — the hive's DID. Must be a did:web DID. */
  iss: z.string().regex(/^did:web:/),

  /**
   * Subject — stable identifier for the calling agent.
   * Pattern: "agent:<hive>:<role>:<instance_id>"
   */
  sub: z.string(),

  /**
   * Audience — the vendor's DID or host this token is scoped to.
   * Vendors MUST reject tokens whose aud does not match their DID.
   */
  aud: z.union([
    z.string().regex(/^did:web:/),
    z.array(z.string().regex(/^did:web:/)),
  ]),

  /**
   * Capability scopes the agent is claiming.
   * Pattern: "caps:<domain>.<resource>.<action>" (or with wildcard).
   */
  scope: z.array(z.string()),

  /** Reputation class of the issuing hive. Used for vendor policy enforcement. */
  rep_class: RepClassSchema,

  /**
   * JIT policy string. Controls token binding and TTL.
   * Default from spec: "ttl=300s,bind=ip+ja3"
   */
  jit_policy: JitPolicySchema,

  /** Token expiry (Unix seconds). Tokens SHOULD be short-lived (<=300s). */
  exp: z.number().int().positive(),

  /** Token issued-at (Unix seconds). */
  iat: z.number().int().positive(),

  /** Proof-of-possession key binding (RFC 7800). */
  cnf: CnfSchema.optional(),

  /** Delegated human identity. Present when agent acts on behalf of a user. */
  act_as: ActAsSchema.optional(),

  /** Model attestation block. Required for finance.* capabilities at L4. */
  model_attestation: ModelAttestationSchema.optional(),
});

export type HiveJwtPayload = z.infer<typeof HiveJwtPayloadSchema>;

// ---------------------------------------------------------------------------
// Reputation log entry (STOA.md §8.3)
// ---------------------------------------------------------------------------

export const ReputationPerClassSchema = z.record(z.number().min(0).max(100));

export const ReputationReceiptSchema = z.object({
  /** The hive whose reputation is being updated. */
  hive_did: z.string().regex(/^did:web:/),
  /** Capability URN the action was on. */
  cap_urn: z.string(),
  /** Unique receipt ID from the vendor. */
  receipt_id: z.string(),
  /** Whether the vendor accepted / disputed / refunded. */
  outcome: z.enum(["accepted", "disputed", "refunded"]),
  /** Unix timestamp of the receipt. */
  ts: z.number().int().positive(),
  /** Co-signature of the receipt from the agent. */
  agent_sig: z.string().optional(),
});

export const ReputationSummarySchema = z.object({
  hive_did: z.string().regex(/^did:web:/),
  total_actions: z.number().int().nonnegative(),
  disputed: z.number().int().nonnegative(),
  refunded: z.number().int().nonnegative(),
  /** Overall reputation score 0–100. tier-3 maps to >=99. */
  rep_score: z.number().min(0).max(100),
  rep_class: RepClassSchema,
  /** Per-capability-domain breakdown, e.g. { "crm.*": 99.7, "email.*": 98.9 } */
  per_class: ReputationPerClassSchema,
  /** ISO-8601 timestamp of the last update. */
  computed_at: z.string().datetime(),
});

export type ReputationReceipt = z.infer<typeof ReputationReceiptSchema>;
export type ReputationSummary = z.infer<typeof ReputationSummarySchema>;
