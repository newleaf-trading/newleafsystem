import { useState, useRef, useCallback } from 'react';

const API_URL = 'https://us-central1-newleaf-trading.cloudfunctions.net/api';
const API_KEY = import.meta.env.VITE_NL_API_KEY;

/**
 * Plain-English coach for the Projection simulator.
 *
 * Architecture rule: CODE COMPUTES, LLM NARRATES. The model receives the EXACT
 * numbers the engine already computed (in `context`) and may only quote/explain
 * them — it must never invent, recompute, or contradict any figure. This keeps
 * the AI surface internally consistent with every panel on the page.
 */
const SYSTEM =
  'You are a plain-English options-trading coach on NewLeaf\'s Projection simulator. ' +
  'The user has configured a plan whose EXACT numbers are given to you as JSON — they were ' +
  'already computed by the simulator. ' +
  'RULES: (1) Use ONLY the numbers provided; NEVER invent, recompute, round differently, or ' +
  'contradict any figure. (2) Be concrete about weekly cadence, the reward:risk, and the options ' +
  'structure that fits (iron condors, butterflies, vertical/bull-call spreads, ratio shapes like ' +
  '1x1 or 2x1). (3) Do not promise or guarantee returns — these are model outputs, not predictions. ' +
  '(4) Plain, friendly, beginner-readable. Educational only, not financial advice.';

function buildUser(kind, context, question) {
  const data = `Plan numbers (do not change these):\n${JSON.stringify(context, null, 2)}`;
  if (kind === 'summary') {
    return (
      'Summarise what this plan asks of the user in 2–3 short sentences a beginner understands: ' +
      'the trading cadence (trades per week), the reward:risk and the option structure that fits, ' +
      'and one honest caveat. Keep it under 70 words. Start directly with the summary — no preamble.\n\n' +
      data
    );
  }
  return `Question: ${question}\n\nAnswer concisely (under 120 words) using only the plan numbers.\n\n${data}`;
}

async function callLLM(user, maxTokens) {
  const res = await fetch(`${API_URL}/api/llm/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({ model: 'qwen-max', system: SYSTEM, user, maxTokens }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  const text = (data.response || '').trim();
  if (!text) throw new Error('empty response');
  return text;
}

export function useProjectionCoach() {
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  const [answer, setAnswer] = useState(null);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [answerError, setAnswerError] = useState(null);

  const cache = useRef({}); // contextKey → summary text, avoids duplicate calls

  const generateSummary = useCallback(async (context, contextKey) => {
    if (cache.current[contextKey]) {
      setSummary(cache.current[contextKey]);
      setSummaryError(null);
      return;
    }
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const text = await callLLM(buildUser('summary', context), 260);
      cache.current[contextKey] = text;
      setSummary(text);
    } catch (err) {
      setSummaryError(err.message);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const ask = useCallback(async (question, context) => {
    if (!question.trim()) return;
    setAnswerLoading(true);
    setAnswerError(null);
    setAnswer(null);
    try {
      setAnswer(await callLLM(buildUser('question', context, question), 420));
    } catch (err) {
      setAnswerError(err.message);
    } finally {
      setAnswerLoading(false);
    }
  }, []);

  return {
    summary, summaryLoading, summaryError, generateSummary,
    answer, answerLoading, answerError, ask,
  };
}
