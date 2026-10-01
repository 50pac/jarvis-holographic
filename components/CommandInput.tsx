import type { RefObject } from 'react';

interface CommandInputProps {
  active: boolean;
  value: string;
  inputRef: RefObject<HTMLInputElement>;
  onChange: (value: string) => void;
}

export default function CommandInput({ active, value, inputRef, onChange }: CommandInputProps) {
  if (!active) return null;

  return (
    <div className="mt-4 min-w-[360px] max-w-[720px] mx-auto px-4 py-2 bg-black/70 border border-holo-cyan/50 rounded-md backdrop-blur text-white font-mono text-sm">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="输入命令，例如：hello jarvis / show mark / over"
        className="w-full bg-transparent outline-none text-holo-blue/90 placeholder:text-gray-400"
      />
      <div className="text-[10px] text-gray-500 mt-1">回车打开/提交，Esc 关闭</div>
    </div>
  );
}
