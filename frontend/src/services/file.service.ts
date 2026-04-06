import api from "./api";
import { AxiosResponse } from "axios";

// 🔒 HAEMI LIFE — CRITICAL DOWNLOAD PIPELINE LOCK
// ⚠️ DO NOT MODIFY THIS BLOCK WITHOUT EXPLICIT USER APPROVAL
// This section enforces file integrity and prevents ghost downloads.
// Any modification requires forensic re-validation.
// Unauthorized changes will be treated as SYSTEM BREACH.
// id="lock1"

// 🔒 HAEMI LIFE — TYPE SAFETY LOCK
// id="lock2"
export interface FileDownloadDTO {
  url: string;
  fileName: string;
}

export async function secureDownload(dto: FileDownloadDTO) {
  const { url, fileName } = dto;
  
  if (!url || typeof url !== 'string' || !url.includes('/files/')) {
    console.error('[Lock-Guard] Blocked insecure or malformed download URL:', url);
    return;
  }

  try {
    // P0 FIX: Append mode=download to trigger attachment header on backend (HL-FILE-2026-003)
    const downloadUrlQuery = url.includes('?') ? `${url}&mode=download` : `${url}?mode=download`;
    const response: AxiosResponse<Blob> = await api.get(downloadUrlQuery, {
      responseType: 'blob',
      // Ensure we don't follow non-binary redirects if possible
      validateStatus: (status) => status === 200
    });

    // P0 HARDENING: Prevent 'Ghost File' downloads and ensure MIME integrity (Phase 8.8 - FINAL LOCK)
    const contentType = (response.headers['content-type'] || response.data.type || '').toLowerCase();
    const size = response.data.size;

    // Security Rules:
    // 1. MUST have a content-type
    // 2. MUST not be zero-byte (corruption/empty)
    const isInvalid = !contentType || size === 0;

    if (isInvalid) {
      console.error('[SECURITY] Blocked insecure download:', { contentType, size });
      throw new Error('Blocked: Insecure or empty file detected');
    }

    const blob = response.data;
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = 'none';
    a.href = downloadUrl;
    a.download = fileName || 'attachment';
    
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
        window.URL.revokeObjectURL(downloadUrl);
    }, 100);
  } catch (error) {
    console.error('[SECURE_DOWNLOAD] Locked Pipeline caught error:', error);
    throw error;
  }
}
