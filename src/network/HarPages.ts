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
    this.refs ??= this.createRefs();

    return this.refs.get(loaderId);
  }

  public toArray({
    startedDateTime
  }: { startedDateTime?: string } = {}): Page[] {
    return this.pageDocuments().map(
      ({ loaderId, startedAt, url }: HarDocument): Page => ({
        startedDateTime: startedDateTime ?? new Date(startedAt).toISOString(),
        id: this.idOf(loaderId) as string,
        // DevTools titles a page with its URL, as the HAR keeps no DOM to read the title from
        title: url,
        pageTimings: {}
      })
    );
  }

  private createRefs(): Map<LoaderId, string> {
    const ids = new Map<LoaderId, string>(
      this.pageDocuments().map(
        ({ loaderId }: HarDocument, index: number): [LoaderId, string] => [
          loaderId,
          `page_${index + 1}`
        ]
      )
    );
    const refs = new Map<LoaderId, string>();

    for (const loaderId of this.documents.keys()) {
      const id: string | undefined = ids.get(this.pageOf(loaderId));

      if (id) {
        refs.set(loaderId, id);
      }
    }

    return refs;
  }

  private pageDocuments(): HarDocument[] {
    return [...this.documents.values()]
      .filter(({ loaderId }: HarDocument): boolean => !this.parentOf(loaderId))
      .sort(
        (a: HarDocument, b: HarDocument): number => a.startedAt - b.startedAt
      );
  }

  // follows the parents up, which ends at a page since a parent always sits in a frame above
  private pageOf(loaderId: LoaderId): LoaderId {
    const parent: LoaderId | undefined = this.parentOf(loaderId);

    return parent ? this.pageOf(parent) : loaderId;
  }

  // the document of the nearest recorded frame above, which was the one loaded there when this document started
  private parentOf(loaderId: LoaderId): LoaderId | undefined {
    const { ancestors, startedAt } = this.documents.get(
      loaderId
    ) as HarDocument;

    for (const frameId of ancestors) {
      const loaded: HarDocument[] = [...this.documents.values()]
        .filter((x: HarDocument): boolean => x.frameId === frameId)
        .sort(
          (a: HarDocument, b: HarDocument): number => b.startedAt - a.startedAt
        );
      const parent: HarDocument | undefined =
        loaded.find((x: HarDocument): boolean => x.startedAt <= startedAt) ??
        loaded.at(-1);

      if (parent) {
        return parent.loaderId;
      }
    }

    return undefined;
  }
}
