import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

const PORT = Number(process.env.PORT || 8080);
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const TOPK_STUDY = Number(process.env.RAG_TOPK_STUDY || 4);
const TOPK_EXAM = Number(process.env.RAG_TOPK_EXAM || 6);
const TOPK_PREDICT_REVIEW = Number(process.env.RAG_TOPK_PREDICT_REVIEW || 6);

const CHUNK_MAX_TOKENS = Number(process.env.CHUNK_MAX_TOKENS || 500);
const CHUNK_OVERLAP_TOKENS = Number(process.env.CHUNK_OVERLAP_TOKENS || 50);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(STORE_FILE)) fs.writeFileSync(STORE_FILE, "", "utf8");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readStoreConfig() {
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8").trim();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeStoreConfig(cfg) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(cfg, null, 2), "utf8");
}

function requireStoreName() {
  const cfg = readStoreConfig();
  if (!cfg?.storeName) throw new Error("ยังไม่มี Store — กด Create Store ก่อน");
  return cfg.storeName;
}

function safeFileName(name) {
  return (name || "file").replace(/[^\w.\-()+\s]/g, "_");
}

function clampInt(value, fallback, min = 1, max = 20) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function normalizeLang(lang) {
  const value = String(lang || "").toLowerCase();
  return value.startsWith("en") ? "en" : "th";
}

function containsThai(text = "") {
  return /[ก-๙]/.test(String(text));
}

function containsEnglish(text = "") {
  return /[A-Za-z]/.test(String(text));
}

function mergePrompt(basePrompt, userPrompt) {
  const extra = String(userPrompt || "").trim();
  if (!extra) return basePrompt;

  return `
${basePrompt}

Additional user request:
${extra}
`.trim();
}

function tryParseJson(text) {
  if (typeof text !== "string") return null;

  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {}

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch {}
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {}
  }

  return null;
}

function buildStudySummaryPrompt(lang = "th") {
  const wantEnglish = lang === "en";
  const targetLang = wantEnglish ? "English" : "Thai";

  return `
You are a study-summary assistant for students.

Target output language: ${targetLang} only.

Important facts:
- The study documents may be in Thai or English.
- You must use only information retrieved from the study documents.
- If the source document language is different from the target output language, translate faithfully into ${targetLang}.
- Do not invent or add information that does not appear in the documents.
- If no clear lesson content is found, answer only:
  ${
    wantEnglish
      ? `"No clear knowledge content was found in the document."`
      : `"ไม่พบเนื้อหาความรู้ชัดเจนในเอกสาร"`
  }

Rules:
- Focus only on the lesson content.
- Do not summarize activities.
- Do not summarize worksheets.
- Do not summarize exercises.
- Do not summarize end-of-chapter questions.
- Do not summarize learning objectives.
- Do not summarize materials, tools, or procedures.
- If a document contains both knowledge and activities, keep only the knowledge part.

Answer format:
- Write in ${targetLang} only.
- Write 2-4 short paragraphs.
- Use short, simple sentences.
- Focus on what the student should remember for the exam.
- No bullet points.
- No headings.
- No long introduction.
- Do not mention the document type.

Writing style:
- Write like exam revision notes.
- Make comparisons easy to understand when needed.
- Avoid repetition.
- Stay faithful to the original meaning.

Final sentence:
- End with 1-2 easy-to-remember summary sentences.
- Those sentences must also be based only on the documents.

Return only the final summary text in ${targetLang}.
`.trim();
}

