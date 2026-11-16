# StudyMate — Course Document RAG

A full-stack educational prototype that helps students organize course materials, generate grounded revision summaries, and create **new practice questions** informed by uploaded study documents and past exams.

The application uses **Google Gemini File Search** for managed document retrieval. It is not a local vector-database implementation, and it does not statistically predict actual exam questions.

## Features

- **Document workspace:** Create and reconnect to a Gemini File Search store.
- **Two document categories:** Upload course notes, slides and reading material as study documents; upload previous exam materials separately as exam documents.
- **Document management:** Browse indexed files, inspect metadata and processing state, filter by category, and delete documents.
- **Retrieval-grounded study summaries:** Ask Gemini to summarize retrieved study material in Thai or English.
- **Practice-question generation:** Draft fresh exam-style revision questions from study materials, then review the drafts against retrieved past-exam material to reduce close repetition.
- **Language-aware output:** The main backend includes additional checks and correction passes for the requested Thai/English output language.
- **Evidence inspection:** Return Gemini grounding metadata for inspection alongside generated text; it is not a guarantee of exact claim-level citations.
- **Web interface:** Responsive React interface with drag-and-drop uploads, upload progress feedback, document lists, summaries, questions, and copy-to-clipboard actions.

## How it works

~~~text
React + TypeScript + Vite (StudyMate UI)
    └─ Express REST API
        ├─ Create/manage a Google Gemini File Search store
        ├─ Upload files with kind="study" or kind="exam" metadata
        ├─ Summarize:
        │     Gemini File Search filtered to study documents
        │     → generated revision notes
        └─ Generate practice questions:
              retrieve study documents → draft new questions
              → retrieve past exams → similarity/style review
              → optional language correction → final JSON + grounding metadata
~~~

Documents are indexed and retrieved by the **Gemini File Search service**. The Express server keeps the selected store name in a local configuration file (server/data/store.json). It does not implement FAISS, local embeddings, or a separate database.

## Technology stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS |
| Backend | Node.js, Express 5, Multer, dotenv, CORS |
| AI and retrieval | Google Gemini via @google/genai and Gemini File Search |
| Container development | Docker Compose, Node 20 Alpine images |
| State | Gemini-hosted document store plus local store-name configuration |

## Repository layout

~~~text
course-rag-Main/
├── docker-compose.yml
├── server/
│   ├── index.js               # REST API, File Search and generation
│   ├── package.json
│   └── Dockerfile
└── web/
    ├── src/App.tsx            # StudyMate interface
    ├── package.json
    ├── vite.config.ts
    └── Dockerfile
~~~

## Quick start with Docker

**Requirements:** Docker with the Compose plugin and a valid Google Gemini API key with File Search access.

1. Clone the repository.
2. Configure local environment files **without publishing secrets**:

   Create server/.env (or replace any example/local values) with:

   ~~~dotenv
   PORT=8080
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-2.5-flash
   RAG_TOPK_STUDY=4
   RAG_TOPK_PREDICT_REVIEW=6
   CHUNK_MAX_TOKENS=500
   CHUNK_OVERLAP_TOKENS=50
   ~~~

   Create web/.env with:

   ~~~dotenv
   VITE_API_URL=http://localhost:8085
   ~~~

3. From the repository root, start both services:

   ~~~bash
   docker compose up --build
   ~~~

4. Open **http://localhost:5173**. The API is exposed to the host at **http://localhost:8085**, mapped to port 8080 inside the container.
5. Create a File Search store in the UI, upload study/exam documents, and use the summary or question-generation tools.

The Compose file already sets the container environment and development bind mounts. The first upload can take time while Gemini processes/indexes the document.

## Run without Docker

Requires Node.js 20+ and npm. Run in separate terminals:

~~~bash
cd server
npm ci
npm run dev
~~~

~~~bash
cd web
npm ci
npm run dev
~~~

For this setup, use PORT=8080 in server/.env and **VITE_API_URL=http://localhost:8080** in web/.env. Open http://localhost:5173.

## REST API

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | /api/health | API health |
| GET | /api/store | Current File Search store |
| POST | /api/store/create | Create a store |
| POST | /api/upload?kind=study | Upload a study document |
| POST | /api/upload?kind=exam | Upload a past-exam document |
| POST | /api/operation/get | Poll an indexing operation |
| GET | /api/documents | List documents; optional kind filter |
| DELETE | /api/documents?name=... | Delete a document |
| POST | /api/summarize | Generate a retrieval-grounded summary |
| POST | /api/predict | Generate and review practice questions |

POST /api/summarize accepts a language (th or en) and an optional additional prompt. POST /api/predict accepts a language, a requested count (1–20), and an optional additional prompt. Its response includes structured predictedQuestions entries with **q**, **whyLikely**, and **shortAnswer** fields. The model is prompted for the requested count, but the service does not independently guarantee that every generated result is complete or correct.

## Important limitations

- **Practice, not prediction:** Past exams guide style and topic review; no measured probability of appearing on a real exam is produced.
- **Retrieved evidence is selective:** Summaries and questions depend on retrieved passages, not an exhaustive review of every uploaded page. Grounding metadata is not verified sentence-level citation.
- **Prototype security:** The API has no login, per-user access control, or isolation between users. The configured File Search store is shared by the running instance.
- **File support:** Uploads are limited to 100 MB at the Express layer; actual supported formats and processing behavior depend on Gemini File Search. Do not assume legacy .ppt files are supported.
- **Data and cost:** Uploaded documents are processed by an external provider and may incur API charges or quotas. Use only material that you are authorized to upload.
- **Operational state:** Preserve server/data/store.json locally if you need to reconnect to the same store. Do not commit it or upload directories containing user documents.

**Credential hygiene:** Never publish server/.env or web/.env. If a real API key has been committed to a public Git history, revoke/rotate it; merely editing or deleting the latest file does not remove earlier copies from history.

## Project status

Educational full-stack RAG prototype. It demonstrates document ingestion, metadata-aware retrieval, source-based summarization and a two-stage practice-question workflow. It is **not** a multi-user production learning platform or a verified exam-prediction service.
