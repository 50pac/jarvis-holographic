/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STATIC_DEMO?: string;
}

declare module '*.glb?url' {
  const url: string;
  export default url;
}
