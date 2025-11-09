"use client";

import React from "react";

type Props = {
  width?: number;
  height?: number;
  imageSrc?: string;
  tolerance?: number; // pixels tolerance for success
  onVerified?: () => void;
  onFail?: () => void;
};

// Jigsaw slider captcha: a jigsaw-shaped cut-out must be slid horizontally to its original x-position.
// For production, generate puzzles server-side and verify tokens to prevent tampering.
export default function SliderCaptcha({
  width = 360,
  height = 220,
  imageSrc = "/window.svg",
  tolerance = 6,
  onVerified,
  onFail,
}: Props) {
  const bgCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const pieceCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = React.useState(false);
  const [dragX, setDragX] = React.useState(0);
  const [target, setTarget] = React.useState<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 64, h: 64 });
  const [message, setMessage] = React.useState<string>("");

  function drawJigsawPath(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const r = Math.min(w, h) * 0.22; // knob radius
    const cy = h / 2;
    ctx.beginPath();
    // top edge
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.25, 0);
    ctx.quadraticCurveTo(w * 0.35, 0, w * 0.5, r * 0.3);
    ctx.quadraticCurveTo(w * 0.65, 0, w * 0.75, 0);
    ctx.lineTo(w, 0);

    // right inward knob
    ctx.lineTo(w, cy - r);
    ctx.quadraticCurveTo(w - r * 0.2, cy - r, w - r * 0.4, cy - r * 0.6);
    ctx.quadraticCurveTo(w - r, cy, w - r * 0.4, cy + r * 0.6);
    ctx.quadraticCurveTo(w - r * 0.2, cy + r, w, cy + r);

    // bottom edge
    ctx.lineTo(w, h);
    ctx.lineTo(w * 0.75, h);
    ctx.quadraticCurveTo(w * 0.65, h, w * 0.5, h - r * 0.3);
    ctx.quadraticCurveTo(w * 0.35, h, w * 0.25, h);
    ctx.lineTo(0, h);

    // left notch (inward)
    ctx.lineTo(0, cy + r);
    ctx.quadraticCurveTo(r * 0.2, cy + r, r * 0.4, cy + r * 0.6);
    ctx.quadraticCurveTo(r, cy, r * 0.4, cy - r * 0.6);
    ctx.quadraticCurveTo(r * 0.2, cy - r, 0, cy - r);
    ctx.lineTo(0, 0);
    ctx.closePath();
  }

  const resetPuzzle = React.useCallback(() => {
    const w = 64;
    const h = 64;
    const margin = 10;
    const x = Math.floor(margin + Math.random() * (width - w - margin));
    const y = Math.floor(margin + Math.random() * (height - h - margin));
    setTarget({ x, y, w, h });
    setDragX(0);
    setReady(false);
    setMessage("");
  }, [width, height]);

  React.useEffect(() => {
    resetPuzzle();
  }, [resetPuzzle]);

  React.useEffect(() => {
    const bgCanvas = bgCanvasRef.current;
    const pieceCanvas = pieceCanvasRef.current;
    if (!bgCanvas || !pieceCanvas) return;
    bgCanvas.width = width;
    bgCanvas.height = height;
    pieceCanvas.width = target.w;
    pieceCanvas.height = target.h;

    const img = new Image();
    img.crossOrigin = "anonymous"; // allow external images when needed
    img.src = imageSrc;
    img.onload = () => {
      const bgCtx = bgCanvas.getContext("2d");
      const pieceCtx = pieceCanvas.getContext("2d");
      if (!bgCtx || !pieceCtx) return;

      // Draw full background image with cover-crop to avoid distortion
      bgCtx.clearRect(0, 0, width, height);
      const imgAspect = img.width / img.height;
      const canvasAspect = width / height;
      let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;
      if (imgAspect > canvasAspect) {
        // Image wider than canvas: crop sides
        sWidth = Math.floor(img.height * canvasAspect);
        sx = Math.floor((img.width - sWidth) / 2);
      } else if (imgAspect < canvasAspect) {
        // Image taller than canvas: crop top/bottom
        sHeight = Math.floor(img.width / canvasAspect);
        sy = Math.floor((img.height - sHeight) / 2);
      }
      bgCtx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);

      // Draw jigsaw-shaped "hole" on background
      bgCtx.save();
      bgCtx.translate(target.x, target.y);
      drawJigsawPath(bgCtx, target.w, target.h);
      bgCtx.fillStyle = "rgba(0,0,0,0.35)";
      bgCtx.fill();
      bgCtx.lineWidth = 2;
      bgCtx.strokeStyle = "rgba(255,255,255,0.85)";
      bgCtx.stroke();
      bgCtx.restore();

      // Draw the jigsaw piece clipped from the corresponding image region
      pieceCtx.clearRect(0, 0, target.w, target.h);
      pieceCtx.save();
      drawJigsawPath(pieceCtx, target.w, target.h);
      pieceCtx.clip();
      const scaleX = sWidth / width;
      const scaleY = sHeight / height;
      const psx = sx + Math.floor(target.x * scaleX);
      const psy = sy + Math.floor(target.y * scaleY);
      const psw = Math.floor(target.w * scaleX);
      const psh = Math.floor(target.h * scaleY);
      pieceCtx.drawImage(img, psx, psy, psw, psh, 0, 0, target.w, target.h);
      pieceCtx.strokeStyle = "rgba(255,255,255,0.95)";
      pieceCtx.lineWidth = 1.5;
      drawJigsawPath(pieceCtx, target.w, target.h);
      pieceCtx.stroke();
      pieceCtx.restore();

      setReady(true);
    };
    img.onerror = () => {
      setMessage("Failed to load image");
    };
  }, [imageSrc, width, height, target]);

  function onRelease() {
    const delta = Math.abs(dragX - target.x);
    if (delta <= tolerance) {
      setMessage("Verified ✅");
      onVerified?.();
    } else {
      setMessage("Try again ❌");
      onFail?.();
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative" style={{ width, height }}>
        {/* Background canvas with jigsaw-shaped hole */}
        <canvas ref={bgCanvasRef} className="rounded-md border border-white/10" />

        {/* Piece canvas positioned by dragX and fixed target.y */}
        <div
          className="absolute top-0 left-0"
          style={{ transform: `translate(${dragX}px, ${target.y}px)` }}
        >
          <canvas ref={pieceCanvasRef} className="rounded-md shadow-lg" />
        </div>
      </div>

      {/* Slider control */}
      <div className="mt-3">
        <input
          type="range"
          min={0}
          max={width - target.w}
          value={dragX}
          onChange={(e) => setDragX(Number(e.target.value))}
          onMouseUp={onRelease}
          onTouchEnd={onRelease}
          className="w-full"
          aria-label="Slide to verify"
          disabled={!ready}
        />
        <div className="mt-2 text-sm text-gray-200">
          {ready ? "Drag the puzzle piece into place." : "Preparing puzzle…"}
        </div>
        <div className="mt-1 text-sm font-medium">{message}</div>
        <div className="mt-2 flex gap-4 text-sm">
          <button
            type="button"
            className="rounded-md bg-white/10 px-3 py-1 hover:bg-white/20"
            onClick={resetPuzzle}
          >
            Refresh
          </button>
          <a href="#" className="opacity-80 hover:opacity-100">Report a problem</a>
        </div>
      </div>
    </div>
  );
}