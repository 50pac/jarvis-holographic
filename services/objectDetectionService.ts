import { FilesetResolver, ObjectDetector } from "@mediapipe/tasks-vision";
import { WASM_PATH, modelPath } from "./mediapipeAssets";

// Local EfficientDet Lite0 model: Apache-2.0 code; COCO-derived model is for personal/non-commercial use.

export interface DetectionResult {
  categories: { categoryName: string; score: number }[];
  boundingBox: { originX: number; originY: number; width: number; height: number };
}

export class ObjectDetectionService {
  private static detector: ObjectDetector | null = null;
  private static initPromise: Promise<ObjectDetector> | null = null;

  static async initialize(): Promise<ObjectDetector> {
    if (this.detector) return this.detector;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

        const detector = await ObjectDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath("efficientdet_lite0.tflite"),
            delegate: "GPU",
          },
          scoreThreshold: 0.3,
          runningMode: "VIDEO",
          maxResults: 8,
        });

        this.detector = detector;
        return detector;
      } catch (error) {
        this.initPromise = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  static detectForVideo(video: HTMLVideoElement): DetectionResult[] {
    if (!this.detector) return [];
    const results = this.detector.detectForVideo(video, Date.now());
    const detections = results.detections || [];
    return detections.map((d: any) => ({
      categories: (d.categories || []).map((c: any) => ({ categoryName: c.categoryName, score: c.score })),
      boundingBox: {
        originX: d.boundingBox?.originX ?? 0,
        originY: d.boundingBox?.originY ?? 0,
        width: d.boundingBox?.width ?? 0,
        height: d.boundingBox?.height ?? 0,
      },
    }));
  }
}
