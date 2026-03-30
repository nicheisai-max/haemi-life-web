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
    const response: AxiosResponse<Blob> = await api.get(url, {
      responseType: 'blob',
      // Ensure we don't follow non-binary redirects if possible
      validateStatus: (status) => status === 200
    });

    // P0 HARDENING: Prevent 'Ghost File' downloads from API / Vite fallback mapping
    const contentType = response.headers['content-type'] || response.data.type || '';
    
    // 🔴 STEP 2 — ADD EXACTLY:
    const allowedMimeTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'text/plain'
    ];
    const isAllowed = allowedMimeTypes.includes(contentType.toLowerCase());

    // 🔴 STEP 3 — REPLACE VALIDATION BLOCK WITH:
    if (!isAllowed || contentType === 'application/octet-stream') {
      console.error('[SECURITY] Blocked MIME:', contentType);
      throw new Error('Blocked: Invalid file type');
    }

    // 🔴 2.4 ZERO BYTE BLOCK (KEEP)
    if (response.data.size === 0) {
      throw new Error('Blocked: Empty file');
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
