import { STABLE_STARTED_DATE_TIME } from '../constants.ts';
import type { Entry } from 'har-format';

// written in place of a time, as Playwright does when it omits timing
const NO_TIME = -1;

interface Message {
  time: number;
}

/**
 * An entry without the values that change from one run of the same spec to the next, such as times
 * and connection IDs, so a HAR saved with the `stable` option can be compared with an earlier one.
 */
export class StableEntry {
  constructor(private readonly entry: Entry) {}

  public toEntry(): Entry {
    const { timings, ...entry } = this.entry;
    const { comment } = timings;

    delete entry.connection;

    return {
      ...entry,
      startedDateTime: STABLE_STARTED_DATE_TIME,
      time: NO_TIME,
      timings: {
        send: NO_TIME,
        wait: NO_TIME,
        receive: NO_TIME,
        ...(comment === undefined ? {} : { comment })
      },
      ...this.messages('_webSocketMessages'),
      ...this.messages('_eventSourceMessages')
    };
  }

  private messages(
    field: '_webSocketMessages' | '_eventSourceMessages'
  ): Record<string, Message[]> {
    const messages: unknown = this.entry[field];

    return Array.isArray(messages)
      ? {
          [field]: messages.map(message => ({ ...message, time: NO_TIME }))
        }
      : {};
  }
}