function buildPredictDraftPrompt(n, lang = "th") {
  const wantEnglish = lang === "en";
  const targetLang = wantEnglish ? "English" : "Thai";

  return `
You are a strict exam-prep tutor.

Target output language: ${targetLang} only.

Important facts:
- The study documents and old exams may be in Thai or English.
- Use study documents as the primary source of concepts.
- Use old exams only as a secondary source to understand asking style and topic weight.
- Do not create questions from topics that are not clearly supported by the study documents.
- If the source documents are in another language, translate faithfully into ${targetLang}.
- Do not mix Thai and English in the same output item.

Goal:
- Generate exactly ${n} likely exam-style review questions.
- Every question must be grounded in real concepts found in the study documents.
- Every question must be new, not copied from old exams.

Rules:
- Do not copy old exam questions.
- Do not do shallow paraphrasing.
- You may change context, examples, or numbers, but the concept must remain grounded in the lesson.
- If evidence is limited, say so honestly in whyLikely.
- Do not return more than ${n} questions.
- q, whyLikely, and shortAnswer must all be written in ${targetLang} only.

Return JSON only.
Do not use markdown.
Do not add any text outside JSON.

Required JSON shape:
{
  "predictedQuestions": [
    {
      "q": "${wantEnglish ? "new question" : "คำถามใหม่ที่สร้างขึ้น"}",
      "whyLikely": "${
        wantEnglish
          ? "short reason based on the lesson content"
          : "เหตุผลสั้นๆ ว่าทำไมแนวนี้น่าจะออก"
      }",
      "shortAnswer": "${
        wantEnglish
          ? "short answer or answer guideline"
          : "เฉลยย่อหรือแนวตอบสั้นๆ"
      }"
    }
  ]
}
`.trim();
}

function buildPredictReviewPrompt(draftJson, n, lang = "th") {
  const draftText = JSON.stringify(draftJson, null, 2);
  const wantEnglish = lang === "en";
  const targetLang = wantEnglish ? "English" : "Thai";

  return `
You are a strict question quality reviewer.

Target output language: ${targetLang} only.

Important facts:
- Old exams may be in Thai or English.
- Your job is to make sure the final questions are not too similar to old exams.
- Keep every question grounded in the lesson content.
- Do not introduce brand new topics that are not supported by the study documents.
- The final result must still contain exactly ${n} questions.
- q, whyLikely, and shortAnswer must all be written in ${targetLang} only.
- Do not mix Thai and English in the same output item.

Your tasks:
1) Review the draft below against old exams.
2) If any item is too similar in wording, numbers, context, structure, or answer pattern, rewrite it immediately.
3) Keep the same core concept.
4) Do not add unsupported topics.

Current draft:
${draftText}

Return JSON only.
Do not use markdown.
Do not add any text outside JSON.

Required JSON shape:
{
  "predictedQuestions": [
    {
      "q": "${wantEnglish ? "new question" : "คำถามใหม่ที่สร้างขึ้น"}",
      "whyLikely": "${
        wantEnglish
          ? "short reason based on the lesson content"
          : "เหตุผลสั้นๆ ว่าทำไมแนวนี้น่าจะออก"
      }",
      "shortAnswer": "${
        wantEnglish
          ? "short answer or answer guideline"
          : "เฉลยย่อหรือแนวตอบสั้นๆ"
      }"
    }
  ]
}
`.trim();
}

function buildSummaryLanguageFixPrompt(text, lang = "th") {
  const wantEnglish = lang === "en";
  const targetLang = wantEnglish ? "English" : "Thai";

  return `
You are a strict language normalizer.

Rewrite the following summary into ${targetLang} only.

Rules:
- Preserve the original meaning.
- Do not add new facts.
- Do not remove important facts.
- Do not mix Thai and English.
- If the original text contains another language, translate it fully into ${targetLang}.
- Return only the final rewritten summary text.

Input:
${String(text || "").trim()}
`.trim();
}

function buildPredictLanguageFixPrompt(json, lang = "th") {
  const wantEnglish = lang === "en";

  return `
You are a strict JSON language normalizer.

Task:
- Rewrite every q, whyLikely, and shortAnswer into ${wantEnglish ? "English" : "Thai"} only.
- Preserve the same meaning.
- Do not add new ideas.
- Do not remove any item.
- Keep the same number of questions.
- Do not mix Thai and English in the same item.
- Return JSON only.
- Do not use markdown.
- Do not add any text outside JSON.

Input JSON:
${JSON.stringify(json, null, 2)}

Required output shape:
{
  "predictedQuestions": [
    {
      "q": "${wantEnglish ? "new question" : "คำถามใหม่ที่สร้างขึ้น"}",
      "whyLikely": "${wantEnglish ? "short reason" : "เหตุผลสั้นๆ"}",
      "shortAnswer": "${wantEnglish ? "short answer" : "แนวตอบสั้นๆ"}"
    }
  ]
}
`.trim();
}

function isWrongSummaryLanguage(text, lang = "th") {
  const value = String(text || "").trim();
  if (!value) return false;

  if (lang === "th") {
    return containsEnglish(value);
  }

  return containsThai(value);
}

