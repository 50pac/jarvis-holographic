import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import { WASM_PATH, modelPath } from "./mediapipeAssets";

export interface EyeLandmarks {
  rightIrisCenter: { x: number; y: number } | null;
}

export class FaceLandmarkerService {
  private static landmarker: FaceLandmarker | null = null;
  private static initPromise: Promise<FaceLandmarker> | null = null;

  static async initialize(): Promise<FaceLandmarker> {
    if (this.landmarker) return this.landmarker;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: modelPath("face_landmarker.task"), delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: false,
          minFaceDetectionConfidence: 0.4,
          minTrackingConfidence: 0.4,
          minFacePresenceConfidence: 0.4,
        });

        this.landmarker = landmarker;
        return landmarker;
      } catch (error) {
        this.initPromise = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  static detectRightIris(video: HTMLVideoElement): EyeLandmarks {
    if (!this.landmarker) return { rightIrisCenter: null };
    const res = this.landmarker.detectForVideo(video, Date.now());
    const face = res.faceLandmarks?.[0];
    if (!face || face.length < 478) return { rightIrisCenter: null };
    const pts = [468, 469, 470, 471, 472].map((i) => face[i]);
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    return { rightIrisCenter: { x: cx, y: cy } };
  }
}
