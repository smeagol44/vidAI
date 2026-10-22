import {writeFileSync} from 'node:fs';
import {isolatedIntegrationControl} from '../integrationControl';
writeFileSync('docs/experiments/prism-integration-isolated-v1.json',JSON.stringify(isolatedIntegrationControl(),null,2)+'\n');
