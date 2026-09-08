"use client";

import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <li className="rounded-xl border p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">{recognition.fromName}</span> recognized{" "}
          <span className="font-medium">{recognition.toName}</span>
        </div>
        <Badge variant="secondary">
          {CATEGORY_LABELS[recognition.category] ?? recognition.category} · {recognition.points} pts
        </Badge>
      </div>
      <p className="mt-1 text-muted-foreground">{recognition.message}</p>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{recognition.createdAt}</span>
        {canDelete && (
          <form action={formAction}>
            <input type="hidden" name="recognitionId" value={recognition.id} />
            <Button type="submit" variant="ghost" size="xs" disabled={pending}>
              {pending ? "…" : "Remove"}
            </Button>
          </form>
        )}
      </div>
      {state.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
    </li>
  );
}
