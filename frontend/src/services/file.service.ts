/**
 * 🔒 HAEMI LIFE — INSTITUTIONAL DOWNLOAD PIPELINE (v6.0)
 * Standard: Google/Meta Zero-Drift Engineering
 * Protocol: Verified Metadata Extraction & Native Tunneling
 */

import { AxiosResponse } from 'axios';
import api from './api';
import { logger } from '../utils/logger';

/**
 * 🧬 FILE DOMAIN REGISTRY
 * Categorizes files into distinct institutional silos (In-sync with backend)
 */
export enum FileDomain {
  CHAT = 'chat',
  CLINICAL = 'clinical',
  PROFILE = 'profile',
  SYSTEM = 'system'
}

interface DownloadOptions {
  url: string;
  fileName: string;
  domain?: FileDomain;
}

/**
 * 🧬 INSTITUTIONAL DOWNLOAD PROTECTOR
 * Resolves the "Ghost Download" issue by enforcing strict metadata binding.
 */
export const secureDownload = async (options: DownloadOptions): Promise<void> => {
  const { url, fileName: providedFileName, domain } = options;

  if (!url) {
    logger.error('[Security] Blocked download request without URL');
    throw new Error('DOWNLOAD_URL_MISSING');
  }

  try {
    // P0: Protocol Detection (Institutional Safety)
    const isLocalResource: boolean = url.startsWith('blob:') || url.startsWith('data:');

    if (isLocalResource) {
      logger.info('[FileService] Local resource detected. Triggering native tunnel.', { 
        providedFileName, 
        domain 
      });
      triggerAnchorDownload(url, providedFileName || 'haemi_file');
      return;
    }

    // P1: Remote Resource Resolution
    const normalizedUrl: string = url.startsWith('/api') ? url.replace(/^\/api/, '') : url;
    const downloadUrlQuery: string = normalizedUrl.includes('?') 
      ? `${normalizedUrl}&mode=download` 
      : `${normalizedUrl}?mode=download`;

    logger.info('[FileService] Initiating verified binary stream download', { domain, url: normalizedUrl });

    const response: AxiosResponse<Blob> = await api.get(downloadUrlQuery, {
      responseType: 'blob',
      headers: {
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
        'X-Client-Domain': domain || 'unknown'
      }
    });

    // P2: Forensic Filename Extraction
    const disposition = response.headers['content-disposition'];
    let finalFileName: string = providedFileName;

    if (disposition && typeof disposition === 'string' && disposition.includes('filename=')) {
      const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
      const matches = filenameRegex.exec(disposition);
      if (matches != null && matches[1]) {
        finalFileName = matches[1].replace(/['"]/g, '');
      }
    }

    // P3: Institutional Security Guard
    const rawContentType = response.headers['content-type'];
    const contentType: string = (typeof rawContentType === 'string' ? rawContentType : response.data.type || '').toLowerCase();
    const size: number = response.data.size;
    const etag: string | undefined = response.headers['etag'];
    
    // Sensitivity Rules: Block executables and system-critical extensions
    const sensitiveExtensions = ['.exe', '.bat', '.msi', '.sh', '.bin', '.dll'];
    
    const isJsonError: boolean = contentType.includes('application/json');
    const isHtmlError: boolean = contentType.includes('text/html');

    // Architecture: Prevents 'Ghost IDs' from becoming filenames (Institutional Standard)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!finalFileName || uuidRegex.test(finalFileName)) {
      const urlParts = url.split('?')[0].split('/');
      const lastPart = urlParts[urlParts.length - 1];
      finalFileName = (!lastPart || uuidRegex.test(lastPart)) ? 'haemi_attachment.bin' : lastPart;
    }

    const isSensitiveType: boolean = sensitiveExtensions.some(ext => finalFileName.toLowerCase().endsWith(ext));

    if (isSensitiveType) {
      logger.warn('[Security] Blocked sensitive file download attempt', { finalFileName, contentType });
      throw new Error('FILE_TYPE_RESTRICTED');
    }

    // P4: FINAL INTEGRITY GATE (Google/Meta Standard)
    if (size === 0 || isJsonError || isHtmlError) {
      if (isJsonError) {
          const errorMsg = await extractErrorMessage(response.data);
          logger.error('[Security] Blocked malformed download (Ghost File Prevention)', { 
              errorMsg,
              url,
              etag 
          });
          throw new Error(errorMsg || 'SERVER_INTEGRITY_FAILURE');
      }

      logger.error('[Security] Blocked malformed download (Ghost File Prevention)', { 
        contentType, 
        size, 
        url,
        etag 
      });
      throw new Error('SERVER_INTEGRITY_FAILURE');
    }

    const downloadUrl: string = window.URL.createObjectURL(response.data);
    triggerAnchorDownload(downloadUrl, finalFileName);

    logger.info('[FileService] Download successfully committed to browser', { 
        finalFileName, 
        size,
        etag 
    });

    // Institutional Memory Buffer: Ensures UI/native sync
    setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 8000);

  } catch (error: unknown) {
    let finalErrorMsg = 'DOWNLOAD_PIPELINE_COLLAPSED';
    
    if (error instanceof Error) {
        finalErrorMsg = error.message;
    } else if (typeof error === 'object' && error !== null && 'response' in error) {
        // Axios Error with Blob Response
        const axiosError = error as { response: AxiosResponse<Blob> };
        if (axiosError.response?.data instanceof Blob) {
            finalErrorMsg = await extractErrorMessage(axiosError.response.data) || 'UNKNOWN_SERVER_ERROR';
        }
    }

    logger.error('[FileService] Secure download pipeline collapsed', { 
        url, 
        domain, 
        error: finalErrorMsg 
    });
    
    // Maintain semantic error codes for UI mapping
    if (finalErrorMsg.toLowerCase().includes('not found')) throw new Error('ASSET_MISSING');
    if (finalErrorMsg.toLowerCase().includes('corruption')) throw new Error('INTEGRITY_FAILURE');
    
    throw new Error(finalErrorMsg);
  }
};

/**
 * 🧬 BLOB ERROR EXTRACTOR
 * Recovers institutional JSON error messages from binary streams.
 */
async function extractErrorMessage(blob: Blob): Promise<string | null> {
    try {
        const text = await blob.text();
        const json = JSON.parse(text);
        return json.message || null;
    } catch {
        return null;
    }
}

/**
 * 🧬 NATIVE DOWNLOAD ENGINE (v6.0)
 * Institutional Standard: DOM-safe temporary element binding.
 */
const triggerAnchorDownload = (url: string, fileName: string): void => {
  const link: HTMLAnchorElement = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
  }, 200);
};
