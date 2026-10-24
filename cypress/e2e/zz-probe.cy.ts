describe('probe', () => {
  it('records and waits', () => {
    cy.recordHar();
    cy.visit('/');
    cy.task('fs:tmpdir').then(() =>
      cy.writeFile(Cypress.env('probe_flag'), 'ready')
    );
    cy.wait(60000);
  });
});
