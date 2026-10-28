// `cypress.failed-tests.config.ts` writes no HAR for this spec, as no test fails
describe('Passed tests', () => {
  it('passes', () => {
    cy.visit('/pages/fetch');
    cy.window().then(win => win.fetch('/api/users'));
  });
});
