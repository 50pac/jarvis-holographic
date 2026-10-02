export function Led({ state }: { state: 'online' | 'off' | 'error' }) {
  return <span aria-hidden="true" className={`inline-block h-2 w-2 shrink-0 ${state === 'online' ? 'ui-led-online bg-verdigris' : state === 'error' ? 'bg-danger' : 'border border-line-hi'}`}/>;
}
