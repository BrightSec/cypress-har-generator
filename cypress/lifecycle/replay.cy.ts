// `cypress.lifecycle.config.ts` writes the HAR of this spec before the run, so `cy.replayHar()` serves it
describe('Replay the HAR of the spec', () => {
  const fetchRandom = () =>
    cy.window().then(win => win.fetch('/api/random').then(res => res.json()));

  beforeEach(() => {
    cy.replayHar();
    cy.visit('/');
  });

  it('serves the first recorded response', () => {
    fetchRandom().should('deep.equal', { value: 'first' });
  });

  it('goes on from where the previous test stopped', () => {
    fetchRandom().should('deep.equal', { value: 'second' });
  });
});
