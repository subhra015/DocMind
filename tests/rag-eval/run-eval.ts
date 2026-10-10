/**
 * RAG Evaluation Harness — general purpose
 * ----------------------------------------
 * Works on ANY uploaded PDF in DocMind.
 *
 *   - If tests/rag-eval/questions.json exists and is non-empty, its
 *     questions are used.
 *   - Otherwise, Gemini auto-generates N questions from the document's
 *     own chunks.
 *
 * For each question, runs both pipelines and scores the answers 1–5:
 *   - "vector": vector-only similarity search (the OLD pipeline)
 *   - "hybrid": hybrid search + LLM rerank (the NEW pipeline)
 *
 * Usage:
 *   npx tsx tests/rag-eval/run-eval.ts
 *
 * Optional env vars (in .env.local):
 *   EVAL_DOCUMENT_ID=<uuid>       skip the interactive picker
 *   EVAL_QUESTIONS_COUNT=5        number of auto-generated questions
 *   GEMINI_CHAT_MODEL=gemini-2.0-flash
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

import { createSupabaseServiceClient } from "../../src/lib/supabase/server";
import {
  embedTexts,
  getEmbeddingConfig,
  getGeminiClient,
} from "../../src/lib/embeddings/gemini";
import {
  matchChunks,
  hybridSearchChunks,
  type MatchResult,
} from "../../src/lib/rag/retrieval";
import { rerankChunks } from "../../src/lib/rag/rerank";
import { buildRAGPrompt } from "../../src/lib/rag/prompt";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface QA {
  question: string;
  expected_answer: string;
}

interface ScoredQA extends QA {
  vector_answer: string;
  vector_score: number;
  hybrid_answer: string;
  hybrid_score: number;
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const CHAT_MODEL =
  process.env.GEMINI_CHAT_MODEL ?? "gemini-2.0-flash";

const AUTO_QUESTIONS_COUNT = parseInt(
  process.env.EVAL_QUESTIONS_COUNT ?? "5",
  10
);

const QUESTIONS_FILE = join(
  process.cwd(),
  "tests",
  "rag-eval",
  "questions.json"
);

const RESULTS_FILE = join(
  process.cwd(),
  "tests",
  "rag-eval",
  "results.json"
);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function pickDocument(
  supabase: any
): Promise<{ id: string; filename: string; user_id: string }> {
  // 1) If EVAL_DOCUMENT_ID is set, use it directly.
  if (process.env.EVAL_DOCUMENT_ID) {
    const { data, error } = await supabase
      .from("documents")
      .select("id, filename, user_id")
      .eq("id", process.env.EVAL_DOCUMENT_ID)
      .single();
    if (error || !data) {
      throw new Error(
        `EVAL_DOCUMENT_ID="${process.env.EVAL_DOCUMENT_ID}" not found.`
      );
    }
    return data;
  }

  // 2) Otherwise, list recent documents and ask interactively.
  const { data: docs, error } = await supabase
    .from("documents")
    .select("id, filename, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  if (!docs || docs.length === 0) {
    throw new Error(
      "No documents uploaded yet. Upload a PDF in the DocMind app first."
    );
  }

  console.log("\n📄 Available documents:\n");
  docs.forEach((d: any, i: number) => {
    console.log(`  [${i + 1}] ${d.filename}`);
    console.log(`      id: ${d.id}\n`);
  });

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const choice = await rl.question("Pick a document number: ");
  rl.close();

  const idx = parseInt(choice.trim(), 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= docs.length) {
    throw new Error("Invalid choice.");
  }
  return {
    id: docs[idx].id,
    filename: docs[idx].filename,
    user_id: docs[idx].user_id,
  };
}

async function loadQuestionsFile(): Promise<QA[] | null> {
  if (!existsSync(QUESTIONS_FILE)) return null;
  try {
    const raw = readFileSync(QUESTIONS_FILE, "utf-8").trim();
    if (!raw || raw === "[]") return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as QA[];
  } catch {
    return null;
  }
}

async function generateQuestions(
  chunks: MatchResult[],
  count: number
): Promise<QA[]> {
  const ai = getGeminiClient();
  const excerpts = chunks
    .slice(0, 25)
    .map((c, i) => `[${i + 1}] ${c.content.slice(0, 600)}`)
    .join("\n\n---\n\n");

  const prompt = `You are creating an evaluation set for a document Q&A system.

Below are excerpts from a single document. Generate exactly ${count} factual question-answer pairs that:
- Have a single, verifiable answer contained in the excerpts
- Are specific (mention names, dates, numbers where relevant)
- Cover different parts of the document
- Are NOT yes/no questions

Return ONLY a JSON array of objects with "question" and "expected_answer" fields. No prose, no markdown fences.

Example:
[
  { "question": "What year was the company founded?", "expected_answer": "2015" },
  { "question": "Who is the CEO?", "expected_answer": "Jane Smith" }
]

Document excerpts:
${excerpts}`;

  const response = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const text = response.text ?? "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    throw new Error(
      "Could not parse generated questions. Raw response:\n" +
        text.slice(0, 400)
    );
  }

  const parsed = JSON.parse(match[0]) as QA[];
  return parsed.filter(
    (q) => q.question && q.expected_answer && q.expected_answer.length > 0
  );
}

async function generateAnswer(
  question: string,
  chunks: MatchResult[]
): Promise<string> {
  const ai = getGeminiClient();
  const { systemPrompt, userPrompt } = buildRAGPrompt(question, chunks);

  const response = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents: [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Understood." }] },
      { role: "user", parts: [{ text: userPrompt }] },
    ],
  });

  return (response.text ?? "").trim();
}

async function judge(
  question: string,
  expected: string,
  actual: string
): Promise<number> {
  const ai = getGeminiClient();
  const prompt = `You are grading a document Q&A system's answer against a ground-truth reference.

Question: ${question}
Reference answer: ${expected}
System answer: ${actual}

Score the system answer on a 1–5 scale:
5 = fully correct and complete
4 = correct but missing minor detail
3 = partially correct
2 = mostly wrong but related
1 = completely wrong or irrelevant

Return ONLY a single digit (1, 2, 3, 4, or 5).`;

  const response = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
  const txt = (response.text ?? "").trim();
  return parseInt(txt.match(/[1-5]/)?.[0] ?? "0", 10) || 0;
}

async function embedQuery(text: string): Promise<number[]> {
  const results = await embedTexts([text], getEmbeddingConfig());
  const first = results[0] as any;
  return first?.embedding ?? first?.vector ?? first?.values ?? [];
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log("🧪  DocMind RAG Evaluation Harness\n");

  const supabase = createSupabaseServiceClient();

  // 1. Pick a document
  const doc = await pickDocument(supabase);
  console.log(`\n✅ Using document: ${doc.filename}`);
  console.log(`   id: ${doc.id}\n`);

  // 2. Fetch chunks for that document
  const { data: chunks, error: chunksError } = await supabase
    .from("chunks")
    .select("id, document_id, content, page_number, chunk_index, metadata")
    .eq("document_id", doc.id)
    .limit(50);

  if (chunksError) throw chunksError;
  if (!chunks || chunks.length === 0) {
    throw new Error(
      "No chunks found for this document. Wait for processing to finish."
    );
  }
  console.log(`📚 Loaded ${chunks.length} chunks from the document.\n`);

  // 3. Get questions
  let questions = await loadQuestionsFile();
  if (questions) {
    console.log(
      `📝 Using ${questions.length} questions from tests/rag-eval/questions.json.\n`
    );
  } else {
    console.log(
      `🤖 Auto-generating ${AUTO_QUESTIONS_COUNT} questions from the document's own content…\n`
    );
    questions = await generateQuestions(chunks as any, AUTO_QUESTIONS_COUNT);
    if (questions.length === 0) {
      throw new Error("Auto-generation returned zero valid questions.");
    }
    console.log(`   Generated ${questions.length} questions.\n`);
  }

  // 4. Run both pipelines on each question
  const results: ScoredQA[] = [];

  for (let i = 0; i < questions.length; i++) {
    const qa = questions[i];
    console.log(`──────────────────────────────────────`);
    console.log(`[${i + 1}/${questions.length}] ${qa.question}`);
    console.log(`   expected: ${qa.expected_answer}`);

    const queryEmbedding = await embedQuery(qa.question);

    // --- Vector-only pipeline ---
    let vectorAnswer = "";
    let vectorScore = 0;
    try {
      const vectorChunks = await matchChunks(
        supabase,
        queryEmbedding,
        doc.user_id,
        doc.id,
        5,
        0.0
      );
      vectorAnswer = await generateAnswer(qa.question, vectorChunks);
      vectorScore = await judge(
        qa.question,
        qa.expected_answer,
        vectorAnswer
      );
      console.log(`   vector: ${vectorScore}/5`);
    } catch (e) {
      console.log(`   vector error: ${String(e).slice(0, 160)}`);
    }

    // --- Hybrid + rerank pipeline ---
    let hybridAnswer = "";
    let hybridScore = 0;
    try {
      const initial = await hybridSearchChunks(
        supabase,
        qa.question,
        queryEmbedding,
        doc.user_id,
        doc.id,
        20
      );
      const reranked = await rerankChunks(qa.question, initial, 5);
      hybridAnswer = await generateAnswer(qa.question, reranked);
      hybridScore = await judge(
        qa.question,
        qa.expected_answer,
        hybridAnswer
      );
      console.log(`   hybrid+rerank: ${hybridScore}/5`);
    } catch (e) {
      console.log(`   hybrid error: ${String(e).slice(0, 160)}`);
    }

    results.push({
      question: qa.question,
      expected_answer: qa.expected_answer,
      vector_answer: vectorAnswer,
      vector_score: vectorScore,
      hybrid_answer: hybridAnswer,
      hybrid_score: hybridScore,
    });
    console.log("");
  }

  // 5. Report
  const n = results.length || 1;
  const vectorAvg =
    results.reduce((s, r) => s + r.vector_score, 0) / n;
  const hybridAvg =
    results.reduce((s, r) => s + r.hybrid_score, 0) / n;

  console.log("══════════════════════════════════════");
  console.log("📊 RESULTS");
  console.log("══════════════════════════════════════");
  console.log(`Document              : ${doc.filename}`);
  console.log(`Questions evaluated   : ${results.length}`);
  console.log(`Vector-only average   : ${vectorAvg.toFixed(2)} / 5`);
  console.log(`Hybrid+rerank average : ${hybridAvg.toFixed(2)} / 5`);
  console.log(`Delta                 : ${(hybridAvg - vectorAvg >= 0 ? "+" : "")}${(hybridAvg - vectorAvg).toFixed(2)}`);
  console.log("══════════════════════════════════════\n");

  writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`💾 Wrote detailed results to tests/rag-eval/results.json\n`);
}

main().catch((err) => {
  console.error("\n❌ Evaluation failed:");
  console.error(err);
  process.exit(1);
});