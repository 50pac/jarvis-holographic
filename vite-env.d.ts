/// <reference types="vite/client" />

declare module '*.glb?url' {
  const url: string;
  export default url;
}

declare module '*.task?url' {
  const url: string;
  export default url;
}
