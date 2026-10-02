export const BASE = import.meta.env.BASE_URL;
export const WASM_PATH = `${BASE}mediapipe/wasm`;
// The gesture model is now in assets/models/ and is not published in R1 dist; R3 will wire its loading.
export const modelPath = (name: string) => `${BASE}models/${name}`;
