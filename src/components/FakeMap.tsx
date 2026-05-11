import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  pickup?: string;
  destination?: string;
  animate?: boolean;
  className?: string;
}

// خريطة وهمية SVG مع شبكة شوارع ودبابيس متحركة
export function FakeMap({ pickup, destination, animate, className = "" }: Props) {
  const [carPos, setCarPos] = useState(0);

  useEffect(() => {
    if (!animate) return;
    let f = 0;
    const id = setInterval(() => {
      f = (f + 1) % 100;
      setCarPos(f);
    }, 80);
    return () => clearInterval(id);
  }, [animate]);

  const pickX = 60, pickY = 230;
  const destX = 280, destY = 70;
  const carX = pickX + (destX - pickX) * (carPos / 100);
  const carY = pickY + (destY - pickY) * (carPos / 100);

  return (
    <div className={`relative w-full h-full overflow-hidden bg-muted rounded-2xl ${className}`}>
      <svg viewBox="0 0 360 280" className="w-full h-full">
        {/* خلفية بقع خضراء كأنها حدائق */}
        <defs>
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <rect width="30" height="30" fill="oklch(0.96 0.01 145)" />
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="oklch(0.92 0.005 145)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="360" height="280" fill="url(#grid)" />

        {/* مناطق خضراء */}
        <circle cx="80" cy="80" r="35" fill="oklch(0.88 0.10 145)" opacity="0.6" />
        <circle cx="290" cy="200" r="45" fill="oklch(0.88 0.10 145)" opacity="0.5" />
        <rect x="180" y="120" width="60" height="40" rx="8" fill="oklch(0.88 0.06 145)" opacity="0.5" />

        {/* شوارع */}
        <path d="M0 230 L360 230" stroke="white" strokeWidth="14" />
        <path d="M0 130 L360 130" stroke="white" strokeWidth="10" />
        <path d="M120 0 L120 280" stroke="white" strokeWidth="10" />
        <path d="M240 0 L240 280" stroke="white" strokeWidth="12" />

        {/* مسار الرحلة */}
        <motion.path
          d={`M${pickX},${pickY} Q${(pickX + destX) / 2},${(pickY + destY) / 2 - 50} ${destX},${destY}`}
          stroke="oklch(0.72 0.22 145)"
          strokeWidth="4"
          strokeDasharray="8 6"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2 }}
        />

        {/* دبوس الالتقاط */}
        <g transform={`translate(${pickX}, ${pickY})`}>
          <motion.circle r="14" fill="oklch(0.72 0.22 145)" opacity="0.25"
            animate={{ scale: [1, 1.6, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
          <circle r="8" fill="oklch(0.72 0.22 145)" stroke="white" strokeWidth="2.5" />
        </g>

        {/* دبوس الوجهة */}
        <g transform={`translate(${destX}, ${destY})`}>
          <motion.path
            d="M0 -22 C8 -22 12 -16 12 -10 C12 -2 0 8 0 8 C0 8 -12 -2 -12 -10 C-12 -16 -8 -22 0 -22 Z"
            fill="oklch(0.62 0.24 25)"
            stroke="white" strokeWidth="2"
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
          />
          <circle cy="-12" r="3.5" fill="white" />
        </g>

        {/* السيارة المتحركة */}
        {animate && (
          <g transform={`translate(${carX}, ${carY})`}>
            <circle r="10" fill="white" stroke="oklch(0.72 0.22 145)" strokeWidth="2" />
            <text x="0" y="4" textAnchor="middle" fontSize="12">🚕</text>
          </g>
        )}
      </svg>

      <AnimatePresence>
        {(pickup || destination) && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-3 inset-x-3 bg-card/95 backdrop-blur rounded-xl p-2.5 text-xs shadow-card"
          >
            {pickup && <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> {pickup}</div>}
            {destination && <div className="flex items-center gap-2 mt-1"><span className="h-2 w-2 rounded-full bg-destructive" /> {destination}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
