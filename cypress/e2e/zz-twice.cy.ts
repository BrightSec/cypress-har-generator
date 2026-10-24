describe('probe twice', () => {
  it('records twice and saves', () => {
    cy.recordHar();
    cy.visit('/');
    cy.recordHar();
    cy.visit('/');
    cy.saveHar({ fileName: 'probe-twice.har' });
  });
});
