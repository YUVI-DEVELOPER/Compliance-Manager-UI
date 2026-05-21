import { api } from "./api";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ReleaseRecord {
  release_id: string;
  asset_id: string;
  version: string;
  system_config_report?: string | null;
  documentation_mode?: string | null;
  documentation_text?: string | null;
  documentation_source_url?: string | null;
  documentation_fetched_at?: string | null;
  created_dt?: string | null;
  end_dt?: string | null;
  created_by?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
  asset_name?: string | null;
  asset_type?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  supplier_name?: string | null;
}

export type CreateReleasePayload = {
  version: string;
  created_by: string;
  documentation_mode: string;
  system_config_report?: string | null;
  documentation_text?: string | null;
  documentation_source_url?: string | null;
  end_dt?: string | null;
};

export type UpdateReleasePayload = {
  modified_by: string;
  version?: string;
  documentation_mode?: string;
  system_config_report?: string | null;
  documentation_text?: string | null;
  documentation_source_url?: string | null;
  end_dt?: string | null;
};

export interface ReleaseImpactAssessmentRecord {
  assessment_id: string;
  release_id: string;
  previous_release_id?: string | null;
  report_title: string;
  report_content: string;
  report_format: string;
  diff_summary?: Record<string, unknown> | null;
  impact_level?: string | null;
  generated_dt?: string | null;
  created_by?: string | null;
}

const parseContentDispositionFilename = (header?: string): string | null => {
  if (!header) return null;

  const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim());
    } catch {
      return utfMatch[1].trim();
    }
  }

  const quotedMatch = header.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1].trim();
  }

  const plainMatch = header.match(/filename=([^;]+)/i);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }

  return null;
};

const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

interface ReleaseApiRecord extends Omit<ReleaseRecord, "version"> {
  version?: string | null;
}

const parseResponse = <T>(payload: ApiResponse<T>): T => {
  if (!payload.success) {
    throw new Error(payload.message || "Request failed");
  }
  return payload.data;
};

const mapReleaseRecord = (record: ReleaseApiRecord): ReleaseRecord => ({
  ...record,
  version: record.version ?? "",
  documentation_mode: record.documentation_mode ?? "MANUAL",
});

export const getReleasesByAssetId = async (assetId: string): Promise<ReleaseRecord[]> => {
  const response = await api.get<ApiResponse<ReleaseApiRecord[]>>(`/asset/${assetId}/releases`);
  return (parseResponse(response.data) ?? []).map(mapReleaseRecord);
};

export const createRelease = async (
  assetId: string,
  payload: CreateReleasePayload,
): Promise<ReleaseRecord> => {
  const response = await api.post<ApiResponse<ReleaseApiRecord>>(`/asset/${assetId}/releases`, payload);
  return mapReleaseRecord(parseResponse(response.data));
};

export const getReleaseById = async (releaseId: string): Promise<ReleaseRecord> => {
  const response = await api.get<ApiResponse<ReleaseApiRecord>>(`/release/${releaseId}`);
  return mapReleaseRecord(parseResponse(response.data));
};

export const updateRelease = async (
  releaseId: string,
  payload: UpdateReleasePayload,
): Promise<ReleaseRecord> => {
  const response = await api.put<ApiResponse<ReleaseApiRecord>>(`/release/${releaseId}`, payload);
  return mapReleaseRecord(parseResponse(response.data));
};

export const deleteRelease = async (releaseId: string): Promise<null> => {
  const response = await api.delete<ApiResponse<null>>(`/release/${releaseId}`);
  return parseResponse(response.data);
};

export const getImpactAssessment = async (releaseId: string): Promise<ReleaseImpactAssessmentRecord> => {
  const response = await api.get<ApiResponse<ReleaseImpactAssessmentRecord>>(
    `/release/${releaseId}/impact-assessment`,
  );
  return parseResponse(response.data);
};

export const regenerateImpactAssessment = async (
  releaseId: string,
): Promise<ReleaseImpactAssessmentRecord> => {
  const response = await api.post<ApiResponse<ReleaseImpactAssessmentRecord>>(
    `/release/${releaseId}/impact-assessment/regenerate`,
  );
  return parseResponse(response.data);
};

export const downloadImpactAssessment = async (releaseId: string): Promise<string> => {
  try {
    const response = await api.get<Blob>(`/release/${releaseId}/impact-assessment/download`, {
      responseType: "blob",
    });
    const contentType = response.headers["content-type"] || "text/markdown";
    const fileName =
      parseContentDispositionFilename(response.headers["content-disposition"]) ||
      `release-${releaseId}-impact-assessment.md`;
    const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: contentType });

    triggerBlobDownload(blob, fileName);
    return fileName;
  } catch (error) {
    if (typeof error === "object" && error !== null && "isAxiosError" in error) {
      const axiosError = error as {
        response?: {
          data?: Blob;
          headers?: Record<string, string>;
        };
      };
      const blob = axiosError.response?.data;
      const contentType = axiosError.response?.headers?.["content-type"] || "";

      if (blob instanceof Blob && contentType.includes("json")) {
        try {
          const text = await blob.text();
          const parsed = JSON.parse(text) as object;
          (axiosError.response as { data?: unknown }).data = parsed;
        } catch {
          // Fall through and rethrow the original Axios error.
        }
      }
    }

    throw error;
  }
};
