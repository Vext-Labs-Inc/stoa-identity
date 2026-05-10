/**
 * Stoa Identity — JWT minting and verification.
 *
 * Hive-issued JWTs as specified in STOA.md §8.1.
 * Uses the `jose` library for all cryptographic operations (ES256 / EdDSA).
 *
 * Spec references:
 *   - STOA.md §8.1 (JWT payload shape)
 *   - STOA.md §8.2 (issuer allowlist)
 *   - STOA.md §8.4 (revocation via short-lived tokens)
 *   - STOA.md §8.5 (key rotation via did:web)
 */

import {
  SignJWT,
  jwtVerify,
  importJWK,
  type KeyLike,
  type JWTPayload,
} from "jose";
import { type HiveJwtPayload, HiveJwtPayloadSchema } from "./types.js";
import { resolveDid, extractPublicKey } from "./did.js";

// ---------------------------------------------------------------------------
// Minting
// ---------------------------------------------------------------------------

export interface MintOptions {
  /**
   * Key ID to embed in the JWT header (kid).
   * Should match a verificationMethod id in the issuer's DID document.
   */
  kid?: string;
  /** Signing algorithm. Defaults to "ES256". */
  alg?: "ES256" | "EdDSA" | "ES384" | "ES512";
}

/**
 * Mint a hive-issued JWT.
 *
 * @param claims - The payload. Must satisfy HiveJwtPayloadSchema.
 * @param signingKey - A KeyLike private key (e.g. from importPKCS8 or generateKeyPair).
 * @param opts - Optional mint configuration.
 * @returns Compact JWT string (header.payload.signature)
 */
export async function mintHiveJwt(
  claims: HiveJwtPayload,
  signingKey: KeyLike,
  opts: MintOptions = {}
): Promise<string> {
  // Validate claims against spec schema before signing
  const parsed = HiveJwtPayloadSchema.safeParse(claims);
  if (!parsed.success) {
    throw new Error(
      `Invalid hive JWT claims: ${parsed.error.message}`
    );
  }

  const alg = opts.alg ?? "ES256";

  // Extract standard JWT fields and treat the rest as additional claims
  const { iss, sub, aud, exp, iat, ...additionalClaims } = parsed.data;

  const builder = new SignJWT(additionalClaims as JWTPayload)
    .setProtectedHeader({ alg, ...(opts.kid ? { kid: opts.kid } : {}) })
    .setIssuer(iss)
    .setSubject(sub)
    .setAudience(aud)
    .setIssuedAt(iat)
    .setExpirationTime(exp);

  return builder.sign(signingKey);
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export interface VerifyOptions {
  /**
   * List of accepted issuer DIDs. The JWT's `iss` must be in this list.
   * Pass an empty array to skip issuer allowlist check (not recommended for production).
   */
  accepted_issuers: string[];
  /**
   * The audience the verifying party expects. Must match `aud` in the token.
   * Typically the vendor's DID (did:web:<host>).
   */
  audience: string;
  /**
   * If true, fetch and use the issuer's DID document to verify the signature.
   * If false, a raw JWK must be passed via `issuer_jwk`.
   * Defaults to true.
   */
  resolve_did?: boolean;
  /**
   * Raw issuer JWK to use for verification (skips DID resolution).
   * Only used when resolve_did is false.
   */
  issuer_jwk?: Record<string, unknown>;
  /**
   * Maximum clock skew to tolerate in seconds. Defaults to 30s.
   */
  clock_tolerance?: number;
}

export interface VerifyResult {
  payload: HiveJwtPayload;
  /** The issuer DID that was accepted. */
  issuer: string;
}

/**
 * Verify a hive-issued JWT.
 *
 * Steps:
 *   1. Decode header to find issuer and key ID
 *   2. Check issuer is in accepted_issuers
 *   3. Resolve issuer's DID document (unless issuer_jwk provided)
 *   4. Verify signature, expiry, and audience
 *   5. Validate payload against HiveJwtPayloadSchema
 *
 * @param token - Compact JWT string
 * @param opts - Verification options
 * @returns Verified payload
 * @throws {Error} On any verification failure
 */
export async function verifyHiveJwt(
  token: string,
  opts: VerifyOptions
): Promise<VerifyResult> {
  const clockTolerance = opts.clock_tolerance ?? 30;
  const resolveDidFlag = opts.resolve_did !== false;

  // --- Step 1: Decode header without verifying (to read iss/kid) ---
  // jose's jwtVerify does this internally, but we need the iss before loading the key
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed JWT: expected 3 dot-separated parts");
  }

  let payload: JWTPayload;
  try {
    const rawPayload = Buffer.from(parts[1] ?? "", "base64url").toString("utf8");
    payload = JSON.parse(rawPayload) as JWTPayload;
  } catch {
    throw new Error("Malformed JWT: could not decode payload");
  }

  const iss = payload["iss"];
  if (typeof iss !== "string") {
    throw new Error("JWT missing iss claim");
  }

  // --- Step 2: Issuer allowlist check ---
  if (
    opts.accepted_issuers.length > 0 &&
    !opts.accepted_issuers.includes(iss)
  ) {
    throw new Error(
      `JWT issuer ${iss} is not in the accepted issuers list`
    );
  }

  // --- Step 3: Obtain verification key ---
  let verifyKey: KeyLike;

  if (!resolveDidFlag && opts.issuer_jwk) {
    verifyKey = await importJWK(opts.issuer_jwk) as KeyLike;
  } else {
    // Resolve DID document and extract public key
    let header: Record<string, unknown> = {};
    try {
      const rawHeader = Buffer.from(parts[0] ?? "", "base64url").toString("utf8");
      header = JSON.parse(rawHeader) as Record<string, unknown>;
    } catch {
      // Ignore header decode failure — kid is optional
    }

    const didDoc = await resolveDid(iss);
    const kid = typeof header["kid"] === "string" ? header["kid"] : undefined;
    const jwk = extractPublicKey(didDoc, kid);
    verifyKey = await importJWK(jwk) as KeyLike;
  }

  // --- Step 4: Verify signature, expiry, audience ---
  let verifyResult: Awaited<ReturnType<typeof jwtVerify>>;
  try {
    verifyResult = await jwtVerify(token, verifyKey, {
      audience: opts.audience,
      clockTolerance,
    });
  } catch (err) {
    throw new Error(`JWT verification failed: ${String(err)}`);
  }

  // --- Step 5: Validate payload shape against Stoa schema ---
  const schemaParse = HiveJwtPayloadSchema.safeParse(verifyResult.payload);
  if (!schemaParse.success) {
    throw new Error(
      `JWT payload does not match HiveJwtPayloadSchema: ${schemaParse.error.message}`
    );
  }

  return {
    payload: schemaParse.data,
    issuer: iss,
  };
}
