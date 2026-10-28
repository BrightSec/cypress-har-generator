import type { Protocol } from 'devtools-protocol';
import type { ProtocolMapping as ProtocolMappingApi } from 'devtools-protocol/types/protocol-mapping.js';

export type NetworkEvents = Pick<
  ProtocolMappingApi.Events,
  `Network.${string}` & keyof ProtocolMappingApi.Events
>;
export type NetworkEventParams<T extends keyof NetworkEvents> =
  NetworkEvents[T][0];

export type NetworkEvent = {
  params: NetworkEventParams<keyof NetworkEvents>;
  method: keyof NetworkEvents;
  sessionId?: string;
};

export interface Network {
  getResponseBody(
    requestId: string
  ): Promise<Protocol.Network.GetResponseBodyResponse>;

  getRequestBody(
    requestId: string
  ): Promise<Protocol.Network.GetRequestPostDataResponse>;

  /**
   * The frames that hold the given frame, from its parent up to the top frame of the target that sent the request.
   */
  getFrameAncestors(
    requestId: string,
    frameId: Protocol.Page.FrameId
  ): Promise<Protocol.Page.FrameId[]>;

  /**
   * Listens to the payloads the pages send as each test starts, through a function added to each page as it is attached.
   */
  onTestStarted(listener: (payload: string) => unknown): void;

  attachToTargets(listener: (event: NetworkEvent) => unknown): Promise<void>;

  detachFromTargets(): Promise<void>;
}
