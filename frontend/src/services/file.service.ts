/**
 * 🩺 HAEMI LIFE — SECURE FILE DOWNLOAD SERVICE
 * CLASSIFICATION: ENTERPRISE-GRADE | ZERO-TRUST
 */

import api from "./api";

export async function secureDownload({
  url,
  fileName,
}: {
  url: string;
  fileName: string;
  token?: string; // Token is now handled automatically by api instance
}) {
  try {
    const response = await api.get(url, {
      responseType: 'blob',
    });

    // P1 FIX: Throw error if status is not 200 to prevent corrupt blob creation
    if (response.status !== 200) {
      throw new Error(`Download failed with status: ${response.status}`);
    }

    const blob = response.data;

    // Integrity-safe download using safe blob URL
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = 'none';
    a.href = downloadUrl;
    a.download = fileName;
    
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
    }, 100);
  } catch (error) {
    console.error('[SECURE_DOWNLOAD] Error:', error);
    throw error;
  }
}
