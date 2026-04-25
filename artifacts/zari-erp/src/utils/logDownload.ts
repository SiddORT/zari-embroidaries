import { customFetch } from "@workspace/api-client-react";

export interface DownloadLogParams {
  file_type: "PDF" | "Excel" | "CSV" | string;
  file_name: string;
  module?: string;
  reference?: string;
}

export async function logDownload(params: DownloadLogParams): Promise<void> {
  try {
    await customFetch("/api/settings/download-logs", {
      method: "POST",
      body: JSON.stringify(params),
    });
  } catch {
    // fire-and-forget — never block the download
  }
}
