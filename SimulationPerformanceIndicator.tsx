import React, {memo, useLayoutEffect, useRef} from 'react';
import {ThroughputMeter, performanceColor, performanceDescription, pulseFrequency} from './simulationPerformance';
import type {SimulationSpeed} from './simulationSpeed';

const NEUTRAL = '#94a3b8';

/** One retained animation. Rate changes preserve time; stopping holds the exact current frame. */
export const SimulationPerformanceIndicator = memo(function SimulationPerformanceIndicator({meter, requested, epoch}: {
  meter: ThroughputMeter; requested: SimulationSpeed; epoch: number;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const context = useRef({requested, epoch}); context.current = {requested, epoch};
  const refreshRef = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    const node = nodeRef.current!;
    node.style.backgroundColor = NEUTRAL;
    const pulse = node.animate([
      {opacity: 1, transform: 'scale(1)'},
      {opacity: 0, transform: 'scale(2.5)'},
    ], {duration: 1000, iterations: Infinity, easing: 'ease-out'});
    pulse.id = 'simulation-throughput-pulse'; pulse.pause(); pulse.currentTime = 0;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let previousKey = '', stopped = false, frequency = 0;
    const holdPulse = () => {
      const displayed = getComputedStyle(node);
      const opacity = displayed.opacity, transform = displayed.transform;
      const time = pulse.currentTime;
      pulse.pause(); if (time !== null) pulse.currentTime = time;
      // Firefox can round the exposed animation time differently from its sampled
      // frame. Retain that displayed frame while the same animation stays paused.
      node.style.setProperty('opacity', opacity, 'important');
      node.style.setProperty('transform', transform, 'important');
    };
    const hold = () => {
      holdPulse();
      // Freeze an interpolating color at its displayed value, not at its target.
      const color = getComputedStyle(node).backgroundColor;
      node.style.transition = 'none'; node.style.backgroundColor = color;
    };
    const refresh = () => {
      const {requested, epoch} = context.current;
      meter.configure(requested, epoch);
      const reading = meter.read(performance.now());
      const key = `${requested}/${epoch}/${reading.state}/${reading.version}/${motion.matches}`;
      if (key === previousKey) return;
      previousKey = key;
      const description = performanceDescription(reading, requested);
      node.setAttribute('aria-label', description);
      node.dataset.state = requested === 0 ? 'paused' : reading.state;
      node.dataset.actualSpeed = reading.speed === null ? '' : String(reading.speed);
      if (requested === 0 || reading.speed === null) {
        if (!stopped || requested === 0) hold();
        stopped = true;
        if (requested !== 0 && reading.state === 'unavailable') {
          node.style.transition = 'background-color 300ms linear'; node.style.backgroundColor = NEUTRAL;
        }
        return;
      }
      stopped = false;
      const nextFrequency = pulseFrequency(reading.speed);
      if (nextFrequency !== frequency) {pulse.updatePlaybackRate(nextFrequency); frequency = nextFrequency;}
      node.dataset.pulseFrequency = String(frequency);
      node.style.transition = 'background-color 300ms linear';
      node.style.backgroundColor = performanceColor(reading.speed, requested);
      if (motion.matches || frequency === 0) {
        holdPulse();
      } else {
        node.style.removeProperty('opacity'); node.style.removeProperty('transform');
        if (pulse.playState !== 'running') pulse.play();
      }
    };
    refreshRef.current = refresh;
    motion.addEventListener('change', refresh);
    const timer = setInterval(refresh, 250);
    refresh();
    return () => {clearInterval(timer); motion.removeEventListener('change', refresh); pulse.cancel(); refreshRef.current = () => {};};
  }, [meter]);
  useLayoutEffect(() => {refreshRef.current();}, [requested, epoch]);
  return <div ref={nodeRef} data-testid="simulation-activity" role="img" className="w-3 h-3 rounded-full shrink-0" />;
});
