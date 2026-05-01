export {};

declare global {
  interface Window {
    __HAEMI_BOOT_TIME__: number;
    /**
     * File System Access API (W3C). Optional because not all browsers
     * implement it; callers must feature-detect via `'showSaveFilePicker'
     * in window` or via a stable runtime const before invocation.
     */
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  }
}
