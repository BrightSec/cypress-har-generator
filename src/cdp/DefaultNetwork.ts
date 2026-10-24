import type { Network, NetworkEvent } from '../network';
import { ErrorUtils } from '../utils/ErrorUtils';
import type { Logger } from '../utils/Logger';
import {
  TARGET_OR_BROWSER_CLOSED,
  UNABLE_TO_ATTACH_TO_TARGET
} from './messages';
import type { NetworkOptions } from './NetworkOptions';
import type { Client, EventMessage } from 'chrome-remote-interface';
import type Protocol from 'devtools-protocol';

export class DefaultNetwork implements Network {
  private readonly DOMAIN = 'Network';
  private readonly ALLOWED_TARGETS = new Set([
    'service_worker',
    'page',
    'worker',
    'background_page',
    'webview',
    'shared_worker'
  ]);

  private listener?: (event: NetworkEvent) => unknown;
  private readonly sessions = new Map<string, string | undefined>();

  constructor(
    private readonly cdp: Client,
    private readonly logger: Logger,
    private readonly options?: NetworkOptions
  ) {}

  public async attachToTargets(
    listener: (event: NetworkEvent) => unknown
  ): Promise<void> {
    this.listener = listener;

    this.cdp.on('event', this.networkEventListener);
    this.cdp.on('Target.attachedToTarget', this.attachedToTargetListener);
    this.cdp.on('Network.requestWillBeSent', this.sessionListener);
    this.cdp.on('Network.webSocketCreated', this.sessionListener);
    await this.ignoreCertificateError();
    await this.recursivelyAttachToTargets({ type: 'browser' });
  }

  public async detachFromTargets(): Promise<void> {
    if (this.listener) {
      this.cdp.off('event', this.networkEventListener);
      this.cdp.off('Security.certificateError', this.certificateErrorListener);
      this.cdp.off('Target.attachedToTarget', this.attachedToTargetListener);
      this.cdp.off('Network.requestWillBeSent', this.sessionListener);
      this.cdp.off('Network.webSocketCreated', this.sessionListener);
      delete this.listener;
    }

    try {
      await Promise.all([
        this.cdp.send('Security.disable'),
        this.enableAutoAttach(false)
      ]);
    } catch (e) {
      // ADHOC: handle any unforeseen issues while detaching from targets.
      this.logger.debug(`Unexpected error while detaching from targets: ${e}`);
    }

    this.sessions.clear();
  }

  public getRequestBody(
    requestId: string
  ): Promise<Protocol.Network.GetRequestPostDataResponse> {
    return this.cdp.send(
      'Network.getRequestPostData',
      {
        requestId
      },
      this.sessions.get(requestId)
    );
  }

  public getResponseBody(
    requestId: string
  ): Promise<Protocol.Network.GetResponseBodyResponse> {
    return this.cdp.send(
      'Network.getResponseBody',
      {
        requestId
      },
      this.sessions.get(requestId)
    );
  }

  private async ignoreCertificateError(): Promise<void> {
    this.cdp.on('Security.certificateError', this.certificateErrorListener);
    try {
      await this.cdp.send('Security.enable');
      await this.cdp.send('Security.setOverrideCertificateErrors', {
        override: true
      });
    } catch (e) {
      // ADHOC: The CDP protocol may not support the Security domain.
      this.logger.debug(
        ErrorUtils.isError(e) ? e.message : `Something went wrong: ${e}`
      );
    }
  }

  private networkEventListener = (eventMessage: EventMessage) => {
    if (this.matchNetworkEvents(eventMessage)) {
      setImmediate(() => this.listener?.(eventMessage));
    }
  };

  private certificateErrorListener = ({
    eventId
  }: Protocol.Security.CertificateErrorEvent) =>
    this.cdp.send('Security.handleCertificateError', {
      eventId,
      action: 'continue'
    });

  private matchNetworkEvents(
    message: Pick<EventMessage, 'method'>
  ): message is NetworkEvent {
    const [domain]: string[] = message.method.split('.');

    return domain === this.DOMAIN;
  }

  private async recursivelyAttachToTargets(options: {
    sessionId?: string;
    type: string;
  }): Promise<void> {
    await Promise.all([
      this.enableAutoAttach(true, options.sessionId),
      this.ALLOWED_TARGETS.has(options.type)
        ? this.trackNetworkEvents(options.sessionId)
        : undefined
    ]);
  }

  private enableAutoAttach(
    autoAttach: boolean,
    sessionId?: string
  ): Promise<void> {
    return this.cdp.send(
      'Target.setAutoAttach',
      {
        autoAttach,
        flatten: true,
        waitForDebuggerOnStart: true
      },
      sessionId
    );
  }

  private sessionListener = (
    {
      requestId
    }:
      | Protocol.Network.RequestWillBeSentEvent
      | Protocol.Network.WebSocketCreatedEvent,
    sessionId?: string
  ) => {
    this.sessions.set(requestId, sessionId);
    this.logger.debug(
      `Session ${sessionId ?? 'N/A'} associated with request: ${requestId}`
    );
  };

  private attachedToTargetListener = async (
    { sessionId, targetInfo }: Protocol.Target.AttachedToTargetEvent,
    parentSessionId?: string
  ): Promise<void> => {
    try {
      // Chrome also attaches a service worker under each page it controls, and that session is the one tracked
      if (!parentSessionId && targetInfo.type === 'service_worker') {
        await this.releaseTarget(sessionId);

        return;
      }

      // a paused target answers some commands only once it runs
      await Promise.all([
        this.recursivelyAttachToTargets({
          sessionId,
          type: targetInfo.type
        }),
        this.cdp.send('Runtime.runIfWaitingForDebugger', undefined, sessionId)
      ]);
    } catch (e) {
      if (this.targetClosedError(e)) {
        this.logger.debug(TARGET_OR_BROWSER_CLOSED);

        return;
      }

      const stack = ErrorUtils.isError(e) ? e.stack : e;

      this.logger.debug(
        `We encountered an issue while initializing the target for the session: ${sessionId}.`
      );
      this.logger.debug(
        `The information about the target is as follows: ${JSON.stringify(
          targetInfo
        )}`
      );
      this.logger.warn(`${UNABLE_TO_ATTACH_TO_TARGET}\n${stack}`);
    }
  };

  private async releaseTarget(sessionId: string): Promise<void> {
    await this.cdp.send(
      'Runtime.runIfWaitingForDebugger',
      undefined,
      sessionId
    );
    await this.cdp.send('Target.detachFromTarget', { sessionId });
  }

  private async trackNetworkEvents(sessionId?: string): Promise<void> {
    try {
      await Promise.all([
        this.cdp.send('Network.enable', this.options ?? {}, sessionId),
        this.cdp.send(
          'Network.setCacheDisabled',
          {
            cacheDisabled: true
          },
          sessionId
        )
      ]);
    } catch (e) {
      if (this.targetClosedError(e)) {
        this.logger.debug(TARGET_OR_BROWSER_CLOSED);

        return;
      }

      throw e;
    }
  }

  private targetClosedError(e: unknown): e is Error {
    return (
      ErrorUtils.isError(e) &&
      (e.message.includes('Target closed') ||
        e.message.includes('Session closed') ||
        e.message.includes('Session with given id not found') ||
        e.message.includes('No session with given id'))
    );
  }
}
