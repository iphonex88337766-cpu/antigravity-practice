/**
 * Studio Animata — Face Tracking Engine (Step 1: Foundation)
 * 
 * A centered, viewport-locked altar to the connection between
 * human face and digital system. No scroll. Pure focus.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useWebcam } from "@/hooks/useWebcam";
import { useFaceLandmarker } from "@/hooks/useFaceLandmarker";
import FaceMeshCanvas from "@/components/FaceMeshCanvas";
import CalibrationOverlay from "@/components/CalibrationOverlay";
import ErrorScreen from "@/components/ErrorScreen";
import { type NormalizedLandmark } from "@mediapipe/tasks-vision";

const Index = () => {
  const { videoRef, state: webcamState, error: webcamError, start: startWebcam } = useWebcam();
  const { state: modelState, error: modelError, detect } = useFaceLandmarker();

  const [landmarks, setLandmarks] = useState<NormalizedLandmark[] | null>(null);
  const [hasEverDetected, setHasEverDetected] = useState(false);
  // displaySize tracks the container's actual rendered pixel dimensions
  const [displaySize, setDisplaySize] = useState({ width: 1280, height: 720 });
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  // Start webcam once model is ready
  useEffect(() => {
    if (modelState === "ready") {
      startWebcam();
    }
  }, [modelState, startWebcam]);

  // Track the container's displayed size with ResizeObserver
  // so the canvas always matches the video's on-screen dimensions.
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

  // Main detection loop — 60fps via requestAnimationFrame
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
        if (!hasEverDetected) setHasEverDetected(true);
      } else {
        setLandmarks(null);
      }

      animFrameRef.current = requestAnimationFrame(loop);
    }

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [webcamState, modelState, detect, videoRef, hasEverDetected]);

  // Error states — full screen takeover
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
        {/* Loading state — CALIBRATING */}
        {isLoading && <CalibrationOverlay />}

        {/* Webcam feed — mirrored, desaturated */}
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

        {/* Face Mesh overlay — coordinates are mirrored in drawing logic,
            canvas sized to match displayed container exactly */}
        {webcamState === "active" && (
          <FaceMeshCanvas
            landmarks={landmarks}
            width={displaySize.width}
            height={displaySize.height}
            hasDetected={hasEverDetected && landmarks !== null}
          />
        )}

        {/* Status label */}
        {webcamState === "active" && !landmarks && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-syne text-2xl font-bold tracking-widest text-foreground opacity-60">
              SEARCHING
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
