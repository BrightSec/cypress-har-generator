describe('Lifecycle in a subfolder', () => {
  it('records a spec named like one in the parent folder', () => {
    cy.visit('/pages/fetch');
  });
});
