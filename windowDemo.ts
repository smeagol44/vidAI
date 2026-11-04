import type {SelfTubes} from './selfTubes';
/** Session-only local caller UI. Never import into simulation, Worker or saves. */
export type DemoSide = 'L' | 'R';
export const WINDOW_DEMO_STATES = ['closed', 'outgoing', 'incoming', 'accepted', 'rejected', 'unavailable', 'suspended'] as const;
export type WindowDemoState = typeof WINDOW_DEMO_STATES[number];
export const WINDOW_DEMO_LABELS: Record<WindowDemoState, string> = {
  closed: 'Closed', outgoing: 'Outgoing offer', incoming: 'Incoming offer',
  accepted: 'Accepted', rejected: 'Rejected', unavailable: 'Unavailable', suspended: 'Signal lost — agreement retained',
};
export type WindowDemo = {name: string; available: Record<DemoSide, boolean>;
  call: null | {from: DemoSide; status: 'pending' | 'connected'};
  windows: Record<DemoSide, Record<number, WindowDemoState>>};
export type WindowDemoAction = {type: 'hydrate'; topology?: SelfTubes} | {type: 'name'; name: string} | {type: 'availability'; side: DemoSide}
  | {type: 'call'; side: DemoSide} | {type: 'cancel-call'; side: DemoSide} | {type: 'disconnect'; side: DemoSide}
  | {type: 'answer'; side: DemoSide; accept: boolean}
  | {type: 'window'; side: DemoSide; index: number; count: number}
  | {type: 'reject'; side: DemoSide; index: number} | {type: 'clear'; side: DemoSide; index: number} | {type: 'reset'};
export function createWindowDemo(): WindowDemo {
  return {name: '', available: {L: false, R: false}, call: null, windows: {L: {}, R: {}}};
}
export function oppositeDemoSide(side: DemoSide): DemoSide {return side === 'L' ? 'R' : 'L';}
export function oppositeDemoState(state: WindowDemoState): WindowDemoState {
  return state === 'outgoing' ? 'incoming' : state === 'incoming' ? 'outgoing' : state;
}
export function windowDemoState(demo: WindowDemo, side: DemoSide, index: number): WindowDemoState {
  return demo.windows[side][index] ?? 'closed';
}
export function demoHandDirection(side: DemoSide, state: WindowDemoState): 'left' | 'right' {
  const outward = side === 'L' ? 'left' : 'right';
  return state === 'incoming' ? (outward === 'left' ? 'right' : 'left') : outward;
}
export function suspendedDemoAgreements(demo: WindowDemo, side: DemoSide, count: number): number[] {
  return Object.entries(demo.windows[side]).filter(([index, state]) => state === 'accepted'
    && (Number(index) >= count || demo.call?.status !== 'connected'))
    .map(([index]) => Number(index)).sort((a, b) => a - b);
}
function setWindow(demo: WindowDemo, side: DemoSide, index: number, state: WindowDemoState): WindowDemo {
  const windows = {L: {...demo.windows.L}, R: {...demo.windows.R}};
  for (const target of [side, oppositeDemoSide(side)]) {
    if (state === 'closed') delete windows[target][index];
    else windows[target][index] = target === side ? state : oppositeDemoState(state);
  }
  return {...demo, windows};
}
function endCall(demo: WindowDemo): WindowDemo {
  // A lost side link suspends agreements, but cannot leave ghost pending offers.
  const windows: WindowDemo['windows'] = {L: {}, R: {}};
  for (const side of ['L', 'R'] as const) for (const [key, value] of Object.entries(demo.windows[side]))
    if (value === 'accepted') windows[side][Number(key)] = value;
  return {...demo, call: null, windows};
}
export function windowDemoReducer(demo: WindowDemo, action: WindowDemoAction): WindowDemo {
  if (action.type === 'hydrate') {
    const next = createWindowDemo(), topology = action.topology;
    next.name = demo.name; next.available = demo.available;
    if (topology) {
      if (topology.connected) {next.call = {from: 'L', status: 'connected'}; next.available = {L: true, R: true};}
      for (const index of topology.accepted) {next.windows.L[index] = 'accepted'; next.windows.R[index] = 'accepted';}
    }
    return next;
  }
  if (action.type === 'reset') return createWindowDemo();
  if (action.type === 'name') {
    const name = Array.from(action.name.replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, 32).join('');
    if (!name) return demo;
    return {...demo, name, available: demo.name ? demo.available : {L: true, R: true}};
  }
  if (action.type === 'availability') {
    if (!demo.name) return demo;
    const available = {...demo.available, [action.side]: !demo.available[action.side]};
    return {...(demo.call?.status === 'pending' ? endCall(demo) : demo), available};
  }
  if (action.type === 'call') {
    if (!demo.name || demo.call || !demo.available.L || !demo.available.R) return demo;
    return {...demo, call: {from: action.side, status: 'pending'}};
  }
  if (action.type === 'answer') {
    if (demo.call?.status !== 'pending' || action.side === demo.call.from) return demo;
    return action.accept ? {...demo, call: {...demo.call, status: 'connected'}} : endCall(demo);
  }
  if (action.type === 'cancel-call') return demo.call?.status === 'pending' && demo.call.from === action.side ? endCall(demo) : demo;
  if (action.type === 'disconnect') return demo.call?.status === 'connected' ? endCall(demo) : demo;
  if (!Number.isSafeInteger(action.index) || action.index < 0) return demo;
  if (action.type === 'clear') return setWindow(demo, action.side, action.index, 'closed');
  if (demo.call?.status !== 'connected') return demo;
  const current = windowDemoState(demo, action.side, action.index);
  if (action.type === 'reject') return current === 'incoming' ? setWindow(demo, action.side, action.index, 'rejected') : demo;
  if (action.index >= action.count || !Number.isSafeInteger(action.count) || action.count < 1) return demo;
  // Only the receiving endpoint accepts. A caller cannot accept its own offer.
  const next = current === 'incoming' ? 'accepted' : current === 'outgoing' || current === 'accepted' ? 'closed' : 'outgoing';
  return setWindow(demo, action.side, action.index, next);
}

export function physicalSelfTubes(demo: WindowDemo): SelfTubes {
  return {version: 1, connected: demo.call?.status === 'connected', accepted: Object.entries(demo.windows.L)
    .filter(([index, state]) => state === 'accepted' && demo.windows.R[Number(index)] === 'accepted')
    .map(([index]) => Number(index)).sort((a, b) => a - b)};
}
export function visibleWindowState(demo: WindowDemo, side: DemoSide, index: number): WindowDemoState {
  const stored = windowDemoState(demo, side, index);
  return demo.call?.status === 'connected' ? stored : stored === 'accepted' ? 'suspended' : 'unavailable';
}
