import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square } from 'lucide-react';

import { useSttMutation } from '../lib/queries';
import { useAppStore } from '../lib/store';
import { t } from '../lib/translations';

type Phase = 'idle' | 'recording' | 'transcribing';

/**
 * MediaRecorder → POST /api/stt → append to userInput.
 *
 * Why this design (vs Web Speech API):
 *   - iOS Safari's SpeechRecognition is limited and brittle (design §6.3).
 *   - Routing through backend Gemini lets us keep one transcription pipeline
 *     across browsers/languages and swap vendors later without touching the UI.
 *
 * Known gotchas:
 *   - Some browsers need `audio/webm;codecs=opus`, others default to audio/mp4.
 *     We pass whatever MediaRecorder picked (via blob.type) and let the server
 *     forward it to Gemini — Gemini's multimodal endpoint is permissive.
 *   - Permission errors are silent-ish: we just revert to idle and let the
 *     parent surface a generic error via the shared ErrorBanner.
 */
export default function MicButton() {
  const lang = useAppStore((s) => s.lang);
  const setUserInput = useAppStore((s) => s.setUserInput);
  const userInput = useAppStore((s) => s.userInput);
  const ui = t(lang);

  const [phase, setPhase] = useState<Phase>('idle');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stt = useSttMutation();

  // Cleanup on unmount so we never leak a live mic
  useEffect(() => {
    return () => {
      try {
        recorderRef.current?.stop();
      } catch {
        /* noop */
      }
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  async function startRecording() {
    try {
      // Browser-built-in audio constraints — free wins for noisy Summit venues:
      //   noiseSuppression — kills background hum / venue music / HVAC
      //   echoCancellation — kills speaker bleed (usually mute, but defense-in-depth)
      //   autoGainControl  — normalises volume so soft-spoken lecturers transcribe ok
      // Chrome/Safari/Firefox all support these; older browsers ignore unknown
      // constraints (don't error). All are server-side hints we already pay
      // a penalty for ignoring (Gemini STT is sensitive to ambient noise).
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        if (blob.size === 0) {
          setPhase('idle');
          return;
        }
        setPhase('transcribing');
        try {
          const resp = await stt.mutateAsync({ audio: blob, lang });
          if (resp.text) {
            // Append so users can stack multiple clips into one brief
            const next = userInput ? `${userInput.trim()} ${resp.text}`.trim() : resp.text;
            setUserInput(next);
          }
        } catch {
          // parent banner handles surfacing; here we only need to reset UI
        } finally {
          setPhase('idle');
        }
      };
      recorderRef.current = mr;
      mr.start();
      setPhase('recording');
    } catch {
      // getUserMedia refused / no device; fail silently to idle.
      setPhase('idle');
    }
  }

  function stopRecording() {
    try {
      recorderRef.current?.stop();
    } catch {
      /* noop */
    }
    // Transition to 'transcribing' happens inside mr.onstop to avoid a flash
  }

  const label =
    phase === 'recording'
      ? ui.micListening
      : phase === 'transcribing'
      ? ui.micTranscribing
      : ui.micStart;

  const onClick = () => {
    if (phase === 'idle') void startRecording();
    else if (phase === 'recording') stopRecording();
  };

  const busy = phase !== 'idle';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={phase === 'transcribing'}
      aria-pressed={phase === 'recording'}
      aria-label={label}
      title={label}
      className={[
        'inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors',
        phase === 'recording'
          ? 'bg-red-500/20 text-red-300 ring-1 ring-red-400/40'
          : 'bg-white/5 text-white/80 hover:bg-white/10 ring-1 ring-white/10',
        busy ? 'cursor-progress' : 'cursor-pointer',
      ].join(' ')}
    >
      {phase === 'recording' ? (
        <Square size={16} className="fill-current" />
      ) : phase === 'transcribing' ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Mic size={16} />
      )}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
