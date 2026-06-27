import { useEffect, useState } from "react";



export type KeeperMood = "rest" | "listening" | "concerned" | "warm";



interface KeeperProps {

mood?: KeeperMood;

size?: number;

className?: string;

}



/**

 * Soft breathing blob with two dot eyes + minimal mouth.

 * Pure CSS — no illustration assets.

 */

export function Keeper({ mood = "rest", size = 220, className = "" }: KeeperProps) {

// smooth color transitions: rest = warm cream-tan, listening = periwinkle, concerned = coral, warm = soft coral

const palette: Record<KeeperMood, { from: string; to: string; glow: string; breathe: string }> = {

rest:       { from: "color-mix(in oklab, var(--periwinkle) 16%, var(--sand))", to: "color-mix(in oklab, var(--periwinkle) 30%, var(--sand-deep))", glow: "color-mix(in oklab, var(--periwinkle) 28%, transparent)", breathe: "keeper-breathe" },

listening:  { from: "color-mix(in oklab, var(--periwinkle) 35%, var(--sand))",

to:   "color-mix(in oklab, var(--periwinkle) 65%, var(--sand-deep))",

glow: "color-mix(in oklab, var(--periwinkle) 45%, transparent)",

breathe: "keeper-breathe-wide" },

concerned:  { from: "color-mix(in oklab, var(--coral) 50%, var(--sand))",

to:   "color-mix(in oklab, var(--coral) 80%, var(--sand-deep))",

glow: "color-mix(in oklab, var(--coral) 55%, transparent)",

breathe: "keeper-breathe-tight" },

warm:       { from: "color-mix(in oklab, var(--coral) 30%, var(--sand))",

to:   "color-mix(in oklab, var(--coral) 55%, var(--sand-deep))",

glow: "color-mix(in oklab, var(--coral) 35%, transparent)",

breathe: "keeper-breathe" },

  };

const p = palette[mood];



// Eyes & mouth geometry shifts by mood

const eyeY = mood === "concerned" ? 0.46 : 0.44;

const eyeGap = mood === "listening" ? 0.22 : 0.20;

// soften the resting eyes slightly so the calm face still feels friendly

const eyeScaleY = mood === "concerned" ? 0.6 : mood === "warm" ? 0.5 : mood === "rest" ? 0.85 : 1;

const mouthY = 0.62;

const mouthW = mood === "warm" ? 0.28 : mood === "concerned" ? 0.14 : mood === "rest" ? 0.20 : 0.18;

// rest now carries a clearly visible, welcoming upturn (≈75% of the warm smile)

const mouthCurve = mood === "warm" ? 0.06 : mood === "concerned" ? -0.04 : mood === "rest" ? 0.045 : 0.0;



const eyeSize = size * 0.055;

const cx = size / 2;



return (

<div

className={`relative inline-flex items-center justify-center ${className}`}

style={{ width: size, height: size }}

aria-hidden="true"

>

{/* glow halo */}

<div

className="absolute inset-0 rounded-full"

style={{

background: `radial-gradient(circle, ${p.glow} 0%, transparent 65%)`,

transition: "background 600ms ease",

filter: "blur(8px)",

transform: "scale(1.15)",

        }}

/>

{/* the blob */}

<div

className="relative"

style={{

width: size,

height: size,

animation: `${p.breathe} 4.5s ease-in-out infinite, keeper-morph 12s ease-in-out infinite`,

transition: "all 600ms cubic-bezier(0.4, 0, 0.2, 1)",

background: `radial-gradient(circle at 35% 30%, ${p.from} 0%, ${p.to} 75%)`,

borderRadius: "58% 42% 55% 45% / 50% 55% 45% 50%",

boxShadow: `0 20px 60px -20px ${p.glow}, inset -10px -20px 40px -10px color-mix(in oklab, ${p.to} 60%, transparent), inset 8px 12px 30px -8px color-mix(in oklab, white 50%, transparent)`,

        }}

>

{/* eyes */}

<span

className="absolute rounded-full"

          style={{

            width: eyeSize, height: eyeSize,

            background: "color-mix(in oklab, var(--foreground) 80%, var(--coral))",

            left: cx - size * eyeGap - eyeSize / 2,

            top: size * eyeY,

            transform: `scaleY(${eyeScaleY})`,

            transition: "transform 500ms ease",

          }}

/>

<span

className="absolute rounded-full"

          style={{

            width: eyeSize, height: eyeSize,

            background: "color-mix(in oklab, var(--foreground) 80%, var(--coral))",

            left: cx + size * eyeGap - eyeSize / 2,

            top: size * eyeY,

            transform: `scaleY(${eyeScaleY})`,

            transition: "transform 500ms ease",

          }}

/>

{/* mouth — fixed smile arc, no math */}

<svg

  className="absolute"

  width={size * 0.36}

  height={size * 0.12}

  style={{

    left: cx - size * 0.18,

    top: size * 0.58,

    transition: "all 500ms ease",

  }}

  viewBox="0 0 100 40"

  fill="none"

>

    <path

      d="M 18 13 Q 50 27 82 13"

      stroke="color-mix(in oklab, var(--foreground) 80%, var(--coral))"

      strokeWidth="5"

      strokeLinecap="round"

      fill="none"

    />

</svg>

</div>

</div>

  );

}



/** Hook that returns a debounced mood, so updates feel slow & gentle */

export function useSmoothMood(target: KeeperMood, delay = 400): KeeperMood {

const [mood, setMood] = useState<KeeperMood>(target);

useEffect(() => {

const t = setTimeout(() => setMood(target), delay);

return () => clearTimeout(t);

  }, [target, delay]);

return mood;

}