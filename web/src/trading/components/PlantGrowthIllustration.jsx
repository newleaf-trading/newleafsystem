/**
 * PlantGrowthIllustration - Animated SVG showing the 4-stage NewLeaf journey
 * Seed → Sprout → Plant → Full Leaf
 */

export function PlantGrowthIllustration() {
  return (
    <svg className="growth-scene" viewBox="0 0 1200 440" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet">
      <defs>
        {/* Sky gradient */}
        <linearGradient id="sky-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#010805"/>
          <stop offset="55%" stopColor="#041208"/>
          <stop offset="100%" stopColor="#082015"/>
        </linearGradient>

        {/* Soil gradients */}
        <linearGradient id="soil-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a1a08"/>
          <stop offset="50%" stopColor="#2d1208"/>
          <stop offset="100%" stopColor="#1a0b04"/>
        </linearGradient>
        <linearGradient id="soil-deep" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a0b04"/>
          <stop offset="100%" stopColor="#0a0502"/>
        </linearGradient>

        {/* Leaf greens */}
        <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1c5e38"/>
          <stop offset="100%" stopColor="#0b2d23"/>
        </linearGradient>
        <linearGradient id="lg2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#25784a"/>
          <stop offset="100%" stopColor="#165038"/>
        </linearGradient>
        <linearGradient id="lg3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2ea05a"/>
          <stop offset="100%" stopColor="#1c6840"/>
        </linearGradient>
        <linearGradient id="lg4" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3dcf6a"/>
          <stop offset="100%" stopColor="#22a048"/>
        </linearGradient>

        {/* Glows */}
        <radialGradient id="seed-aura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(201, 169, 110,0.45)"/>
          <stop offset="100%" stopColor="rgba(201, 169, 110,0)"/>
        </radialGradient>
        <radialGradient id="sprout-glow" cx="50%" cy="90%" r="60%">
          <stop offset="0%" stopColor="rgba(30,120,65,0.35)"/>
          <stop offset="100%" stopColor="rgba(30,120,65,0)"/>
        </radialGradient>
        <radialGradient id="plant-glow" cx="50%" cy="80%" r="65%">
          <stop offset="0%" stopColor="rgba(40,160,80,0.28)"/>
          <stop offset="100%" stopColor="rgba(40,160,80,0)"/>
        </radialGradient>
        <radialGradient id="leaf-aura" cx="50%" cy="60%" r="70%">
          <stop offset="0%" stopColor="rgba(56,207,106,0.22)"/>
          <stop offset="100%" stopColor="rgba(56,207,106,0)"/>
        </radialGradient>
        <radialGradient id="gold-aura" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="rgba(201, 169, 110,0.28)"/>
          <stop offset="100%" stopColor="rgba(201, 169, 110,0)"/>
        </radialGradient>

        {/* Horizon glow */}
        <radialGradient id="horizon" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="rgba(12,55,35,0.55)"/>
          <stop offset="100%" stopColor="rgba(12,55,35,0)"/>
        </radialGradient>

        {/* Mist overlay */}
        <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(4,18,10,0)"/>
          <stop offset="60%" stopColor="rgba(4,18,10,0)"/>
          <stop offset="100%" stopColor="rgba(4,18,10,0.85)"/>
        </linearGradient>

        <filter id="soft-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="leaf-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* SKY */}
      <rect width="1200" height="500" fill="url(#sky-bg)"/>

      {/* Horizon atmospheric bloom */}
      <ellipse cx="600" cy="315" rx="700" ry="90" fill="url(#horizon)"/>

      {/* Scattered stars */}
      <circle className="star s1"  cx="72"  cy="35"  r="1.1" fill="rgba(255,255,255,0.28)"/>
      <circle className="star s2"  cx="190" cy="18"  r="0.8" fill="rgba(255,255,255,0.22)"/>
      <circle className="star s3"  cx="310" cy="50"  r="1.3" fill="rgba(255,255,255,0.18)"/>
      <circle className="star s4"  cx="455" cy="14"  r="0.9" fill="rgba(255,255,255,0.25)"/>
      <circle className="star s5"  cx="575" cy="42"  r="1.0" fill="rgba(255,255,255,0.2)"/>
      <circle className="star s6"  cx="690" cy="22"  r="0.8" fill="rgba(255,255,255,0.18)"/>
      <circle className="star s7"  cx="825" cy="48"  r="1.2" fill="rgba(255,255,255,0.22)"/>
      <circle className="star s8"  cx="940" cy="16"  r="0.9" fill="rgba(255,255,255,0.28)"/>
      <circle className="star s9"  cx="1060" cy="38" r="1.0" fill="rgba(255,255,255,0.2)"/>
      <circle className="star s10" cx="1140" cy="12" r="0.8" fill="rgba(255,255,255,0.18)"/>

      {/* SOIL */}
      <path d="M0,315 Q80,306 160,315 Q240,324 320,315 Q400,306 480,315 Q560,324 640,315 Q720,306 800,315 Q880,324 960,315 Q1040,306 1120,315 Q1160,319 1200,315 L1200,500 L0,500 Z" fill="url(#soil-top)"/>
      <rect x="0" y="380" width="1200" height="120" fill="url(#soil-deep)"/>

      {/* Label area dark panel */}
      <rect x="0" y="430" width="1200" height="135" fill="rgba(1,6,3,0.88)"/>
      <line x1="0" y1="430" x2="1200" y2="430" stroke="rgba(201, 169, 110,0.14)" strokeWidth="1"/>

      {/* Timeline connector in soil */}
      <line x1="155" y1="415" x2="1045" y2="415" stroke="rgba(201, 169, 110,0.22)" strokeWidth="1.5" strokeDasharray="6 5"/>

      {/* STAGE 1 — THE SEED x=200 */}
      <g className="growth-stage gs1">
        <ellipse cx="200" cy="344" rx="48" ry="30" fill="url(#seed-aura)" className="seed-pulse"/>

        {/* Root tendrils */}
        <path d="M200,360 C198,372 195,385 192,398" stroke="rgba(130,75,35,0.45)" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
        <path d="M200,360 C203,371 206,383 210,395" stroke="rgba(130,75,35,0.45)" strokeWidth="1.1" fill="none" strokeLinecap="round"/>

        {/* Seed body */}
        <ellipse cx="200" cy="346" rx="16" ry="11" fill="#b8903a" opacity="0.9" filter="url(#soft-glow)"/>
        <ellipse cx="200" cy="346" rx="16" ry="11" fill="none" stroke="rgba(201, 169, 110,0.55)" strokeWidth="1.2"/>
        <path d="M186,346 Q200,338 214,346" stroke="rgba(201, 169, 110,0.35)" strokeWidth="0.8" fill="none"/>
        <ellipse cx="193" cy="341" rx="4.5" ry="2.5" fill="rgba(255,255,255,0.22)" transform="rotate(-20,193,341)"/>

        {/* Timeline dot */}
        <circle cx="200" cy="415" r="5"  fill="#C9A96E"/>
        <circle cx="200" cy="415" r="10" fill="none" stroke="rgba(201, 169, 110,0.25)" strokeWidth="1"/>
      </g>

      {/* STAGE 2 — SPROUT x=430 */}
      <g className="growth-stage gs2">
        <ellipse cx="430" cy="315" rx="55" ry="22" fill="url(#sprout-glow)"/>

        {/* Root system */}
        <g className="plant-above">
          <path d="M430,315 C428,328 426,342 424,356" stroke="rgba(100,65,35,0.6)" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
          <path d="M430,315 C432,327 434,340 436,354" stroke="rgba(100,65,35,0.6)" strokeWidth="2.2" fill="none" strokeLinecap="round"/>

          {/* Stem */}
          <path d="M430,315 Q428,288 426,268" stroke="rgba(90,140,70,0.75)" strokeWidth="2.8" fill="none" strokeLinecap="round"/>

          {/* First tiny leaves */}
          <ellipse cx="420" cy="278" rx="8" ry="5" fill="url(#lg1)" opacity="0.85" transform="rotate(-45,420,278)"/>
          <ellipse cx="438" cy="282" rx="7" ry="4.5" fill="url(#lg1)" opacity="0.85" transform="rotate(35,438,282)"/>
        </g>

        <circle cx="430" cy="415" r="5" fill="#25784a"/>
        <circle cx="430" cy="415" r="10" fill="none" stroke="rgba(37,120,74,0.3)" strokeWidth="1"/>
      </g>

      {/* STAGE 3 — PLANT x=680 */}
      <g className="growth-stage gs3">
        <ellipse cx="680" cy="300" rx="70" ry="28" fill="url(#plant-glow)"/>

        <g className="plant-above">
          {/* Main stem */}
          <path d="M680,315 Q678,265 676,220" stroke="rgba(80,130,65,0.85)" strokeWidth="3.5" fill="none" strokeLinecap="round"/>

          {/* Leaves - medium size */}
          <ellipse cx="660" cy="250" rx="18" ry="11" fill="url(#lg2)" opacity="0.9" transform="rotate(-35,660,250)" filter="url(#leaf-glow)"/>
          <ellipse cx="698" cy="258" rx="16" ry="10" fill="url(#lg2)" opacity="0.9" transform="rotate(30,698,258)" filter="url(#leaf-glow)"/>
          <ellipse cx="664" cy="285" rx="20" ry="12" fill="url(#lg3)" opacity="0.92" transform="rotate(-25,664,285)" filter="url(#leaf-glow)"/>
          <ellipse cx="694" cy="290" rx="19" ry="11.5" fill="url(#lg3)" opacity="0.92" transform="rotate(28,694,290)" filter="url(#leaf-glow)"/>
        </g>

        <circle cx="680" cy="415" r="5" fill="#2ea05a"/>
        <circle cx="680" cy="415" r="10" fill="none" stroke="rgba(46,160,90,0.35)" strokeWidth="1"/>
      </g>

      {/* STAGE 4 — FULL LEAF x=960 */}
      <g className="growth-stage gs4">
        <ellipse cx="960" cy="285" rx="90" ry="35" fill="url(#leaf-aura)"/>
        <ellipse cx="960" cy="190" rx="65" ry="25" fill="url(#gold-aura)"/>

        <g className="plant-above">
          {/* Strong stem */}
          <path d="M960,315 Q958,250 956,185" stroke="rgba(70,120,60,0.95)" strokeWidth="4.2" fill="none" strokeLinecap="round"/>

          {/* Large mature leaves */}
          <ellipse cx="930" cy="220" rx="28" ry="17" fill="url(#lg3)" opacity="0.95" transform="rotate(-30,930,220)" filter="url(#leaf-glow)"/>
          <ellipse cx="988" cy="228" rx="26" ry="16" fill="url(#lg3)" opacity="0.95" transform="rotate(32,988,228)" filter="url(#leaf-glow)"/>
          <ellipse cx="926" cy="260" rx="32" ry="19" fill="url(#lg4)" opacity="0.96" transform="rotate(-22,926,260)" filter="url(#leaf-glow)"/>
          <ellipse cx="992" cy="266" rx="30" ry="18" fill="url(#lg4)" opacity="0.96" transform="rotate(25,992,266)" filter="url(#leaf-glow)"/>

          {/* Golden NewLeaf at top */}
          <g filter="url(#leaf-glow)">
            <ellipse cx="960" cy="180" rx="35" ry="22" fill="url(#lg4)" opacity="0.98" transform="rotate(-5,960,180)"/>
            <path d="M960,180 Q960,165 960,155" stroke="rgba(201, 169, 110,0.8)" strokeWidth="1.5" fill="none"/>

            {/* Sparkle glints */}
            <circle className="sparkle sp1" cx="950" cy="175" r="2.5" fill="rgba(255,255,255,0.6)"/>
            <circle className="sparkle sp2" cx="967" cy="182" r="2" fill="rgba(255,255,255,0.5)"/>
            <circle className="sparkle sp3" cx="958" cy="188" r="1.8" fill="rgba(255,255,255,0.55)"/>
          </g>
        </g>

        <circle cx="960" cy="415" r="5" fill="#3dcf6a"/>
        <circle className="pulse-ring" cx="960" cy="415" r="10" fill="none" stroke="rgba(61,207,106,0.4)" strokeWidth="1"/>
        <circle cx="960" cy="415" r="10" fill="none" stroke="rgba(61,207,106,0.35)" strokeWidth="1"/>
      </g>

      {/* Bottom mist fade */}
      <rect x="0" y="0" width="1200" height="500" fill="url(#mist)" pointerEvents="none"/>
    </svg>
  );
}
