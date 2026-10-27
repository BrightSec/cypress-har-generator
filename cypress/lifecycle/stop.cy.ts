describe('Lifecycle', () => {
  afterEach(() => Cypress.stop());

  it('records a spec that stops the run', () => {
    cy.visit('/');
  });

  it('is skipped after the run stops', () => {
    cy.visit('/');
  });
});
