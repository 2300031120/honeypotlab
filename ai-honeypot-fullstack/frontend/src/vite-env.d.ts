/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_SHOW_AUTH_DEBUG?: string;
  readonly VITE_ENABLE_BIOMETRIC_LOGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
