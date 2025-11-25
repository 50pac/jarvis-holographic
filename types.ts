export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface HandInteractionData {
  landmarks: Landmark[];
  handedness: 'Left' | 'Right';
  gesture?: string;
  pinchDistance?: number; // Normalized 0-1
  isPinching: boolean;
  expansionFactor: number; // 0 (Fist) to 1 (Open Palm)
  rotationControl: { x: number, y: number }; // -1 to 1 for both axes (Joystick style)
}

export interface HandTrackingState {
  leftHand: HandInteractionData | null;
  rightHand: HandInteractionData | null;
}

export enum RegionName {
  AMERICAS = "美洲扇区",
  PACIFIC = "太平洋监测区",
  ASIA = "亚洲战区",
  EUROPE = "欧洲防区",
  AFRICA = "非洲资源区"
}

export interface PanelPosition {
  x: number;
  y: number;
}