import React from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface MapUIProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onReset?: () => void;
}

const btn = 'flex items-center justify-center w-10 h-10 rounded-lg bg-white/90 text-slate-700 shadow-lg border border-white/40 hover:-translate-y-0.5 transition-transform';

export const MapUI: React.FC<MapUIProps> = ({ onZoomIn, onZoomOut, onReset }) => {
  return (
    <div className="absolute top-4 right-4 z-[500] flex flex-col gap-2">
      <button onClick={onZoomIn} className={btn} aria-label="Zoom in">
        <ZoomIn className="w-4 h-4" />
      </button>
      <button onClick={onZoomOut} className={btn} aria-label="Zoom out">
        <ZoomOut className="w-4 h-4" />
      </button>
      <button onClick={onReset} className={btn} aria-label="Centralizar">
        <Maximize2 className="w-4 h-4" />
      </button>
    </div>
  );
};

export default MapUI;
