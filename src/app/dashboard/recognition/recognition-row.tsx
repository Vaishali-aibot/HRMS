"use client";

import { useActionState } from "react";

import { deleteRecognition, type RecognitionActionState } from "@/lib/actions/recognition";

const initialState: RecognitionActionState = {};

const CATEGORY_LABELS: Record<string, string> = {
  TEAMWORK: "Teamwork",
  INNOVATION: "Innovation",
  CUSTOMER_FOCUS: "Customer focus",
  LEADERSHIP: "Leadership",
  GOING_ABOVE_AND_BEYOND: "Going above & beyond",
  OTHER: "Other",
};

export function RecognitionRow({
  recognition,
  canDelete,
}: {
  recognition: {
    id: string;
    fromName: string;
    toName: string;
    category: string;
    points: number;
    message: string;
    createdAt: string;
  };
  canDelete: boolean;
}) {
  const [state, formAction, pending] = useActionState(deleteRecognition, initialState);

  return (
    <li className="rounded-xl border border-black/10 p-4 text-sm dark:border-white/15">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">{recognition.fromName}</span> recognized{" "}
          <span className="font-medium">{recognition.toName}</span>
        </div>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
          {CATEGORY_LABELS[recognition.category] ?? recognition.category} · {recognition.points} pts
        </span>
      </div>
      <p className="mt-1 text-black/70 dark:text-white/70">{recognition.message}</p>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-black/40 dark:text-white/40">{recognition.createdAt}</span>
        {canDelete && (
          <form action={formAction}>
            <input type="hidden" name="recognitionId" value={recognition.id} />
            <button
              type="submit"
              disabled={pending}
              className="text-xs text-black/50 hover:underline disabled:opacity-50 dark:text-white/50"
            >
              {pending ? "…" : "Remove"}
            </button>
          </form>
        )}
      </div>
      {state.error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.error}</p>}
    </li>
  );
}
