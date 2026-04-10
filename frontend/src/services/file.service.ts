/**
 * 🩺 HAEMI LIFE — INSTITUTIONAL DOWNLOAD PIPELINE (v5.0)
 * Standard: Google/Meta Zero-Drift Engineering
 * Protocol: Verified Metadata Extraction & Native Tunneling
 */

import { AxiosResponse } from 'axios';
import api from './api';
import { logger } from '../utils/logger';

interface DownloadOptions {
  url: string;
  fileName: string; // Restored from originalFileName to maintain multi-page sync
}

/**
 * 🧬 INSTITUTIONAL DOWNLOAD PROTECTOR
 * Resolves the "Ghost Download" issue by enforcing strict metadata binding.
 */
export const secureDownload = async (options: DownloadOptions): Promise<void> => {
  const { url, fileName: providedFileName } = options;

  if (!url) {
    logger.error('[Security] Blocked download request without URL');
    throw new Error('Invalid download URL');
  }

  try {
    // P0: Protocol Detection (Institutional Safety)
    const isLocalResource: boolean = url.startsWith('blob:') || url.startsWith('data:');

    if (isLocalResource) {
      logger.info('[FileService] Local resource detected. Triggering native tunnel.', { providedFileName });
      triggerAnchorDownload(url, providedFileName || 'haemi_file');
      return;
    }

    // P1: Remote Resource Resolution
    const normalizedUrl: string = url.startsWith('/api') ? url.replace(/^\/api/, '') : url;
    const downloadUrlQuery: string = normalizedUrl.includes('?') ? `${normalizedUrl}&mode=download` : `${normalizedUrl}?mode=download`;

    const response: AxiosResponse<Blob> = await api.get(downloadUrlQuery, {
      responseType: 'blob',
      headers: {
        'Accept': '*/*',
        'Cache-Control': 'no-cache'
      }
    });

    // P2: Forensic Filename Extraction (Server > Callback > Fallback)
    const disposition = response.headers['content-disposition'];
    let finalFileName: string = providedFileName;

    if (disposition && disposition.indexOf('filename=') !== -1) {
      const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
      const matches = filenameRegex.exec(disposition);
      if (matches != null && matches[1]) {
        finalFileName = matches[1].replace(/['"]/g, '');
      }
    }

    // Default to a safe name if metadata is completely missing
    if (!finalFileName) {
      const urlParts = url.split('/');
      finalFileName = urlParts[urlParts.length - 1] || 'clinical_record.pdf';
    }

    // P3: Institutional Security Guard (System File Blocking)
    const contentType: string = (response.headers['content-type'] || response.data.type || '').toLowerCase();
    const size: number = response.data.size;
    
    // Sensitivity Rules: Block executables and system-critical extensions
    const sensitiveExtensions = ['.exe', '.bat', '.msi', '.sh', '.bin', '.dll'];
    const isSensitiveType: boolean = sensitiveExtensions.some(ext => finalFileName.toLowerCase().endsWith(ext));
    
    const isJsonError: boolean = contentType.includes('application/json');
    const isHtmlError: boolean = contentType.includes('text/html');

    if (isSensitiveType) {
      logger.warn('[Security] Blocked sensitive file download attempt', { finalFileName, contentType });
      throw new Error('FILE_TYPE_NOT_SUPPORTED');
    }

    if (size === 0 || isJsonError || isHtmlError) {
      logger.error('[Security] Blocked malformed download', { contentType, size });
      throw new Error('SERVER_INTEGRITY_ERROR');
    }

    const downloadUrl: string = window.URL.createObjectURL(response.data);
    triggerAnchorDownload(downloadUrl, finalFileName);

    // Institutional Memory Buffer: 8s delay ensures browser finishes the save operation
    setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 8000);

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[FileService] Secure download failed:', { url, providedFileName, error: errorMsg });
    throw error;
  }
};

/**
 * 🧬 NATIVE DOWNLOAD ENGINE (v5.0)
 * Synchronous Anchor Binding with Delayed Lifecycle Cleanup.
 */
const triggerAnchorDownload = (url: string, fileName: string): void => {
  const link: HTMLAnchorElement = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  link.style.display = 'none';
  
  // Necessary for certain browser security policies
  document.body.appendChild(link);
  
  // Synchronous Trigger
  link.click();
  
  // Delayed Cleanup: Ensures DOM removal doesn't interrupt the browser's download stream
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
  }, 200);
};

