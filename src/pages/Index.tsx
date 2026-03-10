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
  const [videoDimensions, setVideoDimensions] = useState({ width: 1280, height: 720 });
  const animFrameRef = useRef<number>(0);

  // Start webcam once model is ready
  useEffect(() => {
    if (modelState === "ready") {
      startWebcam();
    }
  }, [modelState, startWebcam]);

  // Update video dimensions when metadata loads
  const handleVideoMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setVideoDimensions({
        width: video.videoWidth,
        height: video.videoHeight,
      });
    }
  }, [videoRef]);

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
      // Prevent duplicate timestamps
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
      <div className="relative w-full max-w-[1280px]" style={{ aspectRatio: "16 / 9" }}>
        {/* Loading state — CALIBRATING */}
        {isLoading && <CalibrationOverlay />}

        {/* Webcam feed — mirrored, desaturated */}
        <video
          ref={videoRef}
          onLoadedMetadata={handleVideoMetadata}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            transform: "scaleX(-1)",
            filter: "saturate(0.8) brightness(0.9)",
            opacity: webcamState === "active" ? 1 : 0,
          }}
        />

        {/* Face Mesh overlay — mirrored to match video */}
        {webcamState === "active" && (
          <div
            className="absolute inset-0"
            style={{ transform: "scaleX(-1)" }}
          >
            <FaceMeshCanvas
              landmarks={landmarks}
              width={videoDimensions.width}
              height={videoDimensions.height}
              hasDetected={hasEverDetected && landmarks !== null}
            />
          </div>
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
