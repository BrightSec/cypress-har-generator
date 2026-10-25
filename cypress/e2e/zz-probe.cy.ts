describe('probe large', () => {
  beforeEach(() => cy.visit('/'));

  Cypress._.times(10, i =>
    it(`large ${i}`, () => {
      cy.recordHar({
        maxTotalBufferSize: 256 * 1024 ** 2,
        maxResourceBufferSize: 256 * 1024 ** 2
      });

      cy.get('a[href$=large-content]').click();

      cy.saveHar({
        waitForIdle: true,
        maxWaitDuration: 50000
      });

      cy.match(
        /(\/api\/keys)(\n|.)*?("size":\s*150019900)(\n|.)*?("text":\s*"(?!Request content was evicted from inspector cache"))/
      ).should('be.true');
    })
  );
});
