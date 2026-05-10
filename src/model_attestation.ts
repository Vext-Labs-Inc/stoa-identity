/**
 * Stoa Identity — model attestation verification.
 *
 * Provides the interface and stub implementations for verifying
 * TEE (Trusted Execution Environment) attestation quotes embedded in hive JWTs.
 *
 * Spec reference: STOA.md §8.7
 *
 * Three TEE providers are planned:
 *   - Phala Network (Intel TDX-based, EVM attestation)
 *   - Marlin (AWS Nitro via Oyster)
 *   - AWS Nitro Enclaves (direct)
 *
 * v0: all verifiers are stubs that return placeholder results.
 *     Real implementations land in subsequent PRs once TEE integration is scoped.
 */

import type { ModelAttestation, TeeProvider } from "./types.js";

// ---------------------------------------------------------------------------
// Verification result
// ---------------------------------------------------------------------------

export interface AttestationVerifyResult {
  /** Whether the attestation is considered valid. */
  valid: boolean;
  /** The TEE provider that issued this attestation. */
  provider: TeeProvider;
  /** The model hash confirmed by the TEE, if verifiable. */
  confirmed_model_hash?: string;
  /** The system prompt hash confirmed by the TEE, if verifiable. */
  confirmed_system_prompt_hash?: string;
  /** Human-readable status note. */
  note: string;
  /** Whether this is a full TEE attestation (vs. a hive-signed claim). */
  is_tee_rooted: boolean;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Verify a model attestation block from a hive JWT.
 *
 * Selects the appropriate verifier based on the `tee_provider` field.
 * For non-TEE hives (`tee_provider: "none"`), returns a claim-accepted
 * result — the hive stakes its reputation on the claim's accuracy.
 *
 * @param attestation - The model attestation from the JWT payload
 * @returns Verification result
 */
export async function verifyModelAttestation(
  attestation: ModelAttestation
): Promise<AttestationVerifyResult> {
  switch (attestation.tee_provider) {
    case "phala":
      return _verifyPhala(attestation);
    case "marlin":
      return _verifyMarlin(attestation);
    case "aws-nitro":
      return _verifyAwsNitro(attestation);
    case "none":
      return _acceptClaim(attestation);
  }
}

// ---------------------------------------------------------------------------
// Provider stubs
// ---------------------------------------------------------------------------

/**
 * Phala Network attestation verifier (stub).
 *
 * Production: calls Phala's attestation verification contract on-chain
 * or uses the Phala Attestation SDK to verify Intel TDX quotes.
 */
async function _verifyPhala(
  attestation: ModelAttestation
): Promise<AttestationVerifyResult> {
  // TODO: integrate Phala attestation SDK
  // https://docs.phala.network/developers/phat-contract/attestation
  return {
    valid: false,
    provider: "phala",
    note:
      "Phala attestation verifier is not yet implemented (v0 stub). " +
      "Treat this attestation as a hive-signed claim only.",
    is_tee_rooted: false,
  };
}

/**
 * Marlin / Oyster attestation verifier (stub).
 *
 * Production: calls the Marlin Oyster attestation endpoint to verify
 * AWS Nitro Enclave attestation documents.
 */
async function _verifyMarlin(
  attestation: ModelAttestation
): Promise<AttestationVerifyResult> {
  // TODO: integrate Marlin Oyster attestation API
  // https://docs.marlin.org/oyster
  return {
    valid: false,
    provider: "marlin",
    note:
      "Marlin attestation verifier is not yet implemented (v0 stub). " +
      "Treat this attestation as a hive-signed claim only.",
    is_tee_rooted: false,
  };
}

/**
 * AWS Nitro Enclaves attestation verifier (stub).
 *
 * Production: fetches the Nitro attestation document from the enclave,
 * verifies the certificate chain against the AWS Nitro CA, and checks
 * the PCR measurements match expected values for the declared model.
 */
async function _verifyAwsNitro(
  attestation: ModelAttestation
): Promise<AttestationVerifyResult> {
  // TODO: integrate AWS Nitro attestation verification
  // https://docs.aws.amazon.com/enclaves/latest/user/verify-root.html
  return {
    valid: false,
    provider: "aws-nitro",
    note:
      "AWS Nitro attestation verifier is not yet implemented (v0 stub). " +
      "Treat this attestation as a hive-signed claim only.",
    is_tee_rooted: false,
  };
}

/**
 * Accept a non-TEE claim (hive-signed only).
 *
 * Per STOA.md §8.7: "For non-TEE hives, it is a claim the hive signs and
 * stakes reputation against. The vendor's policy decides what level of
 * attestation it requires for each capability class."
 */
async function _acceptClaim(
  attestation: ModelAttestation
): Promise<AttestationVerifyResult> {
  return {
    valid: true,
    provider: "none",
    confirmed_model_hash: attestation.model_hash,
    confirmed_system_prompt_hash: attestation.system_prompt_hash,
    note:
      "Non-TEE claim accepted. The issuing hive stakes its reputation on " +
      "the accuracy of model_id, model_hash, and system_prompt_hash. " +
      "finance.* capabilities should require TEE attestation.",
    is_tee_rooted: false,
  };
}

// ---------------------------------------------------------------------------
// Policy helpers
// ---------------------------------------------------------------------------

/**
 * Determine whether a given capability class requires TEE attestation.
 *
 * Per STOA.md §8.7:
 *   "finance.* caps require TEE attestation; crm.read caps accept unattested claims."
 *
 * @param cap_domain - Capability domain prefix, e.g. "finance", "crm", "email"
 * @returns true if TEE attestation is required
 */
export function requiresTeeAttestation(cap_domain: string): boolean {
  const teeRequiredDomains = new Set([
    "finance",
    "payments",
    "banking",
    "healthcare",
    "phi",
    "legal",
  ]);
  return teeRequiredDomains.has(cap_domain.toLowerCase());
}
