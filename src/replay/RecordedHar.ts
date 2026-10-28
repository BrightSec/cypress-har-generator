import type { HarTest } from '../network/TestTimeline.ts';
import type { Entry } from 'har-format';

export interface RecordedHar {
  entries: Entry[];
  // `log._tests`, empty for a HAR recorded without the tests
  tests: HarTest[];
}
