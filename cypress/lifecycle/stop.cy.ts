describe('Experimental lifecycle', () => {
  afterEach(() => Cypress.stop());

  it('records a spec that stops the run', () => {
    cy.visit('/');
    // still in flight when the spec ends, so the HAR has it only if saving waits for idle
    cy.window().then(win => void win.fetch('/api/delay/3500'));
  });

  it('is skipped after the run stops', () => {
    cy.visit('/');
  });
});
