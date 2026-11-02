/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
