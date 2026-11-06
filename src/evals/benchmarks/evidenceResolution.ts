import {
  EVIDENCE_UNSUPPORTED,
  type EvidenceResolutionItem,
  type EvidenceSource,
} from "./datasets";

const AUTHORITY_RANK: Record<EvidenceSource["authority"], number> = {
  official: 3,
  "course-staff": 3,
  department: 3,
  unofficial: 1,
};

function normalizedAnswer(raw: string): string {
  let value = raw
    .replace(/\*\*/g, "")
    .replace(/^final:\s*/i, "")
    .replace(/^answer:\s*/i, "")
    .trim();

  value = value
    .split(/\s+(?:because|since|as)\s+/i)[0]!
    .split(/\s+[|-]\s+/)[0]!
    .replace(/^["'`]+|["'`.]+$/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

  if (
    value === EVIDENCE_UNSUPPORTED ||
    value === "INSUFFICIENT" ||
    value === "CANNOT DETERMINE" ||
    value === "CAN'T DETERMINE" ||
    value === "UNKNOWN"
  ) {
    return EVIDENCE_UNSUPPORTED;
  }

  return value;
}

export function gradeEvidenceResolutionAnswer(
  answer: string,
  item: EvidenceResolutionItem,
): { passed: boolean; got: string } {
  const got = normalizedAnswer(answer);
  const expected = normalizedAnswer(item.expected);
  return { passed: got === expected, got: got || answer };
}

export function formatEvidenceResolutionPrompt(
  item: EvidenceResolutionItem,
): string {
  const evidence = item.sources
    .map((source, index) => {
      const supersedes =
        source.supersedes && source.supersedes.length > 0
          ? `, supersedes: ${source.supersedes.join(", ")}`
          : "";
      return (
        `${index + 1}. [${source.id}] ${source.title}\n` +
        `   authority: ${source.authority}, issued_at: ${source.issuedAt}, ` +
        `status: ${source.status}${supersedes}\n` +
        `   claim: ${source.claim}`
      );
    })
    .join("\n\n");

  return (
    `Question: ${item.question}\n\n` +
    `Evidence:\n${evidence}\n\n` +
    `Resolution rules:\n` +
    `- Use only the evidence above; do not use outside knowledge.\n` +
    `- A current authoritative source beats an archived copy in the same lineage.\n` +
    `- Explicit supersedes metadata overrides the superseded source.\n` +
    `- Higher-authority sources beat lower-authority sources; do not choose a newer unofficial source just because it is newer.\n` +
    `- If comparable current authoritative sources conflict and no source resolves it, answer ${EVIDENCE_UNSUPPORTED}.\n\n` +
    `Return the exact answer value, or ${EVIDENCE_UNSUPPORTED}.`
  );
}

export function resolveEvidenceByPolicy(item: EvidenceResolutionItem): string {
  const superseded = new Set(
    item.sources.flatMap((source) => source.supersedes ?? []),
  );
  const candidates = item.sources.filter(
    (source) =>
      source.answer !== null &&
      source.status === "current" &&
      !superseded.has(source.id),
  );
  if (candidates.length === 0) return EVIDENCE_UNSUPPORTED;

  const maxAuthority = Math.max(
    ...candidates.map((source) => AUTHORITY_RANK[source.authority]),
  );
  const strongest = candidates.filter(
    (source) => AUTHORITY_RANK[source.authority] === maxAuthority,
  );
  const answers = new Set(strongest.map((source) => source.answer));

  return answers.size === 1
    ? (strongest[0]?.answer ?? EVIDENCE_UNSUPPORTED)
    : EVIDENCE_UNSUPPORTED;
}
