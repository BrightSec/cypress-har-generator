// `cypress.lifecycle.config.ts` writes the HAR of this spec before the run, listing its tests in another order
describe('Replay each test', () => {
  const fetchRandom = () =>
    cy.window().then(win => win.fetch('/api/random').then(res => res.json()));

  beforeEach(() => {
    cy.replayHar();
    cy.visit('/');
  });

  it('first', () => {
    fetchRandom().should('deep.equal', { value: 'first' });
  });

  it('second', () => {
    fetchRandom().should('deep.equal', { value: 'second' });
  });
});
