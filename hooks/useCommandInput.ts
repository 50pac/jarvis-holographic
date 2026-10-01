import { useEffect, useRef, useState } from 'react';

export function useCommandInput(
  onSubmit: (value: string) => void | Promise<void>,
  commandActiveRef: React.MutableRefObject<boolean>,
) {
  const [commandActive, setCommandActive] = useState(false);
  const [commandValue, setCommandValue] = useState('');
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const valueRef = useRef('');
  const submitRef = useRef(onSubmit);
  const focusTimeoutRef = useRef<number | null>(null);

  commandActiveRef.current = commandActive;
  valueRef.current = commandValue;
  submitRef.current = onSubmit;

  const updateCommandValue = (value: string) => {
    valueRef.current = value;
    setCommandValue(value);
  };

  useEffect(() => {
    const close = () => {
      if (focusTimeoutRef.current !== null) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
      commandActiveRef.current = false;
      valueRef.current = '';
      setCommandActive(false);
      setCommandValue('');
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (!commandActiveRef.current) {
          commandActiveRef.current = true;
          valueRef.current = '';
          setCommandActive(true);
          setCommandValue('');
          focusTimeoutRef.current = window.setTimeout(() => {
            focusTimeoutRef.current = null;
            commandInputRef.current?.focus();
          }, 0);
        } else {
          e.preventDefault();
          const value = valueRef.current;
          if (value.trim().length) submitRef.current(value);
          close();
        }
      }
      if (e.key === 'Escape' && commandActiveRef.current) close();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (focusTimeoutRef.current !== null) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
    };
  }, [commandActiveRef]);

  return { commandActive, commandValue, commandInputRef, setCommandValue: updateCommandValue };
}
