// ------------------------------------------------------------
// Composition registry. Every id here shows up in the Studio
// sidebar (npm start) and is renderable by name (npm run render).
// All comps are 1920x1080 @ 30fps to match the pipeline output.
// ------------------------------------------------------------
import React from 'react';
import { Composition } from 'remotion';
import {
  WarRoomOpen,
  TitleCard,
  LowerThird,
  MetricCard,
} from './newleaf-remotion-kit.jsx';
import { FootageComposite } from './FootageComposite.jsx';
import { PayoffDiagram } from './PayoffDiagram.jsx';
import { ChecklistViz } from './ChecklistViz.jsx';
import { SvgFrame } from './SvgFrame.jsx';
import { ComplianceOverlay } from './ComplianceOverlay.jsx';
import { WarRoomSegment } from './WarRoomSegment.jsx';
import { VoxExplainer } from './VoxExplainer.jsx';
import { KineticHeadline, BigStat, BarReveal } from './vox-kit.jsx';
import { HighchartsDemo } from './HighchartsDemo.jsx';
import { HighchartsBar } from './HighchartsBar.jsx';
import { GrainDemo } from './GrainOverlay.jsx';
import { VixExplainer } from './VixExplainer.jsx';
import { PaperDemo } from './PaperDemo.jsx';
import { VixPaper } from './VixPaper.jsx';
import { DeltaNeutralPaper } from './DeltaNeutralPaper.jsx';
import { DeltaNeutralShort } from './DeltaNeutralShort.jsx';
import { DeltaVideo1 } from './DeltaVideo1.jsx';
import { DeltaMasterclass, MASTERCLASS_DURATION } from './DeltaMasterclass.jsx';
import { SeriesStyleFrame } from './SeriesStyleFrame.jsx';
import { Trailer, TRAILER_DURATION } from './Trailer.jsx';
import { Episode1, EP1_DURATION } from './Episode1.jsx';
import { Episode2, EP2_DURATION } from './Episode2.jsx';
import { MarketStateGraph, MSG_DURATION } from './MarketStateGraph.jsx';
import { TerrainProto, TERRAIN_DURATION } from './TerrainProto.jsx';
import { TiqHero, TIQ_HERO_DURATION } from './TiqHero.jsx';
import { TiqHeroVox } from './TiqHeroVox.jsx';
import { TiqHeroCinematic } from './TiqHeroCinematic.jsx';
import { TiqOverlay, TIQ_OVERLAY_DURATION } from './TiqOverlay.jsx';
import { LogoLockup, LOGO_LOCKUP_W, LOGO_LOCKUP_H } from './LogoLockup.jsx';
import { TiqOverlayVertical, TIQ_OVERLAY_VERTICAL_DURATION } from './TiqOverlayVertical.jsx';
// Branded wrappers for screen recordings (intro / outro / lower-third).
import { FeatureVideo, Intro, IntroVertical, Outro } from './NewLeafBrand.jsx';
import { Thumbnail } from './Thumbnail.jsx';
import { TiqFeed, TIQ_FEED_DURATION } from './TiqFeed.jsx';
import { DISCOVER_VO } from './discover-vo.js';
import { DISCOVER_INTRO, DISCOVER_INTRO_LEN } from './discover-intro.js';
import { PROJECTION_2026_08_02_VO } from './projection-2026-08-02-vo.js';
import { PROJECTION_2026_08_02_INTRO, PROJECTION_2026_08_02_INTRO_LEN } from './projection-2026-08-02-intro.js';

const HD = { width: 1920, height: 1080, fps: 30 };

// seconds → frames (at 30fps) for the FeatureVideo timings below.
const s = (n) => Math.round(n * 30);

// LowerThird / MetricCard are overlays with no background of their own;
// wrap them so they're legible on the transparent Studio canvas.
const Framed = (Comp) => (props) => (
  <div style={{ width: '100%', height: '100%', backgroundColor: '#16271C' }}>
    <Comp {...props} />
  </div>
);

