// 🔒 HAEMI FILESYSTEM LOCK
// SINGLE SOURCE OF TRUTH FOR PATHS
// DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL

import * as path from 'path';

/**
 * Deterministic absolute root for all multi-media uploads.
 * Resolves to the 'uploads' directory at the backend project root.
 */
export const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

/**
 * Ensures a relative path is resolved against the UPLOADS_ROOT.
 * Includes basic path traversal protection.
 */
export const getAbsolutePath = (relativePath: string): string => {
    // Normalization: Remove leading slashes and redundant 'uploads/' prefix
    const cleanPath = relativePath.replace(/^[\\/]+/, '').replace(/^uploads[\\/]/i, '');
    const absolutePath = path.join(UPLOADS_ROOT, cleanPath);
    
    if (!absolutePath.startsWith(UPLOADS_ROOT)) {
        throw new Error(`[Security] Path traversal attempt blocked: ${relativePath}`);
    }
    
    return absolutePath;
};
