/**
 * @stoa/identity — public API surface
 *
 * Stoa identity primitives: hive-issued JWTs (did:web issuance and verification),
 * DID resolution, reputation log, and model attestation.
 *
 * Spec reference: STOA.md §8 (Identity — DIDs, hives, JWTs, reputation)
 *
 * @example
 * ```ts
 * import { mintHiveJwt, verifyHiveJwt, resolveDid } from "@stoa/identity";
 *
 * // Mint a hive JWT
 * const token = await mintHiveJwt(claims, signingKey);
 *
 * // Verify a token from an inbound agent request
 * const { payload } = await verifyHiveJwt(token, {
 *   accepted_issuers: ["did:web:hive.vext.ai"],
 *   audience: "did:web:hubspot.com",
 * });
 *
 * // Resolve a hive's DID document
 * const doc = await resolveDid("did:web:hive.vext.ai");
 * ```
 */

// Types — re-export all public types and schemas
export type {
  DidDocument,
  VerificationMethod,
  ModelAttestation,
  TeeProvider,
  Cnf,
  ActAs,
  RepClass,
  HiveJwtPayload,
  ReputationReceipt,
  ReputationSummary,
} from "./types.js";

export {
  DidDocumentSchema,
  VerificationMethodSchema,
  ModelAttestationSchema,
  TeeProviderSchema,
  CnfSchema,
  ActAsSchema,
  RepClassSchema,
  JitPolicySchema,
  HiveJwtPayloadSchema,
  ReputationReceiptSchema,
  ReputationSummarySchema,
} from "./types.js";

// DID resolution
export { resolveDid, extractPublicKey } from "./did.js";

// JWT minting and verification
export type { MintOptions, VerifyOptions, VerifyResult } from "./jwt.js";
export { mintHiveJwt, verifyHiveJwt } from "./jwt.js";

// Reputation log
export {
  appendReputation,
  getReputation,
  listReceipts,
} from "./reputation.js";

// Model attestation
export type { AttestationVerifyResult } from "./model_attestation.js";
export {
  verifyModelAttestation,
  requiresTeeAttestation,
} from "./model_attestation.js";

// ---------------------------------------------------------------------------
// Package metadata
// ---------------------------------------------------------------------------

export const STOA_IDENTITY_VERSION = "0.1.0";
export const SPEC_VERSION = "stoa-0.1";
