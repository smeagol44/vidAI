/** Explicit historical fixtures. Frozen hashes and migration tests must construct
 * the original RGB+range genotype, never regenerate their baselines from v8. */
import {createFounderGenome as currentFounder} from '../../founders';
import {createInitialWorld as currentWorld} from '../../world';
export function createFounderGenome(...args: Parameters<typeof currentFounder>) {
  return currentFounder(args[0], args[1], {...args[2], vision: 'legacy'});
}
export function createInitialWorld(...args: Parameters<typeof currentWorld>) {
  return currentWorld(args[0], args[1], args[2], args[3], args[4], 'legacy');
}
