import { StartOrder } from './StartOrder.ts';
import type { Page } from 'har-format';
import type { Protocol } from 'devtools-protocol';

type LoaderId = Protocol.Network.LoaderId;

export interface HarDocument {
  loaderId: LoaderId;
  frameId: Protocol.Page.FrameId;
  // from the parent up to the top frame
  ancestors: Protocol.Page.FrameId[];
  startedAt: number;
  url: string;
}

/**
 * The pages of a HAR: the documents loaded into the topmost recorded frame of each tab, as Chrome DevTools exports them,
 * so the documents of the iframes inside a page belong to that page.
 */
export class HarPages {
  private readonly documents = new Map<LoaderId, HarDocument>();
  // the hop of a redirected navigation that started last, whose URL titles the page
  private readonly lastHops = new Map<LoaderId, number>();
  // the page ID of each document, in the order the pages started, so the same run gives the same IDs
  private refs?: Map<LoaderId, string>;

  public add(document: HarDocument): void {
    const known: HarDocument | undefined = this.documents.get(
      document.loaderId
    );
    const lastHop: number = this.lastHops.get(document.loaderId) ?? -Infinity;

    delete this.refs;
    this.documents.set(document.loaderId, {
      ...(document.startedAt >= lastHop ? document : (known ?? document)),
      startedAt: Math.min(document.startedAt, known?.startedAt ?? Infinity)
    });
    this.lastHops.set(document.loaderId, Math.max(lastHop, document.startedAt));
  }

  /**
   * The ID of the page holding the document loaded by the given loader.
   */
  public idOf(loaderId: LoaderId): string | undefined {
    return this.getRefs().get(loaderId);
  }

  public toArray({
    startedDateTime
  }: { startedDateTime?: string } = {}): Page[] {
    const refs: Map<LoaderId, string> = this.getRefs();

    return this.pageDocuments(this.findParents()).map(
      ({ loaderId, startedAt, url }: HarDocument): Page => ({
        startedDateTime: startedDateTime ?? new Date(startedAt).toISOString(),
        id: refs.get(loaderId) as string,
        // DevTools titles a page with its URL, as the HAR keeps no DOM to read the title from
        title: url,
        pageTimings: {}
      })
    );
  }

  private getRefs(): Map<LoaderId, string> {
    this.refs ??= this.createRefs();

    return this.refs;
  }

  private createRefs(): Map<LoaderId, string> {
    const parents: Map<LoaderId, LoaderId> = this.findParents();
    const refs = new Map<LoaderId, string>(
      this.pageDocuments(parents).map(
        ({ loaderId }: HarDocument, index: number): [LoaderId, string] => [
          loaderId,
          `page_${index + 1}`
        ]
      )
    );

    for (const loaderId of this.documents.keys()) {
      let page: LoaderId = loaderId;

      // a parent always sits in a frame above, so the walk ends at a page
      while (parents.has(page)) {
        page = parents.get(page) as LoaderId;
      }

      refs.set(loaderId, refs.get(page) as string);
    }

    return refs;
  }

  private pageDocuments(parents: Map<LoaderId, LoaderId>): HarDocument[] {
    return [...this.documents.values()]
      .filter(({ loaderId }: HarDocument): boolean => !parents.has(loaderId))
      .sort(
        (a: HarDocument, b: HarDocument): number => a.startedAt - b.startedAt
      );
  }

  // the parent of a document is the one of the nearest recorded frame above, which was loaded there when the document started
  private findParents(): Map<LoaderId, LoaderId> {
    const byFrame = new Map<Protocol.Page.FrameId, StartOrder<HarDocument>>();

    for (const document of this.documents.values()) {
      const loaded: StartOrder<HarDocument> | undefined = byFrame.get(
        document.frameId
      );

      if (loaded) {
        loaded.insert(document);
      } else {
        byFrame.set(document.frameId, new StartOrder([document]));
      }
    }

    const parents = new Map<LoaderId, LoaderId>();

    for (const { loaderId, ancestors, startedAt } of this.documents.values()) {
      const loaded: StartOrder<HarDocument> | undefined = ancestors
        .map((frameId: Protocol.Page.FrameId) => byFrame.get(frameId))
        .find(Boolean);

      if (loaded) {
        parents.set(loaderId, this.loadedAt(loaded, startedAt).loaderId);
      }
    }

    return parents;
  }

  // the last of the documents that started by the given time, or the first one when none did
  private loadedAt(loaded: StartOrder<HarDocument>, time: number): HarDocument {
    return loaded.items[Math.max(loaded.indexAt(time), 0)];
  }
}
