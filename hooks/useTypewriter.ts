import { useEffect, useRef, useState } from 'react';

export const useTypewriter = () => {
  const [chatText, setChatText] = useState('');
  const [chatRole, setChatRole] = useState<'I' | 'J' | null>(null);
  const typeTimerRef = useRef<number | null>(null);

  const stopTypewrite = () => {
    if (typeTimerRef.current) {
      clearInterval(typeTimerRef.current);
      typeTimerRef.current = null;
    }
  };

  const startTypewrite = (role: 'I' | 'J', text: string) => {
    stopTypewrite();
    setChatRole(role);
    setChatText('');
    const full = text;
    let i = 0;
    typeTimerRef.current = window.setInterval(() => {
      i++;
      setChatText(full.slice(0, i));
      if (i >= full.length) {
        stopTypewrite();
      }
    }, 30);
  };

  useEffect(() => () => {
    if (typeTimerRef.current) {
      clearInterval(typeTimerRef.current);
      typeTimerRef.current = null;
    }
  }, []);

  return { chatText, chatRole, startTypewrite, stopTypewrite };
};
