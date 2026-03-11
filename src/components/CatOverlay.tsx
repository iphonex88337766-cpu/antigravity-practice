/**
 * CatOverlay — Static cat sticker in a circular frame.
 * Matches the dog's visual style (300×300 circle, pop animation).
 * Positioned on the left side to avoid overlapping the dog.
 * No trigger logic yet — always visible when webcam is active.
 */

import catSrc from "@/assets/cat-transparent.png";

export default function CatOverlay() {
  return (
    <>
      <div
        style={{
          position: "fixed",
          left: 50,
          top: 120,
          width: 300,
          height: 300,
          background: "transparent",
          border: "none",
          boxShadow: "none",
          borderRadius: "50%",
          overflow: "hidden",
          zIndex: 2147483647,
          pointerEvents: "none",
          animation: "catPop 0.3s ease-out both",
        }}
      >
        <img
          src={catSrc}
          alt="cat"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            background: "transparent",
            display: "block",
          }}
        />
      </div>
      <style>{`
        @keyframes catPop {
          0% { opacity: 0; transform: scale(0.3); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}
