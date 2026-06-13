import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, X, AlertCircle, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AICargoScannerProps {
  onScanComplete: (metrics: {
    type: 'Carton' | 'Pallet' | 'Drum' | 'Bale';
    length: number;
    width: number;
    height: number;
    label: string;
  }) => void;
  onClose: () => void;
}

export default function AICargoScanner({ onScanComplete, onClose }: AICargoScannerProps) {
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
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
        
        activeStream = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              videoRef.current.play().catch((playErr) => {
                console.error('[AICargoScanner] play() failed or was interrupted:', playErr);
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
          console.log('[AICargoScanner] Stopping hardware camera track:', track.label);
          track.stop();
        });
      }
    };
  }, []);

  // Shutter Snapshot capture handler
  const handleShutterCapture = async () => {
    if (!videoRef.current || !cameraActive) return;

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    // Create canvas snapshot
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Draw single frame snapshot
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      
      // Freeze frame preview
      setCapturedImage(dataUrl);

      // Stop active media tracks to release hardware
      if (video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
      setCameraActive(false);

      // Trigger backend Gemini CV processing
      setIsLoading(true);
      try {
        const res = await fetch('http://localhost:8000/api/tracking/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: dataUrl,
            type: 'cargo'
          })
        });

        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }

        const data = await res.json();
        
        if (data.success) {
          setSuccessMsg('Cargo dimension parameters resolved!');
          setTimeout(() => {
            onScanComplete({
              type: data.dimensions?.type || 'Carton',
              length: data.dimensions?.length || 110,
              width: data.dimensions?.width || 75,
              height: data.dimensions?.height || 95,
              label: data.dimensions?.type || 'Carton'
            });
          }, 1500);
        } else {
          throw new Error(data.error || 'Gemini processing failed.');
        }
      } catch (err: any) {
        console.error('Gemini Cargo Scan error:', err);
        setErrorMsg(`Verification error: ${err.message}. Retrying camera...`);
        
        // Re-enable camera on failure
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
          <Camera className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-mono font-bold text-slate-200 tracking-wider">AI CARGO DIMENSION CONSOLE</span>
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
        {/* Passive Webcam Video Stream (Always mounted to prevent null videoRef inside useEffect) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline={true}
          muted={true}
          className="w-full h-full object-cover transform scale-x-[-1]"
          style={{ display: cameraActive && !capturedImage ? 'block' : 'none' }}
        />

        {/* Frozen Preview Canvas Snapshot */}
        {capturedImage && (
          <img
            src={capturedImage}
            alt="Cargo Snapshot"
            className="w-full h-full object-cover transform scale-x-[-1]"
          />
        )}

        {/* Targeting Grid Overlay */}
        {cameraActive && !capturedImage && (
          <div className="absolute inset-0 flex flex-col justify-between p-8 pointer-events-none">
            {/* Center target outline */}
            <div className="flex-1 border border-dashed border-white/20 rounded flex items-center justify-center">
              <div className="w-10 h-10 border border-primary/30 rounded-full flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-primary/40 rounded-full"></div>
              </div>
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
              title="Capture cargo snapshot"
            >
              <div className="h-11 w-11 bg-primary rounded-full hover:bg-primary/90"></div>
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
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <div className="text-center space-y-1">
                <p className="text-xs font-mono text-primary animate-pulse">Running Backend Gemini CV Analytics...</p>
                <p className="text-[9px] text-slate-500 font-mono uppercase tracking-widest">Estimating voxel dimensions</p>
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
        <span>Webcam: passively streaming. Click Shutter to capture.</span>
        <span>Output: Base64 Voxel Payload</span>
      </div>
    </div>
  );
}
