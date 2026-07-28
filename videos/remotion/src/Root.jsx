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

const HD = { width: 1920, height: 1080, fps: 30 };

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
