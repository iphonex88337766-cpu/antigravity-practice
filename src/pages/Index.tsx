/**
 * Studio Animata — Side-by-Side Layout
 * Left: Webcam input. Right: Avatar output.
 * Mobile: stacks vertically, avatar on top.
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

    let w: number, h: number, x: number, y: number;
    if (videoAspect > containerAspect) {
      // Video is wider — pillarbox (black bars top/bottom)
      w = cw;
      h = cw / videoAspect;
      x = 0;
      y = (ch - h) / 2;
    } else {
      // Video is taller — letterbox (black bars left/right)
      h = ch;
      w = ch * videoAspect;
      x = (cw - w) / 2;
      y = 0;
    }
    setVideoRect({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
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

  if (webcamState === "error" && webcamError) return <ErrorScreen message={webcamError} />;
  if (modelState === "error") return <ErrorScreen message={modelError || "MODEL LOAD FAILED"} />;

  const isLoading = modelState === "loading" || webcamState === "requesting";

  return (
    <div className="flex h-screen w-screen flex-col md:flex-row items-stretch overflow-hidden bg-foreground">
      {/* ── RIGHT PANEL (Avatar) — shown first on mobile ── */}
      <div className="order-1 md:order-2 flex-1 md:flex-[1.2] relative flex items-center justify-center bg-background">
        {/* Decorative grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Avatar stage */}
        <div
          ref={avatarContainerRef}
          className="relative w-full h-full max-w-[800px] max-h-[600px] m-auto"
          style={{ aspectRatio: "4 / 3" }}
        >
          {/* Subtle vignette */}
          <div className="absolute inset-0 rounded-none pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at center, transparent 50%, hsl(var(--background)) 100%)",
            }}
          />

          {webcamState === "active" && landmarks ? (
            <AvatarOverlay
              landmarks={landmarks}
              transformationMatrix={transformMatrix}
              width={avatarSize.width}
              height={avatarSize.height}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="h-16 w-16 border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                <span className="text-muted-foreground/40 text-2xl">🐯</span>
              </div>
              <p className="font-syne text-sm tracking-widest text-muted-foreground/50 uppercase">
                {isLoading ? "Calibrating…" : "Awaiting signal"}
              </p>
            </div>
          )}

          {/* Label */}
          <div className="absolute top-3 left-3 z-10">
            <span className="font-syne text-[10px] tracking-[0.3em] text-muted-foreground/60 uppercase">
              Output
            </span>
          </div>
        </div>
      </div>

      {/* ── LEFT PANEL (Webcam) ── */}
      <div className="order-2 md:order-1 flex-1 relative flex items-center justify-center bg-foreground">
        <div
          ref={webcamContainerRef}
          className="relative w-full h-full overflow-hidden"
        >
          {isLoading && <CalibrationOverlay />}

          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              transform: "scaleX(-1)",
              filter: "saturate(0.6) brightness(0.85)",
              opacity: webcamState === "active" ? 1 : 0,
            }}
          />

          {webcamState === "active" && showMesh && (
            <FaceMeshCanvas
              landmarks={landmarks}
              width={webcamSize.width}
              height={webcamSize.height}
              hasDetected={hasEverDetected && landmarks !== null}
            />
          )}

          {webcamState === "active" && !landmarks && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="font-syne text-lg font-bold tracking-widest text-primary opacity-70">
                SEARCHING
              </p>
            </div>
          )}

          {/* Label */}
          <div className="absolute top-3 left-3 z-10">
            <span className="font-syne text-[10px] tracking-[0.3em] text-primary/60 uppercase">
              Input
            </span>
          </div>

          {/* Mesh toggle */}
          {webcamState === "active" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMesh((v) => !v)}
              className="absolute bottom-3 right-3 z-10 bg-foreground/40 text-primary backdrop-blur-sm hover:bg-foreground/60 hover:text-primary"
              title={showMesh ? "Hide mesh" : "Show mesh"}
            >
              {showMesh ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
