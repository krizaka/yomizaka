/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string;
  /** Points a development build at another backend (a tunnel, a machine on the network). */
  readonly VITE_APP_URL?: string;
  readonly VITE_APP_ENV?: string;
}
