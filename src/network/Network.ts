import type { Protocol } from 'devtools-protocol';
import type ProtocolMappingApi from 'devtools-protocol/types/protocol-mapping';

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

  attachToTargets(listener: (event: NetworkEvent) => unknown): Promise<void>;

  detachFromTargets(): Promise<void>;
}
