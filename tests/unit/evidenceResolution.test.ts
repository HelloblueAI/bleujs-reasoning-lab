import { describe, expect, it } from "vitest";
import {
  EVIDENCE_RESOLUTION_ITEMS,
  EVIDENCE_UNSUPPORTED,
} from "@/evals/benchmarks/datasets";
import {
  formatEvidenceResolutionPrompt,
  gradeEvidenceResolutionAnswer,
  resolveEvidenceByPolicy,
} from "@/evals/benchmarks/evidenceResolution";
import { MODEL_BENCHMARK_SPECS } from "@/evals/benchmarks/modelRunner";

function fixture(id: string) {
  const item = EVIDENCE_RESOLUTION_ITEMS.find(
    (candidate) => candidate.id === id,
  );
  if (!item) throw new Error(`Missing evidence fixture ${id}`);
  return item;
}

describe("evidence resolution fixtures", () => {
  it("grades the policy oracle against every fixture example", () => {
    for (const item of EVIDENCE_RESOLUTION_ITEMS) {
      const got = resolveEvidenceByPolicy(item);
      expect(gradeEvidenceResolutionAnswer(got, item).passed, item.id).toBe(
        true,
      );
    }
  });

  it("does not let a newer unofficial source override course-staff evidence", () => {
    const item = fixture("chem-lab-authority-over-recency");

    expect(
      gradeEvidenceResolutionAnswer(
        "Bagley 154 because the course-staff syllabus is authoritative",
        item,
      ).passed,
    ).toBe(true);
    expect(gradeEvidenceResolutionAnswer("at Bagley 154", item).passed).toBe(
      true,
    );
    expect(gradeEvidenceResolutionAnswer("Bagley 131", item).passed).toBe(
      false,
    );
    expect(gradeEvidenceResolutionAnswer("at Bagley 131", item).passed).toBe(
      false,
    );
  });

  it("prefers current course-staff evidence over an archived answer", () => {
    const item = fixture("data-office-current-vs-archived");

    expect(gradeEvidenceResolutionAnswer("Smith 205", item).passed).toBe(true);
    expect(gradeEvidenceResolutionAnswer("in Smith 205", item).passed).toBe(
      true,
    );
    expect(gradeEvidenceResolutionAnswer("Savery 260", item).passed).toBe(
      false,
    );
    expect(gradeEvidenceResolutionAnswer("in Savery 260", item).passed).toBe(
      false,
    );
  });

  it("requires abstention when comparable current authority conflicts", () => {
    const item = fixture("microgrant-unresolved-authority-conflict");

    expect(
      gradeEvidenceResolutionAnswer(
        `${EVIDENCE_UNSUPPORTED} because the two department pages conflict`,
        item,
      ).passed,
    ).toBe(true);
    expect(gradeEvidenceResolutionAnswer("November 15", item).passed).toBe(
      false,
    );
    expect(gradeEvidenceResolutionAnswer("December 1", item).passed).toBe(
      false,
    );
  });

  it("accepts explicitly superseding evidence and rejects the superseded answer", () => {
    const item = fixture("robotics-superseding-correction");

    expect(gradeEvidenceResolutionAnswer("Card Access Form", item).passed).toBe(
      true,
    );
    expect(
      gradeEvidenceResolutionAnswer("the Card Access Form", item).passed,
    ).toBe(true);
    expect(gradeEvidenceResolutionAnswer("Key Request Form", item).passed).toBe(
      false,
    );
    expect(
      gradeEvidenceResolutionAnswer("the Key Request Form", item).passed,
    ).toBe(false);
    expect(
      gradeEvidenceResolutionAnswer("not the Card Access Form", item).passed,
    ).toBe(false);
    expect(
      gradeEvidenceResolutionAnswer(
        "the Card Access Form is not required",
        item,
      ).passed,
    ).toBe(false);
    expect(
      gradeEvidenceResolutionAnswer(EVIDENCE_UNSUPPORTED, item).passed,
    ).toBe(false);
  });

  it("shows the authority and time assumptions in the model prompt", () => {
    const prompt = formatEvidenceResolutionPrompt(
      fixture("chem-lab-authority-over-recency"),
    );

    expect(prompt).toContain("do not choose a newer unofficial source");
    expect(prompt).toContain("If comparable current authoritative sources");
    expect(prompt).toContain("authority: course-staff");
    expect(prompt).toContain("issued_at: 2026-09-03");
  });

  it("is included in the model-in-the-loop benchmark list", () => {
    expect(MODEL_BENCHMARK_SPECS.map((makeSpec) => makeSpec().id)).toContain(
      "evidence-resolution",
    );
  });
});
