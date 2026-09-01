"use client";

import Link from "next/link";
import { useState } from "react";
import { LuChevronLeft } from "react-icons/lu";
import { toast } from "react-toastify";
import DocumentList from "./DocumentList";
import DocumentUploader from "./DocumentUploader";
import ExportToQuizButton from "./ExportToQuizButton";
import GeneratePanel from "./GeneratePanel";
import QuestionCard from "./QuestionCard";
import NavbarToggle from "@/components/Admin/NavbarToggle";
import Skeleton from "@/components/ui/Skeleton";
import { Card, CardHeader, EmptyState } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { getApiErrorMessage } from "@/lib/api/errors";
import { aiApi, type GenerationRun } from "@/lib/modules/ai/api";
import { useSpaceQuery, useSpaceStatusQuery } from "@/lib/modules/ai/hooks";

export default function SpaceWorkspaceClient({ spaceId }: { spaceId: string }) {
  const [run, setRun] = useState<GenerationRun | null>(null);
  const [busyQuestion, setBusyQuestion] = useState<string | null>(null);

  const space = useSpaceQuery(spaceId);
  const status = useSpaceStatusQuery(spaceId);

  const documents = status.data?.documents ?? [];
  const counts = status.data?.counts;
  const readyCount = counts?.ready ?? 0;
  const total = documents.length;
  const hasReady = readyCount > 0;

  async function toggleDiscard(questionId: string, discarded: boolean) {
    if (!run) return;
    setBusyQuestion(questionId);
    try {
      const updated = await aiApi.updateQuestion(run.id, questionId, {
        discarded,
      });
      setRun({
        ...run,
        questions: run.questions.map((q) =>
          q.id === updated.id ? updated : q,
        ),
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setBusyQuestion(null);
    }
  }

  return (
    <div className="p-4 md:p-6 w-full">
      <div className="flex items-center gap-2">
        <span className="md:hidden inline">
          <NavbarToggle />
        </span>
        <Link
          href="/admin/ai"
          className="inline-flex items-center gap-1 text-sm text-off-dark dark:text-off-white hover:text-dark dark:hover:text-white"
        >
          <LuChevronLeft size={16} aria-hidden />
          AI Spaces
        </Link>
      </div>

      {space.isPending ? (
        <Skeleton className="mt-3 h-8 w-64 rounded-lg bg-white dark:bg-card-dark" />
      ) : space.isError || !space.data ? (
        <p className="mt-3 text-sm text-dark dark:text-white">
          Could not load this space.
        </p>
      ) : (
        <>
          <h1 className="mt-2 text-2xl font-black text-dark dark:text-white">
            {space.data.name}
          </h1>
          {space.data.description && (
            <p className="mt-1 text-sm text-off-dark dark:text-off-white">
              {space.data.description}
            </p>
          )}
        </>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] items-start">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title="Documents"
              description="PDF, DOCX, TXT or Markdown. Sources are deleted once indexed."
            />
            <div className="mt-4">
              <DocumentUploader spaceId={spaceId} />
            </div>
            {status.data?.isProcessing && (
              <div className="mt-4">
                <Progress
                  value={readyCount}
                  max={total}
                  label="Documents processed"
                />
                <p className="mt-1 text-2xs text-off-dark dark:text-off-white">
                  {readyCount} of {total} ready
                  {counts?.failed ? ` · ${counts.failed} failed` : ""}
                </p>
              </div>
            )}
            <div className="mt-4">
              <DocumentList
                spaceId={spaceId}
                documents={documents}
                isPending={status.isPending}
              />
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title="Generate questions"
              description={
                hasReady
                  ? "Ask in plain language — name a unit or chapter to scope it."
                  : "Upload a document and wait for it to finish processing first."
              }
            />
            <div className="mt-4">
              <GeneratePanel
                spaceId={spaceId}
                disabled={!hasReady}
                onGenerated={setRun}
              />
            </div>
          </Card>

          {run && (
            <Card>
              <CardHeader
                title={`${run.questions.filter((q) => !q.discarded).length} question${
                  run.questions.filter((q) => !q.discarded).length === 1
                    ? ""
                    : "s"
                }`}
                description={run.prompt}
                action={
                  <ExportToQuizButton
                    title={space.data?.name ?? "AI quiz"}
                    questions={run.questions}
                  />
                }
              />
              {/* The header (count + Export) stays put while the list scrolls —
                  with 15 questions the export button would otherwise be a long
                  way up the page. `pr-1`/`-mr-1` keeps the scrollbar off the
                  cards without narrowing them. */}
              <div className="mt-4 flex max-h-[60vh] flex-col gap-3 overflow-y-auto overscroll-contain pr-1 -mr-1">
                {run.questions.map((question, index) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    index={index}
                    isBusy={busyQuestion === question.id}
                    onToggleDiscard={() =>
                      toggleDiscard(question.id, !question.discarded)
                    }
                  />
                ))}
              </div>
            </Card>
          )}

          {!run && hasReady && (
            <EmptyState
              title="Nothing generated yet"
              hint="Describe what you need above — for example, “Create 5 difficult MCQs from Chapter 3”."
            />
          )}
        </div>
      </div>
    </div>
  );
}
