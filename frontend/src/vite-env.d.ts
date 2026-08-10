/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Ledger API including the `/api` prefix. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
