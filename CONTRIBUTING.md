# How to contribute to cypress-har-generator

## Table of contents

- [Your First Contribution](#your-first-contribution)
- [Forks and Branches](#forks-and-branches)
  - [Start a feature branch](#start-a-feature-branch)
  - [Commit Message Format](#commit-message-format)
- [How to work on cypress-har-generator](#how-to-work-on-cypress-har-generator)
- [Installation](#installation)
  - [Build](#build)
  - [Tests](#tests)
    - [Running unit tests](#running-unit-tests)
    - [Running end-to-end tests](#running-end-to-end-tests)
  - [Linting](#linting)
  - [Formatting](#formatting)
  - [Creating publishable package](#creating-publishable-package)

## Your First Contribution

Working on your first Pull Request? You can learn how from this free series, [How to Contribute to an Open Source Project on GitHub](https://app.egghead.io/playlists/how-to-contribute-to-an-open-source-project-on-github).

## Forks and Branches

All contributions must be submitted as a [Pull Request (PR)](https://help.github.com/articles/about-pull-requests/) so you need to [fork this repo](https://help.github.com/articles/fork-a-repo/) on your GitHub account.

The main branch aka mainline is `master`, it contains the latest code, and it is undergoing major development. Any other branch is temporary and could be deleted. You can read more about the [Trank-based development](https://trunkbaseddevelopment.com/) to get a deep understanding of how it works.

> ⚡ All PRs must be against the `master` branch to be considered.

A valid PR must follow these points:

- Unit test is correctly implemented and covers the new scenario.
- If the code introduces a new feature, please add documentation or describe the feature in the PR description.
- The commit message follows [the conventional commit](#commit-message-format).
- The reviewer is assigned from the developers of the same project or code owners, possibly related to the task designed or a component affected.
- If you are going to work on new features or fix bugs or make significant architecture changes, create an issue before sending a PR, use [close keywords](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue) to link an issue, and PR.

The PR, which is **NOT** planned to be merged, has to be converted to draft PR.

To release a new version, you should issue the following commands:

```bash
git fetch origin
git checkout master
git merge --squash branch-name
git commit -m 'message'
```

Use `--squash`, to leave the history of commits in feature-branch and prevents the Git merge command from creating a merge commit.

### Start a feature branch

To create a feature branch you should issue the following commands:

```bash
git fetch
git checkout --no-track -b branch-name origin/master
```

Each branch name consists of a **type**, **ref,** and **subject**.

```
<type>[<DELIMITER>#<ref>]/<subject>
```

Where `type` - can accept one of the values are described [below](#commit-message-format), `ref` \- reference GitHub issues, Jira tickets, or other PRs.

e.g. `fix-#184/multiple-hosts-are-duplicated` or `fix/multiple-hosts-are-duplicated`

The `type` and `subject` are mandatory, the `ref` is optional.

### Commit Message Format

The commits must follow the [https://www.conventionalcommits.org/en/v1.0.0/](https://www.conventionalcommits.org/en/v1.0.0/) naming convention. Please make sure to read the full guideline.

Each commit message consists of a **header**, a **body**, and a **footer**.

```
<header>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

The `header` is mandatory and must conform to the following format:

```
<type>(<scope>): <short summary>
│       │             │
│       │             └─⫸ Summary in present tense. Not capitalized. No period at the end.
│       │
│       └─⫸ Commit Scope depends on ubiquitous language, e.g. scan, request-executor, identity, dast, auth-object, etc.
│
└─⫸ Commit Type: build|ci|docs|feat|fix|perf|refactor|test
```

The `header` should be limited to 100 symbols, make sure the first letter is not capitalized.

The `type` must be one of the following:

- **feat**: A new feature

- **fix**: A bug fix

- **docs**: Documentation only changes

- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)

- **refactor**: A code change that neither fixes a bug nor adds a feature

- **perf**: A code change that improves performance

- **test**: Adding missing or correcting existing tests

- **build**: Changes to the build process or auxiliary tools and libraries such as documentation generation

- **ci**: Changes to the CI/CD process

The `header` and `body` must use the imperative, present tense: "change" not "changed" nor "changes".

The `body` should include the motivation for the change and contrast this with previous behavior.

The `footer` can contain information about breaking changes and is also the place to reference GitHub issues (see details in [Linking a pull request to an issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue)), Jira tickets (see details in [Smart Commits](https://support.atlassian.com/bitbucket-cloud/docs/use-smart-commits/) guideline), and other PRs that this commit closes or is related to, i.e.:

```
feat(network): add entry statistics

add the amount of requests dispatched per entry

closes #666
```

The full description should not repeat the short description. If the short description is self-explanatory, leave only the `footer`:

```
feat(network): add the amount of requests per dispatched entry

closes #666
```

If the commit reverts a previous commit, it should begin with `revert:` , followed by the header of the reverted commit. In the body, it should say: `Reverts commit <hash>.`, where the hash is the SHA of the commit being reverted.

```
revert: add the amount of requests per dispatched entry

Reverts commit 0000000
```

## How to work on cypress-har-generator

To ensure consistency throughout the source code, keep these rules in mind as you are working:

- Inspect the format, syntax errors, deviations before pushing to the branch.
- Don't use transpilation mode of the compiler. You can use it only to debug.
- We love OOP and, whenever possible, prefer them over closures and functions.

> ⚡ We use [commitlint](https://github.com/conventional-changelog/commitlint#readme) and [lint-staged](https://github.com/okonet/lint-staged) through Git hooks in `.githooks`, which `npm install` enables for your clone, they will help you to follow these rules.

## Installation

To install all dependencies used by this project, issue this command in your terminal:

```bash
$ npm ci
```

### Build

The project can be built manually by issuing the following command:

```bash
npm run build
```

The build artifacts will be stored in the `dist` folder.

### Tests

#### Running unit tests

This project includes unit tests to verify the correctness of individual units of code, which are run using [Jest](https://jestjs.io/).

To execute all unit tests, use the command in the terminal:

```bash
$ npm t
```

#### Running end-to-end tests

This project includes end-to-end tests to ensure the functionality of the application.

To run all end-to-end tests using via [Cypress](https://www.cypress.io/), issue the following command in the terminal:

```bash
$ npm run e2e
```

If you wish to run a specific test case, you can specify the `--spec` option followed by the file path, for example:

```bash
$ npm run e2e -- --spec cypress/e2e/har-creator.cy.ts
```

### Linting

This project uses [ESLint](https://eslint.org) to ensure code consistency and quality.

> ⚡ Custom configurations can be set in the `eslint.config.mts` file located in the project's root directory.

To lint the entire project, run the command in the terminal:

```bash
$ npm run lint
```

### Formatting

This project utilizes [Prettier](https://prettier.io/) for code formatting.

> ⚡ Custom configurations can be set in the `.prettierrc` file located in the project's root directory.

To format the entire project, run the command in the terminal:

```bash
$ npm run format
```

### Creating publishable package

To publish a new package, use the following command in the terminal:

```bash
$ npm publish --tag ${tag}
```

> ⚡ It is important to have a clean git working directory before invoking a generator so that you can easily revert changes and re-invoke the generator with different inputs.

Note that this will publish the package to the npm registry (https://registry.npmjs.org). For publishing to the GitHub package registry, refer to [the guide](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#publishing-a-package).
