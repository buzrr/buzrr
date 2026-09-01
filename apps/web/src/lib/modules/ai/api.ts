import type { AxiosInstance } from "axios";
import { getAiApiClient } from "@/lib/api/ai-client";
import { getAuthApiClient } from "@/lib/api/client";

/**
 * Hand-written mirrors of the Buzrr-AI response shapes, following the same
 * convention as the other modules here (no codegen anywhere in this repo — when
 * a response shape changes, this file must change with it).
 */

export type DocumentStatus = "queued" | "processing" | "ready" | "failed";

export type KnowledgeSpace = {
  id: string;
  name: string;
  description: string | null;
  documentCount: number;
  readyCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AiDocument = {
  id: string;
  filename: string;
  extension: string;
  sizeBytes: number;
  status: DocumentStatus;
  error: string | null;
  pageCount: number | null;
  chunkCount: number;
  createdAt: string;
  processedAt: string | null;
};

export type SpaceStatus = {
  counts: Record<DocumentStatus, number>;
  documents: AiDocument[];
  isProcessing: boolean;
};

export type Citation = {
  documentId: string | null;
  documentName: string;
  pageStart: number | null;
  pageEnd: number | null;
  headingPath: string[];
};

export type GeneratedOption = { title: string; isCorrect: boolean };

export type GeneratedQuestion = {
  id: string;
  type: "MCQ" | "TRUE_FALSE";
  difficulty: string | null;
  stem: string;
  options: GeneratedOption[];
  explanation: string | null;
  discarded: boolean;
  citations: Citation[];
};

export type GenerationRun = {
  id: string;
  spaceId: string;
  prompt: string;
  status: "pending" | "ready" | "failed";
  error: string | null;
  model: string | null;
  latencyMs: number | null;
  createdAt: string;
  questions: GeneratedQuestion[];
};

export type RunSummary = {
  id: string;
  prompt: string;
  status: string;
  questionCount: number;
  createdAt: string;
};

export async function listSpaces(client: AxiosInstance) {
  const { data } = await client.get<KnowledgeSpace[]>("/spaces");
  return data;
}

export async function getSpace(client: AxiosInstance, spaceId: string) {
  const { data } = await client.get<KnowledgeSpace>(`/spaces/${spaceId}`);
  return data;
}

export async function createSpace(
  client: AxiosInstance,
  body: { name: string; description?: string },
) {
  const { data } = await client.post<KnowledgeSpace>("/spaces", body);
  return data;
}

export async function deleteSpace(client: AxiosInstance, spaceId: string) {
  await client.delete(`/spaces/${spaceId}`);
}

export async function uploadDocuments(
  client: AxiosInstance,
  spaceId: string,
  files: File[],
) {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }
  const { data } = await client.post<AiDocument[]>(
    `/spaces/${spaceId}/documents`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function getSpaceStatus(client: AxiosInstance, spaceId: string) {
  const { data } = await client.get<SpaceStatus>(`/spaces/${spaceId}/status`);
  return data;
}

export async function deleteDocument(
  client: AxiosInstance,
  documentId: string,
) {
  await client.delete(`/documents/${documentId}`);
}

export async function retryDocument(client: AxiosInstance, documentId: string) {
  const { data } = await client.post<AiDocument>(
    `/documents/${documentId}/retry`,
  );
  return data;
}

export async function generate(
  client: AxiosInstance,
  spaceId: string,
  body: { prompt: string; questionTypes?: string[]; count?: number },
) {
  const { data } = await client.post<GenerationRun>(
    `/spaces/${spaceId}/generate`,
    body,
  );
  return data;
}

export async function listRuns(client: AxiosInstance, spaceId: string) {
  const { data } = await client.get<RunSummary[]>(`/spaces/${spaceId}/runs`);
  return data;
}

export async function getRun(client: AxiosInstance, runId: string) {
  const { data } = await client.get<GenerationRun>(`/runs/${runId}`);
  return data;
}

export async function updateQuestion(
  client: AxiosInstance,
  runId: string,
  questionId: string,
  body: { stem?: string; options?: GeneratedOption[]; discarded?: boolean },
) {
  const { data } = await client.patch<GeneratedQuestion>(
    `/runs/${runId}/questions/${questionId}`,
    body,
  );
  return data;
}

/**
 * Export to a real Buzrr quiz.
 *
 * Goes to the **Nest** API, not the AI service: quiz writes stay behind the
 * server that owns them, so ownership checks, question `order` and the
 * moderation default all keep living in one place.
 */
export async function importAsQuiz(
  client: AxiosInstance,
  body: {
    title: string;
    description?: string;
    questions: {
      title: string;
      timeOut?: number;
      options: GeneratedOption[];
    }[];
  },
) {
  const { data } = await client.post<{ quizId: string; questionCount: number }>(
    "/quizzes/import",
    body,
  );
  return data;
}

export const aiApi = {
  listSpaces: () => listSpaces(getAiApiClient()),
  getSpace: (spaceId: string) => getSpace(getAiApiClient(), spaceId),
  createSpace: (body: Parameters<typeof createSpace>[1]) =>
    createSpace(getAiApiClient(), body),
  deleteSpace: (spaceId: string) => deleteSpace(getAiApiClient(), spaceId),
  uploadDocuments: (spaceId: string, files: File[]) =>
    uploadDocuments(getAiApiClient(), spaceId, files),
  getSpaceStatus: (spaceId: string) =>
    getSpaceStatus(getAiApiClient(), spaceId),
  deleteDocument: (documentId: string) =>
    deleteDocument(getAiApiClient(), documentId),
  retryDocument: (documentId: string) =>
    retryDocument(getAiApiClient(), documentId),
  generate: (spaceId: string, body: Parameters<typeof generate>[2]) =>
    generate(getAiApiClient(), spaceId, body),
  listRuns: (spaceId: string) => listRuns(getAiApiClient(), spaceId),
  getRun: (runId: string) => getRun(getAiApiClient(), runId),
  updateQuestion: (
    runId: string,
    questionId: string,
    body: Parameters<typeof updateQuestion>[3],
  ) => updateQuestion(getAiApiClient(), runId, questionId, body),
  importAsQuiz: (body: Parameters<typeof importAsQuiz>[1]) =>
    importAsQuiz(getAuthApiClient(), body),
};
