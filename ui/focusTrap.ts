export function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]'))
    .filter(node => !node.hasAttribute('disabled') && node.getAttribute('aria-hidden') !== 'true' && node.tabIndex >= 0 && node.getClientRects().length > 0);
}
export function nextFocusIndex(current: number, total: number, backwards = false): number {
  if (total <= 0) return -1;
  return ((current + (backwards ? -1 : 1)) % total + total) % total;
}
