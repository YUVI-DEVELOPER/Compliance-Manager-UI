import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/Table";
import { parseCsv } from "./csv";

export type CsvExpectedColumn = {
  label: string;
  required?: boolean;
};

type CsvRowRecord = Record<string, string>;

export type CsvParseResult<T> = {
  payload?: T;
  errors: string[];
};

type CsvValidatedRow<T> = {
  rowNumber: number;
  row: CsvRowRecord;
  errors: string[];
  payload?: T;
};

type CsvFailure = { rowNumber: number; message: string };

interface CsvImportModalProps<T> {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  expectedColumns: CsvExpectedColumn[];
  initialCsvText?: string;
  onPickFile: () => void;
  parseRow: (row: CsvRowRecord, rowNumber: number) => CsvParseResult<T>;
  onSubmitRow: (payload: T) => Promise<void>;
  onAfterSubmit?: () => Promise<void> | void;
  concurrency?: number;
}

const normalizeHeader = (value: string) => value.trim().toLowerCase();

const runWithConcurrency = async (tasks: Array<() => Promise<void>>, limit: number) => {
  const queue = tasks.slice();
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (queue.length) {
      const task = queue.shift();
      if (!task) return;
      await task();
    }
  });
  await Promise.all(workers);
};

export function CsvImportModal<T>({
  open,
  onClose,
  title,
  description,
  expectedColumns,
  initialCsvText,
  onPickFile,
  parseRow,
  onSubmitRow,
  onAfterSubmit,
  concurrency = 4,
}: CsvImportModalProps<T>) {
  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [rows, setRows] = useState<Array<CsvValidatedRow<T>>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: CsvFailure[] } | null>(null);

  const didAutoPick = useRef(false);

  useEffect(() => {
    if (!open) return;
    didAutoPick.current = false;
    setFileError(null);
    setResult(null);
    if (initialCsvText) {
      setCsvText(initialCsvText);
    } else {
      setCsvText(null);
      setRows([]);
    }
  }, [initialCsvText, open]);

  useEffect(() => {
    if (!open) return;
    if (didAutoPick.current) return;
    if (initialCsvText) return;
    didAutoPick.current = true;
    onPickFile();
  }, [initialCsvText, onPickFile, open]);

  useEffect(() => {
    if (!open) return;
    if (!csvText) return;

    setFileError(null);
    setResult(null);

    const parsed = parseCsv(csvText);
    if (parsed.length === 0) {
      setRows([]);
      setFileError("CSV is empty.");
      return;
    }

    const headerRow = parsed[0].map((h) => h.trim());
    const headerIndex = new Map<string, number>();
    headerRow.forEach((h, index) => {
      const key = normalizeHeader(h);
      if (key) headerIndex.set(key, index);
    });

    const missingRequired = expectedColumns
      .filter((c) => c.required)
      .filter((c) => !headerIndex.has(normalizeHeader(c.label)))
      .map((c) => c.label);

    if (missingRequired.length) {
      setRows([]);
      setFileError(`Missing required column(s): ${missingRequired.join(", ")}`);
      return;
    }

    const dataRows = parsed.slice(1);
    const validated: Array<CsvValidatedRow<T>> = dataRows
      .map((cells, i) => {
        const rowNumber = i + 2;
        if (cells.every((cell) => cell.trim() === "")) return null;

        const record: CsvRowRecord = {};
        expectedColumns.forEach(({ label }) => {
          const index = headerIndex.get(normalizeHeader(label));
          record[label] = index === undefined ? "" : (cells[index] ?? "");
        });

        const parsedRow = parseRow(record, rowNumber);
        return {
          rowNumber,
          row: record,
          errors: parsedRow.errors ?? [],
          payload: parsedRow.payload,
        };
      })
      .filter((value): value is CsvValidatedRow<T> => value !== null);

    if (validated.length === 0) {
      setRows([]);
      setFileError("No data rows found in CSV.");
      return;
    }

    setRows(validated);
  }, [csvText, expectedColumns, open, parseRow]);

  const validPayloads = useMemo(() => rows.filter((r) => r.errors.length === 0 && r.payload !== undefined) as Array<CsvValidatedRow<T> & { payload: T }>, [rows]);
  const invalidCount = useMemo(() => rows.filter((r) => r.errors.length > 0 || r.payload === undefined).length, [rows]);

  const handleSubmit = async () => {
    if (submitting) return;
    if (fileError) return;
    if (!csvText) return;
    if (validPayloads.length === 0) {
      setFileError("No valid rows to import.");
      return;
    }

    setSubmitting(true);
    setFileError(null);
    setResult(null);

    const failures: CsvFailure[] = [];
    let success = 0;

    const tasks = validPayloads.map((item) => async () => {
      try {
        await onSubmitRow(item.payload);
        success += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Request failed";
        failures.push({ rowNumber: item.rowNumber, message });
      }
    });

    try {
      await runWithConcurrency(tasks, concurrency);
      await onAfterSubmit?.();
      setResult({ success, failed: failures.sort((a, b) => a.rowNumber - b.rowNumber) });
    } finally {
      setSubmitting(false);
    }
  };

  const preview = rows.slice(0, 15);

  return (
    <Modal
      open={open}
      onClose={() => {
        if (submitting) return;
        onClose();
      }}
      title={title}
      description={description}
      size="xl"
      footer={
        <>
          <Button type="button" variant="ghost" disabled={submitting} onClick={onClose}>
            Close
          </Button>
          <Button type="button" disabled={submitting || !!fileError || validPayloads.length === 0} loading={submitting} onClick={() => void handleSubmit()}>
            Submit
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm text-slate-600">
            <div className="font-medium text-slate-900">Expected columns</div>
            <div className="mt-1 text-slate-500">
              {expectedColumns.map((c) => (c.required ? `${c.label} *` : c.label)).join(", ")}
            </div>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={onPickFile} disabled={submitting}>
            Choose CSV
          </Button>
        </div>

        {fileError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {fileError}
          </div>
        )}

        {!csvText && !fileError && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No CSV selected.
          </div>
        )}

        {csvText && !fileError && (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 flex items-center justify-between">
            <div>
              Rows: <span className="font-medium text-slate-900">{rows.length}</span>
              {" · "}
              Valid: <span className="font-medium text-slate-900">{validPayloads.length}</span>
              {" · "}
              Invalid: <span className="font-medium text-slate-900">{invalidCount}</span>
            </div>
            {result && (
              <div className="text-slate-500">
                Imported <span className="font-medium text-slate-900">{result.success}</span>
                {result.failed.length ? (
                  <>
                    {" · "}
                    Failed <span className="font-medium text-slate-900">{result.failed.length}</span>
                  </>
                ) : null}
              </div>
            )}
          </div>
        )}

        {result?.failed.length ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="font-medium">Some rows failed</div>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              {result.failed.slice(0, 8).map((f) => (
                <li key={`${f.rowNumber}-${f.message}`}>
                  Row {f.rowNumber}: {f.message}
                </li>
              ))}
              {result.failed.length > 8 ? <li>…and {result.failed.length - 8} more</li> : null}
            </ul>
          </div>
        ) : null}

        {preview.length ? (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {expectedColumns.map((c) => (
                    <TableHead key={c.label}>{c.label}</TableHead>
                  ))}
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((r) => (
                  <TableRow key={r.rowNumber}>
                    {expectedColumns.map((c) => (
                      <TableCell key={c.label}>{r.row[c.label] || "-"}</TableCell>
                    ))}
                    <TableCell className={r.errors.length ? "text-red-600" : "text-green-700"}>
                      {r.errors.length ? r.errors[0] : "Ready"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
