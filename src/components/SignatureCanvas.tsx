'use client';

import { useRef, useEffect, useCallback } from 'react';

interface SignatureCanvasProps {
  width?: number;
  height?: number;
  onSignatureChange: (dataUrl: string | null) => void;
}

export default function SignatureCanvas({
  width = 400,
  height = 200,
  onSignatureChange,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const hasStrokes = useRef(false);

  /* Set up high-DPI canvas on mount */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [width, height]);

  const getPos = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();

      let clientX: number, clientY: number;
      if ('touches' in e) {
        clientX = e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX ?? 0;
        clientY = e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY ?? 0;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    [],
  );

  const startStroke = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      isDrawing.current = true;
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    },
    [getPos],
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing.current) return;
      e.preventDefault();

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      hasStrokes.current = true;
    },
    [getPos],
  );

  const endStroke = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    const canvas = canvasRef.current;
    if (!canvas || !hasStrokes.current) return;

    onSignatureChange(canvas.toDataURL('image/png'));
  }, [onSignatureChange]);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    hasStrokes.current = false;
    onSignatureChange(null);
  }, [onSignatureChange]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        onMouseDown={startStroke}
        onMouseMove={draw}
        onMouseUp={endStroke}
        onMouseLeave={endStroke}
        onTouchStart={startStroke}
        onTouchMove={draw}
        onTouchEnd={endStroke}
        onTouchCancel={endStroke}
        style={{
          width,
          height,
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: 8,
          touchAction: 'none',
          cursor: 'crosshair',
          display: 'block',
        }}
      />
      <button
        type="button"
        onClick={handleClear}
        style={{
          marginTop: 8,
          padding: '6px 16px',
          background: 'transparent',
          border: '1px solid #555',
          borderRadius: 6,
          color: '#aaa',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Clear Signature
      </button>
    </div>
  );
}
