// Be sure to run `npm start` to start the server
// before running the tests below.

describe('Logging In - XHR Web Form', () => {
  // the HAR is saved as `cypress/hars/logging-in-xhr-web-form.cy.har`

  // normally sensitive information like username and password
  // should be passed via environment variables
  // https://on.cypress.io/env
  const username = 'jane.lane';
  const password = 'password123';

  context('XHR form submission', () => {
    beforeEach(() => cy.visit('/login'));

    it('successfully logs in', () => {
      // we can submit form using "cy.submit" command
      // https://on.cypress.io/submit
      cy.get('input[name=username]').type(username);
      cy.get('input[name=password]').type(password);
      cy.get('form').submit();

      // we should be in
      cy.url().should('include', '/dashboard');
      cy.get('h1').should('contain', 'jane.lane');
    });

    it('displays errors on login', () => {
      // we can observe both the UI and the network XHR call
      // during unsuccessful login attempt
      cy.intercept('POST', /login/).as('postLogin');

      // incorrect username on password
      cy.get('input[name=username]').type('jane.lae');
      cy.get('input[name=password]').type('password123{enter}');

      // we should always explicitly wait for
      // the response for this POST to come back
      // so our tests are not potentially flaky or brittle
      cy.wait('@postLogin');

      // we should have visible errors now
      cy.get('p.error')
        .should('be.visible')
        .and('contain', 'Username and/or password is incorrect');

      // and still be on the same URL
      cy.url().should('include', '/login');
    });

    it('can stub the XHR to force it to fail', () => {
      // instead of letting this XHR hit our backend we can instead
      // control its behavior programmatically by stubbing it
      //
      // simulate the server returning 503 with
      // empty JSON response body
      cy.intercept('POST', /login/, {
        statusCode: 503
      }).as('postLogin');

      // incorrect username on purpose
      cy.get('input[name=username]').type('jane.lae');
      cy.get('input[name=password]').type('password123{enter}');

      // we can even test that the correct request
      // body was sent in this XHR
      cy.wait('@postLogin').its('request.body').should('deep.eq', {
        username: 'jane.lae',
        password: 'password123'
      });

      // we should have visible errors now
      cy.get('p.error')
        .should('be.visible')
        .and('contain', 'An error occurred: 503');

      // and still be on the same URL
      cy.url().should('include', '/login');
    });

    it('redirects to /dashboard on success', () => {
      // we can submit form using "cy.submit" command
      // https://on.cypress.io/submit
      cy.get('input[name=username]').type(username);
      cy.get('input[name=password]').type(password);
      cy.get('form').submit();

      // we should be redirected to /dashboard
      cy.url().should('include', '/dashboard');
      cy.get('h1').should('contain', 'jane.lane');

      // and our cookie should be set to 'cypress-session-cookie'
      cy.getCookie('cypress-session-cookie').should('exist');
    });

    it('redirects on a stubbed XHR', () => {
      // When we stub the XHR we will no longer have a valid
      // cookie which means that on our Login.onSuccess callback
      // when we try to navigate to /dashboard we are unauthorized
      //
      // In this case we can simply stub out the Login.redirect method
      // and test that it's called with the right data.
      cy.window().then(win => {
        // stub out the Login.redirect method,
        // so it doesn't cause the browser to redirect
        cy.stub((win as any).Login, 'redirect').as('redirect');
      });

      // simulate the server returning 503 with
      // JSON response body
      cy.intercept('POST', /login/, {
        body: {
          // simulate a redirect to another page
          redirect: '/error'
        }
      }).as('postLogin');

      cy.get('input[name=username]').type(username);
      cy.get('input[name=password]').type(password);
      cy.get('form').submit();

      cy.wait('@postLogin');

      // we should not have any visible errors
      cy.get('p.error')
        .should('not.be.visible')
        .then(function () {
          // our redirect function should have been called with
          // the right arguments from the stubbed routed
          expect(this.redirect).to.be.calledWith('/error');
        });
    });
  });
});