function isWrongPredictLanguage(data, lang = "th") {
  const items = Array.isArray(data?.predictedQuestions) ? data.predictedQuestions : [];
  if (!items.length) return false;

  return items.some((item) => {
    const q = String(item?.q || "");
    const whyLikely = String(item?.whyLikely || "");
    const shortAnswer = String(item?.shortAnswer || "");

    if (lang === "th") {
      return containsEnglish(q) || containsEnglish(whyLikely) || containsEnglish(shortAnswer);
    }

    return containsThai(q) || containsThai(whyLikely) || containsThai(shortAnswer);
  });
}

async function pollOperation(operation, maxWaitMs = 60000) {
  let op = operation;
  let waited = 0;

  while (op && !op.done && waited < maxWaitMs) {
    await sleep(1500);
    op = await ai.operations.get({ operation: op });
    waited += 1500;
  }

  return op;
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/store", async (req, res) => {
  try {
    const cfg = readStoreConfig();
    if (!cfg?.storeName) {
      return res.json({ hasStore: false });
    }

    const store = await ai.fileSearchStores.get({ name: cfg.storeName });

    res.json({
      hasStore: true,
      storeName: cfg.storeName,
      displayName: store.displayName,
    });
  } catch (e) {
    res.status(500).json({
      error: String(e?.message || e || "Server error"),
    });
  }
});

app.post("/api/store/create", async (req, res) => {
  try {
    const displayName = (req.body?.displayName || `course-one-${Date.now()}`).toString();

    const store = await ai.fileSearchStores.create({
      config: { displayName },
    });

    writeStoreConfig({
      storeName: store.name,
      displayName: store.displayName,
    });

    res.json({
      ok: true,
      storeName: store.name,
      displayName: store.displayName,
    });
  } catch (e) {
    res.status(500).json({
      error: String(e?.message || e || "Server error"),
    });
  }
});

app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    const storeName = requireStoreName();
    const kind = (req.query.kind || req.body?.kind || "").toString();

    if (!["study", "exam"].includes(kind)) {
      return res.status(400).json({ error: 'kind ต้องเป็น "study" หรือ "exam"' });
    }

    if (!req.file) {
      return res.status(400).json({ error: "ต้องมีไฟล์" });
    }

    const safeName = safeFileName(req.file.originalname);
    const rnd = crypto.randomBytes(6).toString("hex");
    const tmpPath = path.join(UPLOAD_DIR, `${Date.now()}-${rnd}-${safeName}`);

    fs.writeFileSync(tmpPath, req.file.buffer);

    let op = await ai.fileSearchStores.uploadToFileSearchStore({
      file: tmpPath,
      fileSearchStoreName: storeName,
      config: {
        displayName: safeName,
        customMetadata: [{ key: "kind", stringValue: kind }],
        chunkingConfig: {
          whiteSpaceConfig: {
            maxTokensPerChunk: CHUNK_MAX_TOKENS,
            maxOverlapTokens: CHUNK_OVERLAP_TOKENS,
          },
        },
      },
    });

    try {
      fs.unlinkSync(tmpPath);
    } catch {}

    op = await pollOperation(op, 15000);

    res.json({ ok: true, storeName, operation: op });
  } catch (e) {
    res.status(500).json({
      error: String(e?.message || e || "Server error"),
    });
  }
});

app.post("/api/operation/get", async (req, res) => {
  try {
    const operation = req.body?.operation;

    if (!operation) {
      return res.status(400).json({ error: "ต้องส่ง operation" });
    }

    const op = await ai.operations.get({ operation });
    res.json({ ok: true, operation: op });
  } catch (e) {
    res.status(500).json({
      error: String(e?.message || e || "Server error"),
    });
  }
});

app.get("/api/documents", async (req, res) => {
  try {
    const storeName = requireStoreName();
    const kind = (req.query.kind || "").toString();

    const pager = await ai.fileSearchStores.documents.list({ parent: storeName });
    const docs = [];

    for await (const d of pager) {
      const meta = {};

      for (const m of d.customMetadata || []) {
        if (m.key && typeof m.stringValue === "string") {
          meta[m.key] = m.stringValue;
        }
      }

      if (kind && meta.kind !== kind) continue;

      docs.push({
        name: d.name,
        displayName: d.displayName,
        state: d.state,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        createTime: d.createTime,
        metadata: meta,
      });
    }

    res.json({ ok: true, storeName, documents: docs });
  } catch (e) {
    res.status(500).json({
      error: String(e?.message || e || "Server error"),
    });
  }
});

