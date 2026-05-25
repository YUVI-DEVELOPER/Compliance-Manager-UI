import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AlertTriangle, CheckCircle2, ClipboardList, RefreshCw, RotateCcw, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  completeImpactAssessment,
  getImpactAssessment,
  getImpactAssessmentQuestions,
  ImpactAnswer,
  ImpactAssessment,
  ImpactAssessmentAISuggestion,
  ImpactAssessmentCompleteResult,
  ImpactAssessmentSaveResult,
  ImpactQuestion,
  ImpactResponse,
  initializeImpactAssessment,
  ReleaseRecord,
  reopenImpactAssessment,
  saveImpactAssessmentResponses,
  suggestImpactAssessmentAnswers,
} from "../../../services/release.service";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Textarea } from "../ui/textarea";
import {
  formatReleaseEnum,
  formatReleaseStatus,
  getImpactLevelBadgeClass,
  getPackageStatusBadgeClass,
  getReleaseStatusBadgeClass,
  mapReleaseAxiosError,
} from "./releaseForm.shared";

interface ImpactAssessmentStepProps {
  release: ReleaseRecord | null;
  canEdit: boolean;
  onLifecycleChanged?: (result: ImpactAssessmentCompleteResult | ImpactAssessment | null) => Promise<void> | void;
  onContinueToDocumentChecklist?: () => void;
}

type DraftResponse = {
  answer: ImpactAnswer | null;
  rationale: string;
  evidenceReference: string;
};

type ErrorMap = Record<string, Record<string, string>>;

const ANSWER_OPTIONS: Array<{ value: ImpactAnswer; label: string }> = [
  { value: "YES", label: "YES" },
  { value: "NO", label: "NO" },
  { value: "NOT_APPLICABLE", label: "NOT APPLICABLE" },
  { value: "UNKNOWN", label: "UNKNOWN" },
];

const emptyDraft = (): DraftResponse => ({
  answer: null,
  rationale: "",
  evidenceReference: "",
});

const normalize = (value?: string | null): string => (value ?? "").trim();

const responseDraftFromAssessment = (responses: ImpactResponse[]): Record<string, DraftResponse> => {
  return Object.fromEntries(
    responses.map((response) => [
      response.questionCode,
      {
        answer: response.answer ?? null,
        rationale: response.rationale ?? "",
        evidenceReference: response.evidenceReference ?? "",
      },
    ]),
  );
};

const groupQuestions = (questions: ImpactQuestion[]): Array<{ category: string; questions: ImpactQuestion[] }> => {
  const groups = new Map<string, ImpactQuestion[]>();
  questions.forEach((question) => {
    const current = groups.get(question.category) ?? [];
    current.push(question);
    groups.set(question.category, current);
  });
  return Array.from(groups.entries()).map(([category, groupedQuestions]) => ({ category, questions: groupedQuestions }));
};

const mapImpactError = (error: unknown): { message: string; errors: ErrorMap } => {
  const fallback = mapReleaseAxiosError(error);
  const errors: ErrorMap = {};

  if (!axios.isAxiosError(error)) {
    return { message: fallback.message, errors };
  }

  const payload = error.response?.data as {
    message?: string;
    data?: {
      errors?: Array<{ questionCode?: string; field?: string; message?: string }>;
    };
  } | undefined;

  payload?.data?.errors?.forEach((item) => {
    const questionCode = item.questionCode;
    const field = item.field ?? "form";
    if (!questionCode) return;
    errors[questionCode] = {
      ...(errors[questionCode] ?? {}),
      [field]: item.message ?? "Invalid response",
    };
  });

  return {
    message: payload?.message || fallback.message,
    errors,
  };
};

const ScoreBadge = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value ?? "-"}</p>
  </div>
);

