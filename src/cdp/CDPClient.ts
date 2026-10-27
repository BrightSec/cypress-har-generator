import type { Client } from 'chrome-remote-interface';
import type { EventEmitter } from 'node:events';

// the client extends `EventEmitter` at runtime, which `@types/chrome-remote-interface` leaves out
export type CDPClient = Client & EventEmitter;
