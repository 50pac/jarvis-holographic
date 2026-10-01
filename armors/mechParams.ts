/** Parameters consumed by the procedural mech renderer in the next step. */
export interface MechParams {
  size: number;
  bulk: number;
  headStyle: 'dome' | 'horned' | 'visor';
  thrusterCount: number;
  primaryColor: string;
  secondaryColor: string;
  glowColor: string;
}
