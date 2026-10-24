import type {
  QuestionAnswer,
  SoloTestInfo,
  SoloTestItem,
  SoloTestReport,
  SoloView,
} from "@buzrr/contract";
import {
  createPlayerAuthedApiClient,
  getAuthApiClient,
  getPublicApiClient,
} from "@/lib/api/client";

/** "Play alone": the host's tests and a player's run through one. */
export const soloApi = {
  // host
  create: async (body: {
    quizId: string;
    closesAt?: string;
    practice?: boolean;
  }) => (await getAuthApiClient().post<SoloTestItem>("/solo-tests", body)).data,
  list: async (quizId: string) =>
    (
      await getAuthApiClient().get<SoloTestItem[]>("/solo-tests", {
        params: { quizId },
      })
    ).data,
  report: async (id: string) =>
    (
      await getAuthApiClient().get<SoloTestReport>(
        `/solo-tests/${encodeURIComponent(id)}/report`,
      )
    ).data,
  update: async (args: { id: string; closesAt: string | null }) =>
    (
      await getAuthApiClient().patch<SoloTestItem>(
        `/solo-tests/${encodeURIComponent(args.id)}`,
        { closesAt: args.closesAt },
      )
    ).data,
  remove: async (id: string) =>
    (await getAuthApiClient().delete(`/solo-tests/${encodeURIComponent(id)}`))
      .data,

  // player
  info: async (code: string) =>
    (
      await getPublicApiClient().get<SoloTestInfo>(
        `/solo/${encodeURIComponent(code)}`,
      )
    ).data,
  start: async (code: string) =>
    (
      await createPlayerAuthedApiClient().post<SoloView>(
        `/solo/${encodeURIComponent(code)}/attempt`,
      )
    ).data,
  next: async (attemptId: string) =>
    (
      await createPlayerAuthedApiClient().post<SoloView>(
        `/solo/attempts/${encodeURIComponent(attemptId)}/next`,
      )
    ).data,
  answer: async (
    attemptId: string,
    body: { qIndex: number; answer: QuestionAnswer },
  ) =>
    (
      await createPlayerAuthedApiClient().post<SoloView>(
        `/solo/attempts/${encodeURIComponent(attemptId)}/answer`,
        body,
      )
    ).data,
};

/** The link players open for a test. */
export const soloLink = (code: string) =>
  `${typeof window === "undefined" ? "" : window.location.origin}/solo/${code}`;
