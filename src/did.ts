/**
 * Stoa Identity — did:web resolution.
 *
 * v0 implementation: resolves did:web by fetching the DID document from
 * the well-known URL on the host. Production implementations should add
 * caching, signature verification, and fallback handling.
 *
 * Spec reference: STOA.md §8.5 (key rotation / DID document caching)
 */

import { DidDocumentSchema, type DidDocument } from "./types.js";

/**
 * Resolve a did:web DID to its DID document.
 *
 * Resolution algorithm (W3C did:web spec):
 *   did:web:<host>          -> https://<host>/.well-known/did.json
 *   did:web:<host>:<path>   -> https://<host>/<path>/did.json
 *
 * @param did - A did:web DID string, e.g. "did:web:hive.vext.ai"
 * @returns The parsed and validated DID document
 * @throws {Error} If the DID is not a did:web DID, the document cannot be
 *   fetched, or the document fails schema validation
 */
export async function resolveDid(did: string): Promise<DidDocument> {
  if (!did.startsWith("did:web:")) {
    throw new Error(`Unsupported DID method: ${did}. Only did:web is supported.`);
  }

  const withoutPrefix = did.slice("did:web:".length);
  // did:web uses colons as path separators; percent-encode colons back to slashes
  const parts = withoutPrefix.split(":");
  const host = decodeURIComponent(parts[0] ?? "");

  if (!host) {
    throw new Error(`Invalid did:web DID — no host: ${did}`);
  }

  let url: string;
  if (parts.length === 1) {
    url = `https://${host}/.well-known/did.json`;
  } else {
    const path = parts.slice(1).map(decodeURIComponent).join("/");
    url = `https://${host}/${path}/did.json`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json, application/did+json",
      },
    });
  } catch (err) {
    throw new Error(
      `Failed to fetch DID document for ${did} from ${url}: ${String(err)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `DID document fetch returned HTTP ${response.status} for ${url}`
    );
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (err) {
    throw new Error(`DID document at ${url} is not valid JSON: ${String(err)}`);
  }

  const parsed = DidDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `DID document at ${url} failed schema validation: ${parsed.error.message}`
    );
  }

  // Verify the document's id matches the requested DID
  if (parsed.data.id !== did) {
    throw new Error(
      `DID document id mismatch: requested ${did}, got ${parsed.data.id}`
    );
  }

  return parsed.data;
}

/**
 * Extract the first public key JWK from a DID document's verificationMethod.
 * Used by verifyHiveJwt to find the right key.
 *
 * @param doc - A resolved DID document
 * @param keyId - Optional key ID fragment (e.g. "#key-1") to select a specific key
 * @returns The JWK public key object
 */
export function extractPublicKey(
  doc: DidDocument,
  keyId?: string
): Record<string, unknown> {
  const methods = doc.verificationMethod ?? [];

  if (methods.length === 0) {
    throw new Error(`DID document ${doc.id} has no verificationMethod entries`);
  }

  const method = keyId
    ? methods.find((m) => m.id === keyId || m.id === `${doc.id}${keyId}`)
    : methods[0];

  if (!method) {
    throw new Error(
      `No verificationMethod matching keyId "${keyId}" in ${doc.id}`
    );
  }

  if (!method.publicKeyJwk) {
    throw new Error(
      `verificationMethod ${method.id} has no publicKeyJwk — ` +
        "only JWK keys are supported in v0"
    );
  }

  return method.publicKeyJwk;
}