export function ImpactAssessmentStep({
  release,
  canEdit,
  onLifecycleChanged,
  onContinueToDocumentChecklist,
}: ImpactAssessmentStepProps) {
  const releaseId = release?.release_id ?? null;
  const [questions, setQuestions] = useState<ImpactQuestion[]>([]);
  const [assessment, setAssessment] = useState<ImpactAssessment | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftResponse>>({});
  const [saveResult, setSaveResult] = useState<ImpactAssessmentSaveResult | null>(null);
  const [completeResult, setCompleteResult] = useState<ImpactAssessmentCompleteResult | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, ImpactAssessmentAISuggestion>>({});
  const [validationErrors, setValidationErrors] = useState<ErrorMap>({});
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!releaseId) {
      setQuestions([]);
      setAssessment(null);
      setDrafts({});
      return;
    }
    if (!release?.validation_package) {
      setQuestions([]);
      setAssessment(null);
      setDrafts({});
      setSaveResult(null);
      setCompleteResult(null);
      setValidationErrors({});
      setPageError("Validation package is missing for this release. Refresh after migration/backfill or recreate the release.");
      return;
    }

    setLoading(true);
    setPageError(null);
    try {
      const [questionData, assessmentData] = await Promise.all([
        getImpactAssessmentQuestions(releaseId),
        getImpactAssessment(releaseId),
      ]);
      const activeQuestions = assessmentData?.questions?.length ? assessmentData.questions : questionData;
      setQuestions(activeQuestions);
      setAssessment(assessmentData);
      setDrafts(assessmentData ? responseDraftFromAssessment(assessmentData.responses) : {});
      setSaveResult(null);
      setCompleteResult(null);
      setValidationErrors({});
    } catch (error) {
      const mapped = mapImpactError(error);
      setPageError(mapped.message);
    } finally {
      setLoading(false);
    }
  }, [release?.validation_package, releaseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const readOnly = assessment?.status === "COMPLETED";
  const groupedQuestions = useMemo(() => groupQuestions(questions), [questions]);
  const preview = completeResult ?? saveResult ?? assessment;

  const progress = useMemo(() => {
    const answered = questions.filter((question) => Boolean(drafts[question.questionCode]?.answer)).length;
    const missingRequired = questions.filter(
      (question) => question.mandatory && !drafts[question.questionCode]?.answer,
    );
    const missingRationale = questions.filter((question) => {
      const draft = drafts[question.questionCode];
      if (!draft?.answer) return false;
      const needsRationale =
        draft.answer === "YES" ||
        draft.answer === "UNKNOWN" ||
        (draft.answer === "NOT_APPLICABLE" && question.critical);
      return needsRationale && !normalize(draft.rationale);
    });
    const criticalRiskCount = questions.filter((question) => {
      const answer = drafts[question.questionCode]?.answer;
      return question.critical && (answer === "YES" || answer === "UNKNOWN");
    }).length;

    return {
      answered,
      total: questions.length,
      missingRequiredCount: missingRequired.length,
      missingRationaleCount: missingRationale.length,
      criticalRiskCount,
    };
  }, [drafts, questions]);

  const completeDisabled =
    !assessment ||
    readOnly ||
    !canEdit ||
    progress.missingRequiredCount > 0 ||
    progress.missingRationaleCount > 0 ||
    saving ||
    completing;

  const updateDraft = (questionCode: string, updates: Partial<DraftResponse>) => {
    setDrafts((previous) => ({
      ...previous,
      [questionCode]: {
        ...(previous[questionCode] ?? emptyDraft()),
        ...updates,
      },
    }));
    setValidationErrors((previous) => {
      if (!previous[questionCode]) return previous;
      const next = { ...previous };
      delete next[questionCode];
      return next;
    });
  };

  const buildSavePayload = () =>
    Object.entries(drafts)
      .filter(([, draft]) => Boolean(draft.answer))
      .map(([questionCode, draft]) => ({
        questionCode,
        answer: draft.answer as ImpactAnswer,
        rationale: normalize(draft.rationale) || null,
        evidenceReference: normalize(draft.evidenceReference) || null,
      }));

  const handleInitialize = async () => {
    if (!releaseId || !canEdit) return;
    setInitializing(true);
    setPageError(null);
    try {
      const initialized = await initializeImpactAssessment(releaseId);
      setAssessment(initialized);
      setQuestions(initialized.questions?.length ? initialized.questions : questions);
      setDrafts(responseDraftFromAssessment(initialized.responses));
      toast.success("Impact assessment initialized");
    } catch (error) {
      const message =
        axios.isAxiosError(error) && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : "";
      if (axios.isAxiosError(error) && error.response?.status === 409 && message.toLowerCase().includes("already exists")) {
        try {
          const existing = await getImpactAssessment(releaseId);
          if (existing) {
            setAssessment(existing);
            setQuestions(existing.questions?.length ? existing.questions : questions);
            setDrafts(responseDraftFromAssessment(existing.responses));
            toast.success("Existing impact assessment loaded");
            return;
          }
        } catch {
          // Fall through to the original API error so the user sees the controlled backend message.
        }
      }
      const mapped = mapImpactError(error);
      setPageError(mapped.message);
      toast.error(mapped.message);
    } finally {
      setInitializing(false);
    }
  };

  const handleSave = async () => {
    if (!assessment || !canEdit || readOnly) return;
    setSaving(true);
    setPageError(null);
    try {
      const result = await saveImpactAssessmentResponses(assessment.assessmentId, buildSavePayload());
      setSaveResult(result);
      setValidationErrors(
        Object.fromEntries(
          (result.validationErrors ?? []).map((item) => [
            item.questionCode,
            { [item.field]: item.message },
          ]),
        ),
      );
      toast.success("Draft responses saved");
      const refreshed = await getImpactAssessment(releaseId!);
      if (refreshed) {
        setAssessment(refreshed);
        setDrafts(responseDraftFromAssessment(refreshed.responses));
      }
    } catch (error) {
      const mapped = mapImpactError(error);
      setValidationErrors(mapped.errors);
      setPageError(mapped.message);
      toast.error(mapped.message);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!assessment || completeDisabled) return;
    setCompleting(true);
    setPageError(null);
    try {
      const result = await completeImpactAssessment(assessment.assessmentId);
      setCompleteResult(result);
      toast.success("Impact assessment completed. Validation scope defined.");
      const refreshed = await getImpactAssessment(releaseId!);
      if (refreshed) {
        setAssessment(refreshed);
        setDrafts(responseDraftFromAssessment(refreshed.responses));
      }
      await onLifecycleChanged?.(result);
    } catch (error) {
      const mapped = mapImpactError(error);
      setValidationErrors(mapped.errors);
      setPageError(mapped.message);
      toast.error(mapped.message);
    } finally {
      setCompleting(false);
    }
  };

  const handleSuggest = async () => {
    if (!releaseId || !assessment?.aiAssistantEnabled || !canEdit || readOnly) return;
    setSuggesting(true);
    setPageError(null);
    try {
      const result = await suggestImpactAssessmentAnswers(releaseId);
      setAiSuggestions(Object.fromEntries(result.suggestions.map((suggestion) => [suggestion.questionCode, suggestion])));
      toast.success("AI suggestions loaded for review");
    } catch (error) {
      const mapped = mapImpactError(error);
      setPageError(mapped.message);
      toast.error(mapped.message);
    } finally {
      setSuggesting(false);
    }
  };

  const handleReopen = async () => {
    if (!assessment || !canEdit || !normalize(reopenReason)) return;
    setReopening(true);
    setPageError(null);
    try {
      const reopened = await reopenImpactAssessment(assessment.assessmentId, reopenReason);
      setAssessment(reopened);
      setDrafts(responseDraftFromAssessment(reopened.responses));
      setReopenReason("");
      toast.success("Impact assessment reopened");
      await onLifecycleChanged?.(reopened);
    } catch (error) {
      const mapped = mapImpactError(error);
      setPageError(mapped.message);
      toast.error(mapped.message);
    } finally {
      setReopening(false);
    }
  };

  const applySuggestion = (suggestion: ImpactAssessmentAISuggestion) => {
    updateDraft(suggestion.questionCode, {
      answer: suggestion.suggestedAnswer,
      rationale: suggestion.suggestedRationale ?? "",
      evidenceReference: suggestion.evidenceReference ?? "",
    });
    toast.message("Suggestion applied to draft");
  };

  if (!release) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
        Select or create a release to start impact assessment.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <ScoreBadge label="Release" value={release.release_name || release.version} />
          <ScoreBadge label="Version" value={release.version} />
          <ScoreBadge label="Package No." value={assessment?.packageNo || release.validation_package?.package_no || "-"} />
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
            <p className="text-xs font-medium text-slate-500">Release Status</p>
            <Badge variant="outline" className={`mt-1 ${getReleaseStatusBadgeClass(preview?.releaseStatus ?? release.release_status)}`}>
              {formatReleaseStatus(preview?.releaseStatus ?? release.release_status)}
            </Badge>
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
            <p className="text-xs font-medium text-slate-500">Package Status</p>
            <Badge variant="outline" className={`mt-1 ${getPackageStatusBadgeClass(preview?.packageStatus ?? release.validation_package?.package_status)}`}>
              {formatReleaseEnum(preview?.packageStatus ?? release.validation_package?.package_status)}
            </Badge>
          </div>
          <ScoreBadge label="Impact Assessment Status" value={assessment?.status ?? release.validation_package?.impact_assessment_status ?? "PENDING"} />
          <ScoreBadge label="Risk Level" value={formatReleaseEnum(preview?.riskLevel ?? release.validation_package?.risk_level)} />
          <ScoreBadge label="Validation Scope" value={formatReleaseEnum(preview?.validationScope ?? release.validation_package?.validation_scope)} />
        </div>
      </section>

      {pageError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          Loading impact assessment...
        </div>
      ) : !assessment ? (
        <div className="rounded-md border border-slate-200 bg-white px-4 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {release.validation_package ? "Impact assessment is ready to initialize" : "Validation package is required first"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {release.validation_package
                  ? `${questions.length} backend-controlled questions available`
                  : "This release does not have the Step 1 validation package needed for Step 2."}
              </p>
            </div>
            {release.validation_package ? (
              <Button type="button" onClick={() => void handleInitialize()} disabled={!canEdit || initializing}>
                <ClipboardList className="h-4 w-4" />
                {initializing ? "Initializing..." : "Initialize Assessment"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {assessment.aiAssistantEnabled && !readOnly ? (
            <section className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-sky-900">
                  AI suggestions are draft only. Final score and validation scope are calculated by backend rules after user review.
                </p>
                <Button type="button" variant="secondary" onClick={() => void handleSuggest()} disabled={!canEdit || suggesting}>
                  <Sparkles className="h-4 w-4" />
                  {suggesting ? "Suggesting..." : "AI Suggest Answers"}
                </Button>
              </div>
            </section>
          ) : null}

          <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <ScoreBadge label="Answered" value={`${progress.answered} / ${progress.total}`} />
            <ScoreBadge label="Missing Required" value={progress.missingRequiredCount} />
            <ScoreBadge label="Missing Rationale" value={progress.missingRationaleCount} />
            <ScoreBadge label="Critical YES/UNKNOWN" value={progress.criticalRiskCount} />
          </section>

          <section className="space-y-4">
            {groupedQuestions.map((group) => (
              <div key={group.category} className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-900">{group.category}</h4>
                {group.questions.map((question) => {
                  const draft = drafts[question.questionCode] ?? emptyDraft();
                  const suggestion = aiSuggestions[question.questionCode];
                  const fieldErrors = validationErrors[question.questionCode] ?? {};
                  const needsRationale =
                    draft.answer === "YES" ||
                    draft.answer === "UNKNOWN" ||
                    (draft.answer === "NOT_APPLICABLE" && question.critical);
                  const rationaleMissing = needsRationale && !normalize(draft.rationale);

                  return (
                    <div key={question.questionCode} className="rounded-md border border-slate-200 bg-white px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                              {question.questionCode}
                            </Badge>
                            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                              Weight {question.weight}
                            </Badge>
                            {question.critical ? (
                              <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                                Critical
                              </Badge>
                            ) : null}
                            {question.mandatory ? (
                              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                                Mandatory
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-3 text-sm font-medium leading-6 text-slate-900">{question.questionText}</p>
                        </div>
                        {draft.answer === "YES" || draft.answer === "UNKNOWN" ? (
                          <AlertTriangle className="mt-1 h-4 w-4 text-amber-600" />
                        ) : null}
                      </div>

                      <div className="mt-4 space-y-3">
                        <RadioGroup
                          value={draft.answer ?? ""}
                          onValueChange={(value) => updateDraft(question.questionCode, { answer: value as ImpactAnswer })}
                          className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
                          disabled={readOnly || !canEdit}
                        >
                          {ANSWER_OPTIONS.map((option) => {
                            const id = `${question.questionCode}-${option.value}`;
                            return (
                              <label
                                key={option.value}
                                htmlFor={id}
                                className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                              >
                                <RadioGroupItem id={id} value={option.value} disabled={readOnly || !canEdit} />
                                {option.label}
                              </label>
                            );
                          })}
                        </RadioGroup>
                        {fieldErrors.answer ? <p className="text-xs text-red-600">{fieldErrors.answer}</p> : null}

                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                          <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">Rationale</label>
                            <Textarea
                              rows={3}
                              value={draft.rationale}
                              onChange={(event) => updateDraft(question.questionCode, { rationale: event.target.value })}
                              disabled={readOnly || !canEdit}
                              className={rationaleMissing || fieldErrors.rationale ? "border-red-300" : undefined}
                            />
                            {fieldErrors.rationale ? <p className="text-xs text-red-600">{fieldErrors.rationale}</p> : null}
                          </div>
                          <Input
                            label="Evidence / Reference"
                            value={draft.evidenceReference}
                            onChange={(event) => updateDraft(question.questionCode, { evidenceReference: event.target.value })}
                            disabled={readOnly || !canEdit}
                          />
                        </div>
                      </div>

                      {suggestion ? (
                        <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase text-sky-700">AI Suggestion</p>
                              <p className="mt-1 text-sm text-sky-950">
                                {suggestion.suggestedAnswer} - {suggestion.suggestedRationale || "No rationale provided"}
                              </p>
                              <p className="mt-1 text-xs text-sky-800">
                                Confidence: {suggestion.confidence}
                                {suggestion.evidenceReference ? ` | Evidence: ${suggestion.evidenceReference}` : ""}
                              </p>
                              {suggestion.caveat ? <p className="mt-1 text-xs text-sky-800">{suggestion.caveat}</p> : null}
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => applySuggestion(suggestion)}
                              disabled={readOnly || !canEdit}
                            >
                              Apply Suggestion
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </section>

          <section className="space-y-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <ScoreBadge label="Total Score" value={preview?.totalScore ?? 0} />
              <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs font-medium text-slate-500">Risk Level</p>
                <Badge variant="outline" className={`mt-1 ${getImpactLevelBadgeClass(preview?.riskLevel)}`}>
                  {formatReleaseEnum(preview?.riskLevel)}
                </Badge>
              </div>
              <ScoreBadge label="Validation Scope" value={formatReleaseEnum(preview?.validationScope)} />
              <ScoreBadge label="Next Step" value={preview?.nextStep ? formatReleaseEnum(preview.nextStep) : "-"} />
            </div>
            {preview?.summary ? <p className="text-sm text-slate-700">{preview.summary}</p> : null}
            {(saveResult?.validationErrors?.length ?? 0) > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Save preview includes backend validation warnings. Complete remains blocked until they are resolved.
              </div>
            ) : null}
          </section>

          <section className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading || saving || completing}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              {!readOnly ? (
                <Button type="button" variant="secondary" onClick={() => void handleSave()} disabled={!canEdit || saving || completing}>
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Draft"}
                </Button>
              ) : null}
              {!readOnly ? (
                <Button type="button" onClick={() => void handleComplete()} disabled={completeDisabled}>
                  <CheckCircle2 className="h-4 w-4" />
                  {completing ? "Completing..." : "Complete Assessment"}
                </Button>
              ) : null}
              {readOnly ? (
                <Button type="button" onClick={onContinueToDocumentChecklist}>
                  Continue to Document Checklist
                </Button>
              ) : null}
            </div>
          </section>

          {readOnly && assessment.canReopen ? (
            <section className="space-y-3 rounded-md border border-slate-200 bg-white px-4 py-3">
              <Textarea
                rows={3}
                value={reopenReason}
                onChange={(event) => setReopenReason(event.target.value)}
                placeholder="Reopen reason"
                disabled={!canEdit || reopening}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleReopen()}
                disabled={!canEdit || reopening || !normalize(reopenReason)}
              >
                <RotateCcw className="h-4 w-4" />
                {reopening ? "Reopening..." : "Reopen Assessment"}
              </Button>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
