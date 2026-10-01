import React, { lazy, Suspense, useCallback, useRef, useState } from 'react';
import VideoFeed from './components/VideoFeed';
import HUDOverlay from './components/HUDOverlay';
import JarvisIntro from './components/JarvisIntro';
import BootScreen from './components/BootScreen';
import AMapView from './components/AMapView';
import ObjectScanOverlay from './components/ObjectScanOverlay';
import EyeTargetOverlay from './components/EyeTargetOverlay';
import HolographicScene from './components/HolographicScene';
import ConversationOverlay from './components/ConversationOverlay';
import CommandInput from './components/CommandInput';
import { HandTrackingState, RegionName } from './types';
import type { SpeechRecognition } from './types/speechRecognition';
import { useTypewriter } from './hooks/useTypewriter';
import { useBootSequence } from './hooks/useBootSequence';
import { useVoiceCommands } from './hooks/useVoiceCommands';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useCommandInput } from './hooks/useCommandInput';
import { useArmorHotkeys } from './hooks/useArmorHotkeys';
import ArmorTransitionOverlay from './components/armor/ArmorTransitionOverlay';

const ArmorPicker = lazy(() => import('./components/armor/ArmorPicker'));

const App: React.FC = () => {
  const handTrackingRef = useRef<HandTrackingState>({ leftHand: null, rightHand: null });
  const [currentRegion, setCurrentRegion] = useState<RegionName>(RegionName.ASIA);
  const { booted, introActive, bootStep, startSystem } = useBootSequence();
  const { chatText, chatRole, startTypewrite } = useTypewriter();
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const commandActiveRef = useRef(false);
  const {
    voiceMode, handleCommand, processingRef, speakingRef, lastSpokenRef, ttsEndAtRef,
    showMark, showMap, scanActive, eyeActive, suitCommand, mapControlRef, armor, showArmorSuit,
  } = useVoiceCommands({ recognitionRef, commandActiveRef, startTypewrite });
  const { recognitionActive } = useSpeechRecognition({
    enabled: booted, onTranscript: handleCommand, recognitionRef,
    speakingRef, ttsEndAtRef, lastSpokenRef, processingRef,
  });
  const { commandActive, commandValue, commandInputRef, setCommandValue } =
    useCommandInput(handleCommand, commandActiveRef);
  useArmorHotkeys({ commandActiveRef, pickerOpen: armor.pickerOpen, togglePicker: armor.togglePicker,
    closePicker: armor.closePicker, nextArmor: armor.nextArmor, prevArmor: armor.prevArmor, showArmorSuit });

  const handleTrackingUpdate = useCallback((newState: HandTrackingState) => {
    handTrackingRef.current = newState;
  }, []);

  if (!booted && !introActive) {
    return <BootScreen bootStep={bootStep} onStart={startSystem} />;
  }

  if (introActive) {
    return <JarvisIntro />;
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden animate-flash">
      <VideoFeed onTrackingUpdate={handleTrackingUpdate} />
      <ObjectScanOverlay active={scanActive} />
      <EyeTargetOverlay active={eyeActive || scanActive} />

      {showMap && (
        <AMapView handTrackingRef={handTrackingRef} ref={mapControlRef} command={suitCommand} />
      )}

      <HolographicScene
        handTrackingRef={handTrackingRef}
        setRegion={setCurrentRegion}
        voiceMode={voiceMode}
        showMark={showMark}
        showMap={showMap}
        suitCommand={suitCommand}
        armorId={armor.armorId}
        transition={armor.transition}
      />

      <HUDOverlay
        handTrackingRef={handTrackingRef}
        currentRegion={currentRegion}
        voiceMode={voiceMode}
        recognitionActive={recognitionActive}
        showMark={showMark}
      />

      <ArmorTransitionOverlay transition={armor.transition} />
      {armor.pickerOpen && (
        <Suspense fallback={null}>
          <ArmorPicker armors={armor.armors} armorId={armor.armorId} selectArmor={armor.selectArmor}
            showArmorSuit={showArmorSuit} closePicker={armor.closePicker} />
        </Suspense>
      )}

      <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 z-40 text-center">
        <ConversationOverlay voiceMode={voiceMode} chatRole={chatRole} chatText={chatText} />
        <CommandInput
          active={commandActive}
          value={commandValue}
          inputRef={commandInputRef}
          onChange={setCommandValue}
        />
      </div>
    </div>
  );
};

export default App;
