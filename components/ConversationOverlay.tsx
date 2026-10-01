import type { VoiceMode } from '../hooks/useVoiceCommands';

interface ConversationOverlayProps {
  voiceMode: VoiceMode;
  chatRole: 'I' | 'J' | null;
  chatText: string;
}

export default function ConversationOverlay({ voiceMode, chatRole, chatText }: ConversationOverlayProps) {
  return (
    <>
      {voiceMode !== 'idle' && (
        <div className="text-holo-cyan font-display tracking-[0.2em] animate-pulse mb-2">
          {voiceMode === 'listening' && 'LISTENING...'}
          {voiceMode === 'processing' && 'PROCESSING...'}
          {voiceMode === 'speaking' && 'SPEAKING...'}
        </div>
      )}
      {(voiceMode === 'listening' || voiceMode === 'speaking') && (
        <div className="min-w-[320px] max-w-[720px] mx-auto px-4 py-2 bg-black/60 border border-holo-cyan/40 rounded-md backdrop-blur-sm text-white font-mono text-sm">
          <span className="text-holo-cyan mr-2 text-xl">{chatRole === 'I' ? 'I:' : chatRole === 'J' ? 'J:' : ''}</span>
          <span className="text-holo-blue/90 text-xl">{chatText}</span>
        </div>
      )}
    </>
  );
}
