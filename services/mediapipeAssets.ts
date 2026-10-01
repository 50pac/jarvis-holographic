export const BASE = import.meta.env.BASE_URL;
export const WASM_PATH = `${BASE}mediapipe/wasm`;
export const modelPath = (name: string) => `${BASE}models/${name}`;
