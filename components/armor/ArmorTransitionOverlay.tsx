import type { ArmorTransition } from '../../hooks/useArmor';

export default function ArmorTransitionOverlay({ transition }: { transition: ArmorTransition }) {
  if (transition.tick === 0) return null;
  return <div key={transition.tick} className="armor-flash pointer-events-none fixed inset-0 z-[65]" aria-hidden="true" />;
}
