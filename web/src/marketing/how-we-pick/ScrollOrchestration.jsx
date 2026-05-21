/**
 * ScrollOrchestration — GSAP ScrollTrigger integration.
 *
 * Each caption section triggers a stage transition as it scrolls into view.
 * The dot field container is pinned (stays visible) while captions scroll past.
 * Counter animates between stage counts using easeOutExpo easing.
 */
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * @param {React.RefObject} containerRef — page container element
 * @param {object[]} stages — stage definitions with { count }
 * @param {function} onStageChange — callback(stageIndex)
 * @param {function} onCountUpdate — callback(displayCount)
 */
export function useScrollOrchestration(containerRef, stages, onStageChange, onCountUpdate) {
  const triggersRef = useRef([]);

  useEffect(() => {
    if (!containerRef.current || !stages.length) return;

    // Clean up previous triggers
    triggersRef.current.forEach(t => t.kill());
    triggersRef.current = [];

    const sections = containerRef.current.querySelectorAll('[data-stage]');
    if (sections.length === 0) return;

    sections.forEach((section, i) => {
      const trigger = ScrollTrigger.create({
        trigger: section,
        start: 'top center',
        end: 'bottom center',
        onEnter: () => {
          onStageChange(i);
          animateCount(stages[i].count, stages[Math.max(0, i - 1)]?.count || stages[0].count, onCountUpdate);
        },
        onEnterBack: () => {
          onStageChange(i);
          animateCount(stages[i].count, stages[Math.min(stages.length - 1, i + 1)]?.count || stages[i].count, onCountUpdate);
        },
      });

      triggersRef.current.push(trigger);
    });

    // Set initial state
    onStageChange(0);
    onCountUpdate(stages[0].count);

    return () => {
      triggersRef.current.forEach(t => t.kill());
      triggersRef.current = [];
    };
  }, [containerRef.current, stages.length]);
}

/**
 * Animate counter from one value to another using GSAP.
 * Kills any in-flight counter tween before starting a new one.
 */
let counterTween = null;
const counterObj = { value: 0 };

function animateCount(to, from, onUpdate) {
  if (counterTween) counterTween.kill();
  counterObj.value = from;
  counterTween = gsap.to(counterObj, {
    value: to,
    duration: 0.8,
    ease: 'expo.out',
    onUpdate: () => {
      onUpdate(Math.round(counterObj.value));
    },
    onComplete: () => { counterTween = null; },
  });
}
