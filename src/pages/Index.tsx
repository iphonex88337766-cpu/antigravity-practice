/**
 * Studio Animata — Side-by-Side Layout
 * Left: Webcam input. Right: Avatar output.
 * Mobile: stacks vertically, avatar on top.
 */

import { useEffect, useRef, useState } from "react";
import { useWebcam } from "@/hooks/useWebcam";
import { useFaceLandmarker } from "@/hooks/useFaceLandmarker";
import FaceMeshCanvas from "@/components/FaceMeshCanvas";
import MinecraftAvatar from "@/components/MinecraftAvatar";
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
    <div className="relative flex h-[100dvh] w-screen flex-col lg:block bg-black overflow-hidden text-white pattern-dots pattern-slate-900 pattern-size-4 pattern-opacity-20 p-4 lg:p-0 gap-4 lg:gap-0">
      {isLoading && <CalibrationOverlay />}

      {/* ── WEBCAM SECTION (MAIN - Full screen on PC, Top on Mobile) ── */}
      <div className="order-2 lg:order-1 flex-0.7 relative w-full h-full min-h-0 flex flex-col items-center justify-center z-20 lg:absolute lg:inset-0 lg:z-10">
        <div
          ref={webcamContainerRef}
          className="relative w-full h-full rounded-[2rem] lg:rounded-none overflow-hidden bg-black flex items-center justify-center"
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
              filter: "saturate(0.8) brightness(0.9)",
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

          {/* Mesh toggle */}
          {webcamState === "active" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMesh((v) => !v)}
              className="absolute bottom-4 left-4 lg:bottom-8 lg:left-8 z-30 bg-black/40 text-white hover:bg-black/80 hover:text-white rounded-full backdrop-blur-md transition-all scale-110"
              title={showMesh ? "Hide mesh" : "Show mesh"}
            >
              {showMesh ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </Button>
          )}
        </div>
      </div>

      {/* ── AVATAR SECTION (Bottom-Right Overlay on PC, Bottom on Mobile) ── */}
      {/* Position absolute with right/bottom and transform translate, plus massive dimensions to prevent clipping */}
      <div
        className="order-1 shrink-0 h-[55vh] w-full lg:w-[320x] lg:h-[320px]  lg:absolute z-50 lg:right-12 lg:bottom-0 lg:translate-x-32 lg:-translate-y-8 lg:w-[800px] lg:h-[800px] relative flex items-center justify-center z-30 lg:z-50 pointer-events-none transition-transform duration-300 overflow-visible"
      >

        {/* Constrain avatar size to purely match the floating zone */}
        <div
          ref={avatarContainerRef}
          className="relative w-full h-full max-w-full max-h-full flex items-center justify-center overflow-visible"
        >
          {webcamState === "active" && landmarks ? (
            <MinecraftAvatar
              landmarks={landmarks}
              transformationMatrix={transformMatrix}
              blendshapes={blendshapes}
              width={avatarSize.width || 800}
              height={avatarSize.height || 800}
            />
          ) : webcamState === "active" ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="font-syne text-lg font-bold tracking-widest text-[#fcd5b4] opacity-70 animate-pulse text-center leading-tight drop-shadow-md">
                SEARCHING FACE
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Index;
