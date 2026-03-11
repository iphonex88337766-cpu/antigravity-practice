/**
 * Studio Animata — Side-by-Side Layout
 * Left: Webcam input. Right: Avatar output.
 * Mobile: stacks vertically, avatar on top.
 */

import { useEffect, useRef, useState } from "react";
import { useWebcam } from "@/hooks/useWebcam";
import { useFaceLandmarker } from "@/hooks/useFaceLandmarker";
import FaceMeshCanvas from "@/components/FaceMeshCanvas";
import PuppyOverlay from "@/components/PuppyOverlay";
import CatOverlay from "@/components/CatOverlay";
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
  const [blendshapes, setBlendshapes] = useState<Record<string, number> | null>(null);
  const [hasEverDetected, setHasEverDetected] = useState(false);
  const [showMesh, setShowMesh] = useState(true);
  const [webcamSize, setWebcamSize] = useState({ width: 640, height: 360 });
  const [videoRect, setVideoRect] = useState({ x: 0, y: 0, w: 640, h: 360 });
  const [avatarSize, setAvatarSize] = useState({ width: 640, height: 360 });
  const webcamContainerRef = useRef<HTMLDivElement>(null);
  const avatarContainerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  /** Compute the letterboxed video rect inside the container */
  const updateVideoRect = () => {
    const video = videoRef.current;
    const container = webcamContainerRef.current;
    if (!video || !container || video.videoWidth === 0) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    const containerAspect = cw / ch;
    const videoAspect = vw / vh;

    // object-cover centered within the shifted wrapper
    const scale = Math.max(cw / vw, ch / vh);
    const w = Math.round(vw * scale);
    const h = Math.round(vh * scale);
    const x = Math.round((cw - w) / 2);
    const y = Math.round((ch - h) / 2);
    setVideoRect({ x, y, w, h });
  };

  useEffect(() => {
    if (modelState === "ready") startWebcam();
  }, [modelState, startWebcam]);

  // Track both containers
  useEffect(() => {
    const wcEl = webcamContainerRef.current;
    const avEl = avatarContainerRef.current;
    if (!wcEl || !avEl) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width <= 0 || height <= 0) continue;
        const rounded = { width: Math.round(width), height: Math.round(height) };
        if (entry.target === wcEl) {
          setWebcamSize(rounded);
          updateVideoRect();
        }
        if (entry.target === avEl) setAvatarSize(rounded);
      }
    });

    observer.observe(wcEl);
    observer.observe(avEl);
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
        setTransformMatrix(result.facialTransformationMatrixes?.[0] ?? null);
        // Extract blendshapes into a simple map
        const bs = result.faceBlendshapes?.[0]?.categories;
        if (bs) {
          const map: Record<string, number> = {};
          for (const c of bs) map[c.categoryName] = c.score;
          setBlendshapes(map);
        } else {
          setBlendshapes(null);
        }
        if (!hasEverDetected) setHasEverDetected(true);
      } else {
        setLandmarks(null);
        setTransformMatrix(null);
        setBlendshapes(null);
      }
      animFrameRef.current = requestAnimationFrame(loop);
    }

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [webcamState, modelState, detect, videoRef, hasEverDetected]);

  if (webcamState === "error" && webcamError) return <ErrorScreen message={webcamError} />;
  if (modelState === "error") return <ErrorScreen message={modelError || "MODEL LOAD FAILED"} />;

  const isLoading = modelState === "loading" || webcamState === "requesting";

  return (
    <div className="relative h-screen w-screen overflow-hidden" style={{ background: "transparent" }}>
      {webcamState === "active" && <PuppyOverlay blendshapes={blendshapes} />}
      {/* ── FULL-SCREEN WEBCAM ── */}
      <div
        className="absolute inset-0"
      >
        {isLoading && <CalibrationOverlay />}

        {/* Shared wrapper: shifts video + mesh together to the left */}
        <div
          ref={webcamContainerRef}
          className="absolute inset-0"
          style={{ transform: "translateX(-20%)", width: "140%", left: 0 }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            onLoadedMetadata={updateVideoRect}
            onResize={updateVideoRect}
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              transform: "scaleX(-1)",
              filter: "saturate(0.7) brightness(0.9)",
              opacity: webcamState === "active" ? 1 : 0,
            }}
          />

          {/* FaceMesh canvas — positioned to match the video area */}
          {webcamState === "active" && showMesh && (
            <div
              className="absolute"
              style={{
                left: videoRect.x,
                top: videoRect.y,
                width: videoRect.w,
                height: videoRect.h,
                pointerEvents: "none",
              }}
            >
              <FaceMeshCanvas
                landmarks={landmarks}
                width={videoRect.w}
                height={videoRect.h}
                hasDetected={hasEverDetected && landmarks !== null}
              />
            </div>
          )}
        </div>

        {webcamState === "active" && !landmarks && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-syne text-lg font-bold tracking-widest text-primary opacity-70">
              SEARCHING
            </p>
          </div>
        )}

        {/* Mesh toggle */}
        {webcamState === "active" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowMesh((v) => !v)}
            className="absolute bottom-3 left-3 z-20 bg-transparent text-primary hover:bg-white/10 hover:text-primary"
            title={showMesh ? "Hide mesh" : "Show mesh"}
          >
            {showMesh ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* ── AVATAR OVERLAY — transparent, no visible box ── */}
      <div
        ref={avatarContainerRef}
        className="absolute z-10"
        style={{ right: 15, top: "12%", width: 600, height: 600, background: "transparent", pointerEvents: "none" }}
      >
        {webcamState === "active" && landmarks && (
          <AvatarOverlay
            landmarks={landmarks}
            transformationMatrix={transformMatrix}
            blendshapes={blendshapes}
            width={600}
            height={600}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
