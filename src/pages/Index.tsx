/**
 * Studio Animata — Face Tracking Engine (Step 2: Character Rigging)
 */

import { useEffect, useRef, useState } from "react";
import { useWebcam } from "@/hooks/useWebcam";
import { useFaceLandmarker } from "@/hooks/useFaceLandmarker";
import FaceMeshCanvas from "@/components/FaceMeshCanvas";
import AvatarOverlay from "@/components/AvatarOverlay";
import CalibrationOverlay from "@/components/CalibrationOverlay";
import ErrorScreen from "@/components/ErrorScreen";
import { type NormalizedLandmark } from "@mediapipe/tasks-vision";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { videoRef, state: webcamState, error: webcamError, start: startWebcam } = useWebcam();
  const { state: modelState, error: modelError, detect } = useFaceLandmarker();

  const [landmarks, setLandmarks] = useState<NormalizedLandmark[] | null>(null);
  const [transformMatrix, setTransformMatrix] = useState<any>(null);
  const [hasEverDetected, setHasEverDetected] = useState(false);
  const [showMesh, setShowMesh] = useState(true);
  const [displaySize, setDisplaySize] = useState({ width: 1280, height: 720 });
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  // Start webcam once model is ready
  useEffect(() => {
    if (modelState === "ready") {
      startWebcam();
    }
  }, [modelState, startWebcam]);

  // Track container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDisplaySize({ width: Math.round(width), height: Math.round(height) });
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Detection loop
  useEffect(() => {
    if (webcamState !== "active" || modelState !== "ready") return;
    let lastTime = -1;

    function loop() {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }
      const now = performance.now();
      if (now <= lastTime) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }
      lastTime = now;

      const result = detect(video, now);
      if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
        setLandmarks(result.faceLandmarks[0]);
        setTransformMatrix(
          result.facialTransformationMatrixes?.[0] ?? null
        );
        if (!hasEverDetected) setHasEverDetected(true);
      } else {
        setLandmarks(null);
        setTransformMatrix(null);
      }

      animFrameRef.current = requestAnimationFrame(loop);
    }

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [webcamState, modelState, detect, videoRef, hasEverDetected]);

  // Error states
  if (webcamState === "error" && webcamError) {
    return <ErrorScreen message={webcamError} />;
  }
  if (modelState === "error") {
    return <ErrorScreen message={modelError || "MODEL LOAD FAILED"} />;
  }

  const isLoading = modelState === "loading" || webcamState === "requesting";

  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-background">
      <div
        ref={containerRef}
        className="relative w-full max-w-[1280px] overflow-hidden"
        style={{ aspectRatio: "16 / 9" }}
      >
        {isLoading && <CalibrationOverlay />}

        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            transform: "scaleX(-1)",
            filter: "saturate(0.8) brightness(0.9)",
            opacity: webcamState === "active" ? 1 : 0,
          }}
        />

        {/* Face Mesh overlay — toggleable */}
        {webcamState === "active" && showMesh && (
          <FaceMeshCanvas
            landmarks={landmarks}
            width={displaySize.width}
            height={displaySize.height}
            hasDetected={hasEverDetected && landmarks !== null}
          />
        )}

        {/* Avatar overlay */}
        {webcamState === "active" && landmarks && (
          <AvatarOverlay
            landmarks={landmarks}
            transformationMatrix={transformMatrix}
            width={displaySize.width}
            height={displaySize.height}
          />
        )}

        {/* Searching label */}
        {webcamState === "active" && !landmarks && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-syne text-2xl font-bold tracking-widest text-foreground opacity-60">
              SEARCHING
            </p>
          </div>
        )}

        {/* Mesh toggle button */}
        {webcamState === "active" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowMesh((v) => !v)}
            className="absolute bottom-4 right-4 z-10 bg-background/40 backdrop-blur-sm hover:bg-background/60"
            title={showMesh ? "Hide mesh" : "Show mesh"}
          >
            {showMesh ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </Button>
        )}
      </div>
    </div>
  );
};

export default Index;
