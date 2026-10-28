// `cypress.failed-tests.config.ts` keeps only the entries of the first try, which fails
describe('Failed tests only', () => {
  const fetchProducts = (attempt: number) =>
    cy.window().then(win => win.fetch(`/api/products?attempt=${attempt}`));

  it('passes', () => {
    cy.visit('/pages/fetch');
    cy.window().then(win => win.fetch('/api/users'));
  });

  it('passes on the second try', { retries: { runMode: 1 } }, () => {
    const attempt: number = Cypress.currentRetry + 1;

    cy.visit('/');
    fetchProducts(attempt).then(() => {
      if (attempt === 1) {
        throw new Error('fails on the first try');
      }
    });
  });
});
