// TiqFeed.jsx — the 4:5 Instagram Feed cut of the TIQ film. Native reframe: the
// 16:9 dialogue film is scaled to full width and centered on a brand-ink canvas
// with a TIQ lockup and logo bug (no crop, no stretch). See presets.FeedReframe.
import React from 'react';
import { FeedReframe } from './presets.js';

export const TIQ_FEED_DURATION = 5366; // matches the film (≈178.9s @30)

export const TiqFeed = () => (
  <FeedReframe
    src="tiq-dialogue-v5.mp4"
    kicker="Trading IQ"
    title={'Know your\nnumber.'}
    ratio="feed"
  />
);
