import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, X, AlertCircle, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SealVerifierProps {
  activeBookingId: string;
  onVerifyComplete: (bookingId: string) => void;
  onClose: () => void;
}

export default function SealVerifier({ activeBookingId, onVerifyComplete, onClose }: SealVerifierProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Set up webcam video feed
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        setErrorMsg(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 }, // Request higher resolution for high-res seal signatures
            height: { ideal: 720 }
          },
          audio: false
        });
        
        activeStream = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              videoRef.current.play().catch((playErr) => {
                console.error('[SealVerifier] play() failed or was interrupted:', playErr);
              });
            }
          };
          setCameraActive(true);
        }
      } catch (err: any) {
        console.error('Camera access error:', err);
        setErrorMsg('Webcam access denied. Please allow camera permissions.');
        setCameraActive(false);
      }
    };

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => {
          console.log('[SealVerifier] Stopping hardware camera track:', track.label);
          track.stop();
        });
      }
    };
  }, []);

  // Capture Seal Snapshot
  const handleShutterCapture = async () => {
    if (!videoRef.current || !cameraActive) return;

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9); // High quality compression
      
      setCapturedImage(dataUrl);

      // Stop camera hardware
      if (video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
      setCameraActive(false);

      // POST to backend scan validator
      setIsLoading(true);
      try {
        const res = await fetch('http://localhost:8000/api/tracking/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: dataUrl,
            type: 'seal',
            booking_id: activeBookingId || 'BK-MOCK-999'
          })
        });

        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }

        const data = await res.json();
        
        if (data.success && data.status === 'DELIVERED') {
          setSuccessMsg(`Seal signature verified! Booking ${data.booking_id} status updated.`);
          setTimeout(() => {
            onVerifyComplete(data.booking_id);
          }, 1800);
        } else {
          throw new Error(data.error || 'Verification rejected by gate logic.');
        }
      } catch (err: any) {
        console.error('Seal Scan error:', err);
        setErrorMsg(`Verification error: ${err.message}. Retrying camera...`);
        
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="md:relative md:inset-auto md:w-full md:h-[400px] md:bg-[#111726]/90 md:rounded-xl md:shadow-2xl fixed inset-0 z-50 w-screen h-screen bg-[#090D16] flex flex-col overflow-hidden animate-fade-in border border-slate-200 dark:border-zinc-800">
      {/* Header Bar */}
      <div className="flex justify-between items-center bg-[#090D16] px-4 py-3 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-[#FF6B00] animate-pulse" />
          <span className="text-xs font-mono font-bold text-slate-200 tracking-wider">GATE SEAL VERIFICATION DECK</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-900 transition duration-150 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Main View Area */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {/* Passive video preview (Always mounted to prevent null videoRef inside useEffect) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline={true}
          muted={true}
          className="w-full h-full object-cover transform scale-x-[-1]"
          style={{ display: cameraActive && !capturedImage ? 'block' : 'none' }}
        />

        {/* Frozen Preview image */}
        {capturedImage && (
          <img
            src={capturedImage}
            alt="Seal Snapshot"
            className="w-full h-full object-cover transform scale-x-[-1]"
          />
        )}

        {/* Targeting Grid Overlay */}
        {cameraActive && !capturedImage && (
          <div className="absolute inset-0 flex flex-col justify-between p-12 pointer-events-none">
            {/* Center target outline */}
            <div className="flex-1 border-2 border-dashed border-[#FF6B00]/40 rounded-xl flex items-center justify-center">
              <span className="text-[#FF6B00]/60 font-mono text-[9px] uppercase bg-black/60 px-2.5 py-1 rounded border border-[#FF6B00]/20">
                Seal QR/Signature Target zone
              </span>
            </div>
          </div>
        )}

        {/* Shutter Button Action Overlay */}
        {cameraActive && !capturedImage && (
          <div className="absolute bottom-6 inset-x-0 flex justify-center z-10">
            <button
              type="button"
              onClick={handleShutterCapture}
              className="h-16 w-16 bg-white border-4 border-slate-800 rounded-full cursor-pointer flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition"
              title="Capture seal signature"
            >
              <div className="h-11 w-11 bg-[#FF6B00] rounded-full hover:bg-[#FF6B00]/90 animate-pulse"></div>
            </button>
          </div>
        )}

        {/* Loading / Processing Screen */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#090D16]/95 flex flex-col items-center justify-center space-y-4 z-30"
            >
              <Loader2 className="h-8 w-8 text-[#FF6B00] animate-spin" />
              <div className="text-center space-y-1">
                <p className="text-xs font-mono text-[#FF6B00] animate-pulse">Verifying Signature with Gemini CV...</p>
                <p className="text-[9px] text-slate-500 font-mono uppercase tracking-widest">Running OCR and Seal Match</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Overlay */}
        {successMsg && (
          <div className="absolute inset-0 bg-[#090D16]/95 flex flex-col items-center justify-center p-6 space-y-4 z-30 text-center">
            <ShieldCheck className="h-12 w-12 text-emerald-500 animate-bounce" />
            <p className="text-sm font-mono text-slate-200">{successMsg}</p>
          </div>
        )}

        {/* Error Overlay */}
        {errorMsg && (
          <div className="absolute inset-0 bg-[#090D16] flex flex-col items-center justify-center p-6 space-y-4 z-30 text-center">
            <AlertCircle className="h-10 w-10 text-rose-500" />
            <p className="text-xs font-mono text-slate-300">{errorMsg}</p>
          </div>
        )}
      </div>

      {/* Footer / Instructions */}
      <div className="bg-[#090D16] p-3.5 border-t border-slate-200 dark:border-zinc-800 flex justify-between items-center text-[10px] font-mono text-slate-400">
        <span>Webcam: passively streaming. Align seal and click Shutter.</span>
        <span>Resolution: 1280x720 High-Res</span>
      </div>
    </div>
  );
}
