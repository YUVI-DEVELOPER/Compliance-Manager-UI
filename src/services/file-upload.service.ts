import { api } from "./api";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface UploadedDocumentFileRecord {
  file_name: string;
  original_file_name: string;
  content_type?: string | null;
  file_size: number;
  access_url: string;
  relative_path: string;
}

const parseResponse = <T>(payload: ApiResponse<T>): T => {
  if (!payload.success) {
    throw new Error(payload.message || "Request failed");
  }
  return payload.data;
};

export const uploadDocumentFile = async (
  file: File,
  category = "general",
): Promise<UploadedDocumentFileRecord> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);

  const response = await api.post<ApiResponse<UploadedDocumentFileRecord>>(
    "/file-uploads/documents",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return parseResponse(response.data);
};
