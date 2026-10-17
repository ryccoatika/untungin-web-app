import { ANALYSIS_RESPONSE_SCHEMA, refsFromSnapshot, sanitizeOutput, type AnalysisOutput } from "./output";
import { systemInstruction, userPrompt } from "./prompt";
import { snapshotHash, type AnalysisSnapshot } from "./snapshot";

/** One structured-output call to the model; resolves to the raw JSON text. */
export type GenerateJson = (request: { system: string; prompt: string; schema: object }) => Promise<string>;

export type AnalyzeDeps = {
  /** snapshot_hash of this store's latest analysis, or null. */
  latestHash: () => Promise<string | null>;
  /** Takes one unit of today's quota; the usage id, or null when it is used up. */
  claimUsage: () => Promise<string | null>;
  refundUsage: (usageId: string) => Promise<void>;
  generate: GenerateJson;
  save: (row: { snapshotHash: string; snapshot: AnalysisSnapshot; output: AnalysisOutput }) => Promise<void>;
};

export type AnalyzeStatus = "created" | "cached" | "quota" | "failed";

/**
 * Spec §6.1 steps 2–7. The cache check comes first because an unchanged result costs nothing.
 * Any failure after the claim gives the quota back; nothing is saved.
 */
export async function runAnalysis(deps: AnalyzeDeps, snapshot: AnalysisSnapshot): Promise<AnalyzeStatus> {
  const hash = snapshotHash(snapshot);
  let usageId: string | null;
  try {
    if ((await deps.latestHash()) === hash) return "cached";
    usageId = await deps.claimUsage();
  } catch (error) {
    logFailure("before the AI call", error);
    return "failed";
  }
  if (!usageId) return "quota";

  try {
    const text = await deps.generate({
      system: systemInstruction(snapshot.locale),
      prompt: userPrompt(snapshot),
      schema: ANALYSIS_RESPONSE_SCHEMA,
    });
    const output = sanitizeOutput(JSON.parse(text), refsFromSnapshot(snapshot));
    if (!output) throw new Error("The AI answer does not match the output schema");
    await deps.save({ snapshotHash: hash, snapshot, output });
    return "created";
  } catch (error) {
    logFailure("during the AI call", error);
    await deps.refundUsage(usageId).catch((refundError) => logFailure("refunding the quota", refundError));
    return "failed";
  }
}

/** Logs only the error message: the snapshot and the answer hold the seller's data. */
function logFailure(stage: string, error: unknown) {
  console.error(`AI analysis failed ${stage}: ${error instanceof Error ? error.message : String(error)}`);
}
