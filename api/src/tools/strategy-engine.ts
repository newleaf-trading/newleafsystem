/**
 * Bridge to the shared strategy engine (pipeline/strategy-engine.js).
 * Single source of truth — the API imports the SAME code the scanner uses.
 * Uses createRequire to load CJS module from ESM context.
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const thisDir = path.dirname(fileURLToPath(import.meta.url));

// Resolve pipeline files: in dev they're at ../../pipeline/*.js (repo sibling),
// in Cloud Functions they're copied to api/pipeline/*.cjs by the build script
// (.cjs because the API package has "type": "module" and these are CJS).
const localPipeline = path.resolve(thisDir, '../../../pipeline/strategy-engine.js');
const deployedPipeline = path.resolve(thisDir, '../../pipeline/strategy-engine.cjs');
const enginePath = require('fs').existsSync(localPipeline) ? localPipeline : deployedPipeline;

const engine = require(enginePath);

// Gamma analyzer is a separate CJS file in the pipeline
const localGamma = path.resolve(thisDir, '../../../pipeline/gamma-analyzer-enhanced.js');
const deployedGamma = path.resolve(thisDir, '../../pipeline/gamma-analyzer-enhanced.cjs');
const gammaPath = require('fs').existsSync(localGamma) ? localGamma : deployedGamma;
const gammaModule = require(gammaPath);

export const analyzeTechnicals: (bars: any[], spot: number) => any = engine.analyzeTechnicals;
export const calcScore: (gammaData: any, technicalData: any) => { total: number; pillars: { gamma: number; iv: number; trend: number }; hasOptions: boolean } = engine.calcScore;
export const getDirection: (gammaData: any, technicalData: any) => 'bullish' | 'bearish' | 'neutral' = engine.getDirection;
export const selectStrategy: (gammaData: any, direction: string, snapshotPrice: number, technicalData: any) => any = engine.selectStrategy;
export const premiumRiskPenalty: (strategyCode: string, gammaData: any, technicalData: any) => { penalty: number; reasons: string[] } = engine.premiumRiskPenalty;
export const STRATEGIES: Record<string, any> = engine.STRATEGIES;
export const reconcileDirection: (rawDirection: string, strategyCode: string) => string = engine.reconcileDirection;
export const analyzeGammaEnhanced: (contracts: any[], spot: number, dteMin: number, dteMax: number, oiDeltaData: any) => any = gammaModule.analyzeGammaEnhanced;
