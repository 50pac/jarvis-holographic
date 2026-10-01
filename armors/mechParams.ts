/** Dimensions and colors consumed by the procedural mech renderer. */
export interface MechParams {
  size: number;
  bulk: number;
  headStyle: 'dome' | 'horned' | 'visor';
  /** Shoulder shell size relative to the default of 1. */
  shoulderSize?: number;
  thrusterCount: number;
  primaryColor: string;
  secondaryColor: string;
  glowColor: string;
}

/** The local model spans y = -1 to y = 1 before its uniform size scale. */
export function getMechHeight(params: MechParams): number {
  return 2 * params.size;
}