app.delete("/api/documents", async (req, res) => {
  try {
    const name = (req.query.name || "").toString();

    if (!name.startsWith("fileSearchStores/")) {
      return res.status(400).json({
        error: "name ต้องเป็นรูปแบบ fileSearchStores/.../documents/...",
      });
    }

    await ai.fileSearchStores.documents.delete({
      name,
      config: { force: true },
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({
      error: String(e?.message || e || "Server error"),
    });
  }
});

app.post("/api/summarize", async (req, res) => {
  try {
    const storeName = requireStoreName();
    const lang = normalizeLang(req.body?.lang);
    const prompt = mergePrompt(
      buildStudySummaryPrompt(lang),
      typeof req.body?.prompt === "string" ? req.body.prompt : ""
    );

    const resp = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        tools: [
          {
            fileSearch: {
              fileSearchStoreNames: [storeName],
              metadataFilter: 'kind="study"',
              topK: TOPK_STUDY,
            },
          },
        ],
      },
    });

    let finalText = String(resp.text || "").trim();

    if (isWrongSummaryLanguage(finalText, lang)) {
      const fixResp = await ai.models.generateContent({
        model: MODEL,
        contents: buildSummaryLanguageFixPrompt(finalText, lang),
      });

      const fixedText = String(fixResp.text || "").trim();
      if (fixedText) finalText = fixedText;
    }

    res.json({
      ok: true,
      lang,
      text: finalText,
      groundingMetadata: resp.candidates?.[0]?.groundingMetadata || null,
    });
  } catch (e) {
    res.status(500).json({
      error: String(e?.message || e || "Server error"),
    });
  }
});

app.post("/api/predict", async (req, res) => {
  try {
    const storeName = requireStoreName();
    const n = clampInt(req.body?.n, 10, 1, 20);
    const lang = normalizeLang(req.body?.lang);

    const draftPrompt = mergePrompt(
      buildPredictDraftPrompt(n, lang),
      typeof req.body?.prompt === "string" ? req.body.prompt : ""
    );

    const draftResp = await ai.models.generateContent({
      model: MODEL,
      contents: draftPrompt,
      config: {
        tools: [
          {
            fileSearch: {
              fileSearchStoreNames: [storeName],
              metadataFilter: 'kind="study"',
              topK: TOPK_STUDY,
            },
          },
        ],
      },
    });

    const draftJson = tryParseJson(draftResp.text);

    if (!draftJson?.predictedQuestions?.length) {
      throw new Error("โมเดลไม่สามารถสร้าง draft คำถามในรูปแบบ JSON ที่ต้องการได้");
    }

    const reviewResp = await ai.models.generateContent({
      model: MODEL,
      contents: buildPredictReviewPrompt(draftJson, n, lang),
      config: {
        tools: [
          {
            fileSearch: {
              fileSearchStoreNames: [storeName],
              metadataFilter: 'kind="exam"',
              topK: TOPK_PREDICT_REVIEW,
            },
          },
        ],
      },
    });

    const reviewedJson = tryParseJson(reviewResp.text);
    let finalJson = reviewedJson?.predictedQuestions?.length ? reviewedJson : draftJson;

    if (isWrongPredictLanguage(finalJson, lang)) {
      const fixResp = await ai.models.generateContent({
        model: MODEL,
        contents: buildPredictLanguageFixPrompt(finalJson, lang),
      });

      const fixedJson = tryParseJson(fixResp.text);
      if (fixedJson?.predictedQuestions?.length) {
        finalJson = fixedJson;
      }
    }

    res.json({
      ok: true,
      lang,
      json: finalJson,
      text: JSON.stringify(finalJson, null, 2),
      groundingMetadata:
        reviewResp.candidates?.[0]?.groundingMetadata ||
        draftResp.candidates?.[0]?.groundingMetadata ||
        null,
      debug: {
        draftJson,
        finalJson,
        draftGroundingMetadata: draftResp.candidates?.[0]?.groundingMetadata || null,
        reviewGroundingMetadata: reviewResp.candidates?.[0]?.groundingMetadata || null,
      },
    });
  } catch (e) {
    res.status(500).json({
      error: String(e?.message || e || "Server error"),
    });
  }
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});