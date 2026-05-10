/**
 * Stoa Identity — reputation log.
 *
 * Certificate Transparency-style append-only reputation log for hives.
 * Every vendor receipt is co-signed by the agent and posted here.
 * The foundation aggregates per-hive scores (STOA.md §8.3).
 *
 * v0: in-memory stub. Production backend: append-only log in Cloudflare R2
 *     + KV for aggregated summaries, with daily Merkle anchoring.
 */

import {
  type ReputationReceipt,
  type ReputationSummary,
  ReputationReceiptSchema,
  ReputationSummarySchema,
  type RepClass,
} from "./types.js";

// ---------------------------------------------------------------------------
// In-memory store (v0 stub)
// ---------------------------------------------------------------------------

const _log: ReputationReceipt[] = [];
const _summaries = new Map<string, ReputationSummary>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Append a reputation receipt to the log.
 *
 * In production this would:
 *   1. Validate the receipt signature (agent co-sig)
 *   2. Persist to an append-only log (R2 / Sigstore Rekor-style)
 *   3. Update the aggregated summary in KV
 *   4. Publish a delta to the live state bus for real-time dashboards
 *
 * @param receipt - The receipt to append
 */
export async function appendReputation(
  receipt: ReputationReceipt
): Promise<void> {
  const parsed = ReputationReceiptSchema.safeParse(receipt);
  if (!parsed.success) {
    throw new Error(
      `Invalid reputation receipt: ${parsed.error.message}`
    );
  }

  _log.push(parsed.data);
  _recomputeSummary(parsed.data.hive_did);
}

/**
 * Get the current reputation summary for a hive.
 *
 * @param hive_did - The hive's DID (e.g. "did:web:hive.vext.ai")
 * @returns Reputation summary, or null if the hive has no recorded receipts
 */
export async function getReputation(
  hive_did: string
): Promise<ReputationSummary | null> {
  const existing = _summaries.get(hive_did);
  if (existing) return existing;

  // v0: return mock data for known hives so callers have something to work with
  if (hive_did.startsWith("did:web:")) {
    return _mockSummary(hive_did);
  }

  return null;
}

/**
 * List all receipts for a given hive DID, ordered chronologically.
 *
 * @param hive_did - The hive's DID
 * @param limit - Maximum number of receipts to return. Defaults to 100.
 */
export async function listReceipts(
  hive_did: string,
  limit = 100
): Promise<ReputationReceipt[]> {
  return _log
    .filter((r) => r.hive_did === hive_did)
    .slice(-limit);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _recomputeSummary(hive_did: string): void {
  const receipts = _log.filter((r) => r.hive_did === hive_did);
  const total = receipts.length;
  const disputed = receipts.filter((r) => r.outcome === "disputed").length;
  const refunded = receipts.filter((r) => r.outcome === "refunded").length;

  // Simple reputation score: 100 * (1 - (disputed + refunded) / total)
  const badRate = total > 0 ? (disputed + refunded) / total : 0;
  const rep_score = parseFloat((100 * (1 - badRate)).toFixed(1));

  const rep_class: RepClass = _scoreToClass(rep_score);

  // Per-class breakdown by capability domain prefix
  const per_class: Record<string, number> = {};
  for (const r of receipts) {
    const domain = r.cap_urn.replace(/^urn:stoa:cap:/, "").split(".")[0] ?? "other";
    const key = `${domain}.*`;
    if (!per_class[key]) per_class[key] = 0;
    const bad = r.outcome !== "accepted" ? 1 : 0;
    const prev = per_class[key] ?? 100;
    // Exponential moving average
    per_class[key] = parseFloat((prev * 0.99 + (1 - bad) * 100 * 0.01).toFixed(1));
  }

  const summary = ReputationSummarySchema.parse({
    hive_did,
    total_actions: total,
    disputed,
    refunded,
    rep_score,
    rep_class,
    per_class,
    computed_at: new Date().toISOString(),
  });

  _summaries.set(hive_did, summary);
}

function _scoreToClass(score: number): RepClass {
  if (score >= 99.5) return "tier-3";
  if (score >= 98) return "tier-2";
  if (score >= 95) return "tier-1";
  if (score >= 90) return "tier-4";
  if (score >= 80) return "tier-5";
  return "bootstrap";
}

function _mockSummary(hive_did: string): ReputationSummary {
  // Mock data matching the example in STOA.md §8.3
  return ReputationSummarySchema.parse({
    hive_did,
    total_actions: 0,
    disputed: 0,
    refunded: 0,
    rep_score: 100,
    rep_class: "bootstrap",
    per_class: {},
    computed_at: new Date().toISOString(),
  });
}