export const RemotionRoot = () => {
  return (
    <>
      {/* ══════════ Branded screen-recording wrappers ══════════ */}
      {/* ── DISCOVER ── */}
      <Composition
        id="Discover"
        component={FeatureVideo}
        width={1920} height={1080} fps={30}
        // context intro − 15f crossfade + capture (cropped to end just after the
        // closing VO — trims the ~2.6s dead tail) + outro (270f)
        durationInFrames={DISCOVER_INTRO_LEN - 15 + 9034 + 270}
        defaultProps={{
          capture: 'captures/discover-run.mp4',
          // captureLen cropped to 9034f (≈300.5s): recording is 303.7s but VO ends
          // ~300.5s, so we cut the dead tail rather than hold on a silent screen.
          captureLen: 9034,
          voSegments: DISCOVER_VO,        // female VO (nova), anchored to timestamps
          introBeats: DISCOVER_INTRO,     // multi-screen problem→solution setup
          introLen: DISCOVER_INTRO_LEN,
          outroLen: 270,
          outroVo: 'vo/discover/outro.mp3',
          outroHeadline: 'Analyse your favourite\nstocks and strategies.',
          outroCta: 'Join NewLeaf — free',
          outroUrl: 'newleafsystem.com/workbench/discover.html',
          outroNote: 'See what Discover recommends.',
          chapters: [],   // no lower-thirds for this cut (keeps the UI unobstructed)
        }}
      />

      {/* ── PROJECTION (long-term strategy walkthrough, Fish voice, paused-removed) ── */}
      <Composition
        id="Projection"
        component={FeatureVideo}
        width={1920} height={1080} fps={30}
        durationInFrames={PROJECTION_2026_08_02_INTRO_LEN - 15 + 7410 + 186}
        defaultProps={{
          capture: 'captures/projection-run.mp4',
          captureLen: 7410,   // tightened, VO-synced to Sarah (Fish) narration
          voSegments: PROJECTION_2026_08_02_VO,
          introBeats: PROJECTION_2026_08_02_INTRO,
          introLen: PROJECTION_2026_08_02_INTRO_LEN,
          outroLen: 186,
          outroVo: 'vo/projection-2026-08-02/outro.mp3',
          outroHeadline: 'Plan your own strategy.',
          outroCta: 'Start free',
          outroUrl: 'newleafsystem.com/workbench/projection',
          outroNote: "It's a free tool.",
          chapters: [],
        }}
      />

      {/* ── TIQ / INSTINCT ── */}
      <Composition
        id="Instinct"
        component={FeatureVideo}
        width={1920} height={1080} fps={30}
        durationInFrames={s(4) - 15 + s(120) + s(6)}
        defaultProps={{
          capture: 'captures/instinct-run.mp4',
          // ⚠ PLACEHOLDER — set from your recording (seconds × 30) + update duration.
          captureLen: s(120),
          introTitle: 'How often are you\ncertain — and wrong?',
          introSub: 'The one number you cannot get from your own P&L.',
          outroHeadline: 'Four minutes. Find your weakest axis.',
          outroCta: 'Take the quiz free',
          // ⚠ PLACEHOLDER — lower-third offsets; set from the actual recording.
          chapters: [
            { at: s(3),  len: s(5), label: 'Confidence first', detail: 'Locked before the result, and unrevisable' },
            { at: s(48), len: s(5), label: 'Five dimensions',  detail: 'Knowledge, emotion, system, risk, market read' },
            { at: s(92), len: s(6), label: 'The gap',          detail: 'How far your confidence sat from your accuracy', hue: '#C96F5E' },
          ],
        }}
      />

      {/* ── standalone pieces, for editing outside Remotion ── */}
      <Composition
        id="IntroOnly" component={Intro}
        width={1920} height={1080} fps={30} durationInFrames={s(4)}
        defaultProps={{ title: 'Eight agents.\nOne trade.', sub: 'The engine computes. The agents interpret.' }}
      />
      <Composition
        id="OutroOnly" component={Outro}
        width={1920} height={1080} fps={30} durationInFrames={s(6)}
        defaultProps={{
          headline: 'Try it on a ticker you actually trade.',
          cta: 'Join NewLeaf free',
          url: 'newleafsystem.com',
          note: 'No card. Bring your own watchlist.',
        }}
      />

      {/* ── vertical + feed intros (Reels/Shorts 9:16, Feed 4:5) ── */}
      <Composition
        id="IntroVertical" component={IntroVertical}
        width={1080} height={1920} fps={30} durationInFrames={s(4)}
        defaultProps={{ title: 'Know your\nnumber.', sub: 'Before you place the trade.' }}
      />
      <Composition
        id="IntroFeed" component={IntroVertical}
        width={1080} height={1350} fps={30} durationInFrames={s(4)}
        defaultProps={{ title: 'Know your\nnumber.', sub: 'Before you place the trade.' }}
      />

      {/* ── vertical cut for shorts (1080×1920) ── */}
      <Composition
        id="OutroVertical" component={Outro}
        width={1080} height={1920} fps={30} durationInFrames={s(5)}
        defaultProps={{
          headline: 'Try it free.',
          cta: 'Join NewLeaf',
          url: 'newleafsystem.com',
          note: 'Bring your own watchlist.',
        }}
      />

      {/* ══════════ Social pipeline: thumbnails (stills) + 4:5 feed cut ══════════ */}
      <Composition
        id="ThumbnailYT" component={Thumbnail}
        width={1280} height={720} fps={30} durationInFrames={1}
        defaultProps={{ title: 'Know your\nnumber.', kicker: 'Trading IQ', verdict: { label: 'Take the test', kind: 'neutral' }, variant: 'a' }}
      />
      <Composition
        id="ThumbnailIG" component={Thumbnail}
        width={1080} height={1350} fps={30} durationInFrames={1}
        defaultProps={{ title: 'Know your\nnumber.', kicker: 'Trading IQ', verdict: { label: 'Take the test', kind: 'neutral' }, variant: 'a' }}
      />
      <Composition
        id="TiqFeed" component={TiqFeed}
        width={1080} height={1350} fps={30} durationInFrames={TIQ_FEED_DURATION}
      />

      <Composition
        id="TiqHero"
        component={TiqHero}
        durationInFrames={TIQ_HERO_DURATION}
        {...HD}
      />
      <Composition
        id="TiqHeroVox"
        component={TiqHeroVox}
        durationInFrames={TIQ_HERO_DURATION}
        {...HD}
      />
      <Composition
        id="TiqHeroCinematic"
        component={TiqHeroCinematic}
        durationInFrames={TIQ_HERO_DURATION}
        {...HD}
      />
      <Composition
        id="TiqOverlay"
        component={TiqOverlay}
        durationInFrames={TIQ_OVERLAY_DURATION}
        {...HD}
      />
      <Composition
        id="LogoLockup"
        component={LogoLockup}
        durationInFrames={30}
        width={LOGO_LOCKUP_W} height={LOGO_LOCKUP_H} fps={30}
      />
      <Composition
        id="TiqOverlayVertical"
        component={TiqOverlayVertical}
        durationInFrames={TIQ_OVERLAY_VERTICAL_DURATION}
        width={1080} height={1920} fps={30}
      />
      <Composition
        id="Episode2"
        component={Episode2}
        durationInFrames={EP2_DURATION}
        {...HD}
      />
      <Composition
        id="WarRoomOpen"
        component={WarRoomOpen}
        durationInFrames={240}
        {...HD}
      />
      <Composition
        id="TitleCard"
        component={TitleCard}
        durationInFrames={110}
        {...HD}
        defaultProps={{
          eyebrow: 'THE WAR ROOM',
          title: 'The Iron Condor',
          subtitle: 'Defined risk. Two walls. One kill zone.',
        }}
      />
      <Composition
        id="LowerThird"
        component={Framed(LowerThird)}
        durationInFrames={90}
        {...HD}
        defaultProps={{ name: 'Maya', role: 'Premium Seller · NewLeaf Desk' }}
      />
      <Composition
        id="MetricCard"
        component={Framed(MetricCard)}
        durationInFrames={90}
        {...HD}
        defaultProps={{ label: 'SETUP QUALITY', value: 8.4, suffix: '/10' }}
      />
      <Composition
        id="FootageComposite"
        component={FootageComposite}
        durationInFrames={120}
        {...HD}
        defaultProps={{
          src: 'footage/NewleafPOW/clips/normalised/scene_01.mp4',
        }}
      />
      <Composition
        id="PayoffDiagram"
        component={PayoffDiagram}
        durationInFrames={120}
        {...HD}
        defaultProps={{
          title: 'Bull Call Spread',
          legs: [
            { x: 90, y: -4 },
            { x: 100, y: -4 },
            { x: 110, y: 6 },
            { x: 120, y: 6 },
          ],
          strikes: [100, 110],
          breakeven: 104,
        }}
      />
      <Composition id="SvgFrame" component={SvgFrame} durationInFrames={30} width={640} height={300} fps={30} />
      <Composition
        id="ChecklistViz"
        component={ChecklistViz}
        durationInFrames={60}
        {...HD}
      />
      <Composition
        id="ComplianceOverlay"
        component={Framed(ComplianceOverlay)}
        durationInFrames={150}
        {...HD}
        defaultProps={{
          text: 'Not investment advice · Options involve risk · For education only',
        }}
      />
      <Composition
        id="WarRoomSegment"
        component={WarRoomSegment}
        durationInFrames={300}
        {...HD}
        defaultProps={{
          eyebrow: 'THE WAR ROOM',
          title: 'The Bull Call Spread',
          subtitle: 'Defined risk. Oversold. Above a defended wall.',
          footage: 'footage/NewleafPOW/clips/normalised/scene_01.mp4',
          presenter: 'Maya',
          role: 'Premium Seller · NewLeaf Desk',
        }}
      />

      {/* --- Vox-style explainer kit --- */}
      <Composition
        id="VoxExplainer"
        component={VoxExplainer}
        durationInFrames={660}
        {...HD}
        defaultProps={{ footage: 'footage/NewleafPOW/clips/normalised/scene_02.mp4' }}
      />
      <Composition id="VixExplainer" component={VixExplainer} durationInFrames={820} {...HD} />
      <Composition id="PaperDemo" component={PaperDemo} durationInFrames={260} {...HD} />
      <Composition id="VixPaper" component={VixPaper} durationInFrames={1184} {...HD} />
      <Composition id="DeltaNeutralPaper" component={DeltaNeutralPaper} durationInFrames={1231} {...HD} />
      <Composition id="DeltaNeutralShort" component={DeltaNeutralShort} durationInFrames={1231} width={1080} height={1920} fps={30} />
      <Composition id="DeltaVideo1" component={DeltaVideo1} durationInFrames={3009} {...HD} />
      <Composition id="DeltaMasterclass" component={DeltaMasterclass} durationInFrames={MASTERCLASS_DURATION} {...HD} />
      <Composition id="SeriesStyleFrame" component={SeriesStyleFrame} durationInFrames={600} {...HD} />
      <Composition id="Trailer" component={Trailer} durationInFrames={TRAILER_DURATION} {...HD} />
      <Composition id="Episode1" component={Episode1} durationInFrames={EP1_DURATION} {...HD} />
      <Composition id="MarketStateGraph" component={MarketStateGraph} durationInFrames={MSG_DURATION} {...HD} />
      <Composition id="TerrainProto" component={TerrainProto} durationInFrames={TERRAIN_DURATION} {...HD} />
      <Composition
        id="KineticHeadline"
        component={Framed(KineticHeadline)}
        durationInFrames={90}
        {...HD}
        defaultProps={{
          parts: [
            { text: 'Most traders buy the top.', highlight: false },
            { text: 'Pros cap it.', highlight: true },
          ],
          fontSize: 110,
        }}
      />
      <Composition
        id="BigStat"
        component={BigStat}
        durationInFrames={110}
        {...HD}
        defaultProps={{
          kicker: 'PROBABILITY OF PROFIT',
          value: 72,
          suffix: '%',
          footnote: 'at expiration, per the model',
        }}
      />
      <Composition
        id="BarReveal"
        component={BarReveal}
        durationInFrames={150}
        {...HD}
        defaultProps={{ title: 'Reward-to-risk by strategy' }}
      />
      <Composition
        id="HighchartsDemo"
        component={HighchartsDemo}
        durationInFrames={150}
        {...HD}
        defaultProps={{
          title: 'AAPL · dip to a defended wall, then revert',
          wall: 100,
        }}
      />
      <Composition
        id="HighchartsBar"
        component={HighchartsBar}
        durationInFrames={120}
        {...HD}
        defaultProps={{ title: 'Reward-to-risk by strategy' }}
      />
      <Composition
        id="GrainDemo"
        component={GrainDemo}
        durationInFrames={90}
        {...HD}
        defaultProps={{ grain: 0.13, vignette: 0.42 }}
      />
    </>
  );
};
