import React from "react";
import { GuardrailResultType } from "@/types/chat";

interface GuardrailChipProps {
  guardrailResult: GuardrailResultType;
}

export function GuardrailChip({ guardrailResult }: GuardrailChipProps) {
  const { status, category, rationale } = guardrailResult;

  if (status === "IN_PROGRESS") {
    return (
      <div className="flex items-center gap-2 text-stone-400 text-sm">
        <div className="w-2 h-2 bg-stone-500 rounded-full animate-pulse"></div>
        Checking content...
      </div>
    );
  }

  if (category === "NONE" || !category) {
    return (
      <div className="flex items-center gap-2 text-stone-500 text-sm">
        <div className="w-2 h-2 bg-stone-500 rounded-full"></div>
        Content approved
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-stone-300 text-sm">
      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
      <span className="font-medium">{category}</span>
      {rationale && (
        <span className="text-xs text-stone-500">({rationale})</span>
      )}
    </div>
  );
}
