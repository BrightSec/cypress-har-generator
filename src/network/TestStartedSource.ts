export interface TestStartedSource {
  /**
   * Listens to the payloads the pages send as each test starts, through a function added to each page as it is attached.
   */
  onTestStarted(listener: (payload: string) => unknown): void;

  offTestStarted(): void;
}
