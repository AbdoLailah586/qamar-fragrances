import React from 'react';

interface WatermarkOverlayProps {
  compact?: boolean;
}

export const WatermarkOverlay: React.FC<WatermarkOverlayProps> = ({ compact = false }) => {
  return (
    <div
      aria-hidden="true"
      data-testid="qamar-watermark-overlay"
      className="pointer-events-none select-none absolute inset-0 z-[2] overflow-hidden"
    >
      <svg className="w-full h-full opacity-[0.14]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id={compact ? 'qamar-wm-compact' : 'qamar-wm-full'}
            width={compact ? '115' : '150'}
            height={compact ? '80' : '105'}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-24)"
          >
            <text
              x="6"
              y={compact ? '36' : '48'}
              fill="#252a31"
              fontSize={compact ? '10' : '12'}
              fontWeight="800"
              fontFamily="Cairo, sans-serif"
            >
              قمر للعطور • Qamar
            </text>
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={`url(#${compact ? 'qamar-wm-compact' : 'qamar-wm-full'})`}
        />
      </svg>
      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-white/75 backdrop-blur-xs text-[9px] font-extrabold text-[#4f4335]/80 tracking-wide shadow-2xs">
        Qamar Fragrances ©
      </span>
    </div>
  );
};
