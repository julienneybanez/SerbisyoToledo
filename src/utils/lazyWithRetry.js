import { lazy } from 'react';

const CHUNK_RETRY_PREFIX = 'serbisyo-toledo:chunk-retry:';

function isChunkLoadError(error) {
  const message = String(error?.message || error || '');

  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|loading chunk|chunkloaderror/i.test(message);
}

export default function lazyWithRetry(importer, moduleKey) {
  return lazy(async () => {
    const retryKey = `${CHUNK_RETRY_PREFIX}${moduleKey}`;

    try {
      const module = await importer();

      try {
        window.sessionStorage.removeItem(retryKey);
      } catch {
        // Storage can be unavailable in restrictive browser modes.
      }

      return module;
    } catch (error) {
      if (!isChunkLoadError(error)) {
        throw error;
      }

      let alreadyRetried = false;

      try {
        alreadyRetried = window.sessionStorage.getItem(retryKey) === '1';
      } catch {
        // If sessionStorage is unavailable, fall through to the error boundary.
        alreadyRetried = true;
      }

      if (!alreadyRetried) {
        try {
          window.sessionStorage.setItem(retryKey, '1');
        } catch {
          throw error;
        }

        window.location.reload();

        // Keep React Suspense active while the browser reloads.
        return new Promise(() => {});
      }

      throw error;
    }
  });
}
