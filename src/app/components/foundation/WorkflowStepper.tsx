import * as React from "react";
import { AlertCircle, CheckCircle2, Circle } from "lucide-react";

import { cn } from "../ui/utils";

export type WorkflowStepStatus = "pending" | "active" | "complete" | "error" | "disabled";

export interface WorkflowStep {
  key: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  status?: WorkflowStepStatus;
}

interface WorkflowStepperProps {
  steps: WorkflowStep[];
  currentStep?: string;
  onStepClick?: (step: WorkflowStep) => void;
  className?: string;
}

function resolveStepStatus(step: WorkflowStep, currentStep?: string): WorkflowStepStatus {
  if (step.status) return step.status;
  return step.key === currentStep ? "active" : "pending";
}

export function WorkflowStepper({ steps, currentStep, onStepClick, className }: WorkflowStepperProps) {
  return (
    <ol className={cn("flex flex-col gap-2", className)}>
      {steps.map((step, index) => {
        const status = resolveStepStatus(step, currentStep);
        const clickable = Boolean(onStepClick) && status !== "disabled";
        const content = (
          <>
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                status === "complete" && "border-green-200 bg-green-50 text-green-700",
                status === "active" && "border-blue-200 bg-blue-50 text-blue-700",
                status === "error" && "border-red-200 bg-red-50 text-red-700",
                status === "pending" && "border-slate-200 bg-white text-slate-500",
                status === "disabled" && "border-slate-200 bg-slate-50 text-slate-300",
              )}
              aria-hidden="true"
            >
              {status === "complete" ? <CheckCircle2 className="h-4 w-4" /> : null}
              {status === "error" ? <AlertCircle className="h-4 w-4" /> : null}
              {status === "active" || status === "pending" || status === "disabled" ? (
                status === "active" ? String(index + 1) : <Circle className="h-3 w-3" />
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-sm font-medium text-slate-800", status === "disabled" && "text-slate-400")}>
                {step.label}
              </span>
              {step.description ? <span className="mt-0.5 block text-xs text-slate-500">{step.description}</span> : null}
            </span>
          </>
        );

        return (
          <li key={step.key}>
            {clickable ? (
              <button
                type="button"
                className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-slate-50"
                onClick={() => onStepClick?.(step)}
              >
                {content}
              </button>
            ) : (
              <div className="flex items-start gap-3 rounded-md px-2 py-2">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

