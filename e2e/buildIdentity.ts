import {existsSync} from 'node:fs';
import {BUILD_VERSION} from '../persistence';

// Assert the exact identity used by this build, including testing provenance.
// Local testing builds intentionally have an explicit unversioned fallback.
export const expectedBuildLabel = existsSync('testing-baseline.json')
  ? process.env.VITE_TESTING_RELEASE || 'TESTING · local development (unversioned)'
  : `v${BUILD_VERSION}`;
