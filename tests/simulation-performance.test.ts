import assert from 'node:assert/strict';
import {test} from 'node:test';
import {pulseFrequency, performanceColor, ThroughputMeter, performanceDescription} from '../simulationPerformance';

test('pulse follows actual speed monotonically, with only a visual ceiling', () => {
  assert.equal(pulseFrequency(0), 0);
  assert.ok(pulseFrequency(1) > .4 && pulseFrequency(1) < .5);
  assert.ok(pulseFrequency(10) > 1.5 && pulseFrequency(10) < 1.6);
  assert.equal(pulseFrequency(50), 2.5);
  assert.equal(pulseFrequency(200), 2.5);
  for (let x = .1; x <= 50; x += .1) assert.ok(pulseFrequency(x) > pulseFrequency(x - .1));
  for (const x of [-1, NaN, Infinity]) assert.equal(pulseFrequency(x), 0);
});

test('MAX has exact six anchors, continuous segment weights and persistent white saturation', () => {
  for (const [speed, color] of [[0,'#FF0000'],[5,'#FF0000'],[15,'#FF8000'],[30,'#FFFF00'],[50,'#00FF00'],[65,'#00FFFF'],[75,'#FFFFFF'],[200,'#FFFFFF']] as const)
    assert.equal(performanceColor(speed, 'max'), color);
  const midpoint = performanceColor(57.5, 'max');
  assert.match(midpoint, /#00FF00, #00FFFF/);
  assert.ok(Math.abs(Number(midpoint.match(/ ([\d.]+)%/)![1]) - 50) < 1e-10);
  for (const speed of [5, 15, 30, 50, 65, 75]) {
    const low = performanceColor(speed - 1e-8, 'max'), high = performanceColor(speed + 1e-8, 'max');
    assert.ok(low === performanceColor(speed, 'max') || low.includes('color-mix'));
    assert.ok(high === performanceColor(speed, 'max') || high.includes('color-mix'));
  }
  assert.match(performanceColor(70, 'max'), /#00FFFF, #FFFFFF/);
});

test('finite achievement is relative to the request and cannot enter cyan or white', () => {
  assert.equal(performanceColor(1, 1), '#00FF00');
  assert.equal(performanceColor(10, 10), '#00FF00');
  assert.equal(performanceColor(50, 50), '#00FF00');
  assert.equal(performanceColor(1, 10), '#FF0000');
  assert.equal(performanceColor(3, 10), '#FF8000');
  assert.equal(performanceColor(6, 10), '#FFFF00');
  assert.equal(performanceColor(200, 10), '#00FF00');
  assert.match(performanceColor(5, 10), /#FF8000, #FFFF00/);
});

test('meter uses cumulative authoritative time, smooths noise and never estimates from the request', () => {
  const m = new ThroughputMeter(); m.configure(20, 1);
  m.observe(100, 0); assert.equal(m.read(0).speed, null);
  m.observe(100.25, 250); assert.equal(m.read(250).speed, 1);
  m.observe(102.75, 500); assert.ok(m.read(500).speed! > 1 && m.read(500).speed! < 10);
  const recent = m.read(500).speed;
  assert.equal(m.read(1000).speed, recent);
  assert.equal(m.read(1800).state, 'unavailable'); assert.equal(m.read(1800).speed, null);
  m.observe(1000, 2000); assert.equal(m.read(2000).speed, null, 'gap discards old smoothing/baseline');
  m.observe(1025, 2250); assert.equal(m.read(2250).speed, 100);
});

test('pause/resume, speed/world changes and reversed clocks cannot reuse previous throughput', () => {
  const m = new ThroughputMeter(); m.configure('max', 1); m.observe(0, 0); m.observe(25, 250);
  assert.equal(m.read(250).speed, 100);
  m.configure(0, 1); m.observe(999, 900); assert.equal(m.read(900).state, 'paused');
  m.configure(5, 1); assert.equal(m.read(1000).speed, null);
  m.observe(25, 1000); m.observe(26.25, 1250); assert.equal(m.read(1250).speed, 5);
  m.configure(5, 2); assert.equal(m.read(1250).speed, null);
  m.observe(50, 1300); m.observe(0, 1400); assert.equal(m.read(1400).speed, null);
  m.observe(1.25, 1650); assert.equal(m.read(1650).speed, 5);
  m.observe(0, 100); assert.equal(m.read(100).speed, null);
});

test('nonvisual descriptions distinguish missing data, finite achievement, MAX reference and pause', () => {
  const valid = {state: 'valid' as const, speed: 100, version: 1};
  assert.match(performanceDescription(valid, 'max'), /not an execution limit.*200.0%/);
  assert.match(performanceDescription({...valid, speed: 5}, 10), /50.0%/);
  assert.match(performanceDescription({...valid, speed: null, state: 'warming'}, 10), /measuring/);
  assert.match(performanceDescription(valid, 0), /paused/);
});
