// the spec has no HAR yet, so `cy.replayHar()` lets the requests reach the server and the spec records its HAR
describe('Record the missing HAR of the spec', () => {
  it('reaches the server', () => {
    cy.replayHar();
    cy.visit('/');
    cy.window()
      .then(win => win.fetch('/api/random').then(res => res.json()))
      .its('value')
      .should('match', /^[\da-f-]{36}$/);
  });
});
