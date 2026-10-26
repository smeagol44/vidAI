# VIDA 2D — GitHub Project Status bridge

**Scope:** only `smeagol44/vidAI`, personal [Project #1](https://github.com/users/smeagol44/projects/1/views/1). Tracked in [#75](https://github.com/smeagol44/vidAI/issues/75). The native Project Status field controls the board columns. This bridge changes that actual field; source issue text alone does not.

## Once-only owner setup

1. Create a GitHub **personal access token (classic)** at **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**, with only the `project` scope for this personal Project. A private-repository workflow might also need `repo`; VIDA 2D's repository is public. Use a reasonable short expiry and rotate when needed. Treat this token as sensitive account-wide Projects authority.
2. In `smeagol44/vidAI`, go to **Settings → Secrets and variables → Actions → New repository secret**.
3. Set the secret name to exactly `VIDA_PROJECT_TOKEN`, with the new token as its value. **Never paste the token into a GitHub issue, PR, commit, chat or logs.**
4. Use [issue #59](https://github.com/smeagol44/vidAI/issues/59) to test with an owner-authored comment consisting only of `/vida status in-progress`.
5. Verify the **VIDA Project Status** GitHub Actions run and inspect the actual Project Status field. Repeat on open draft [PR #72](https://github.com/smeagol44/vidAI/pull/72). Only after successful, independently observed updates should #75 be closed.

The repository's automatic intake and closed/merged → Done workflows continue to operate separately. The bridge cannot activate without the secret. The normal `GITHUB_TOKEN` is repository-scoped and **cannot** write personal Projects fields.

## Operating the bridge

At the start of substantive discussion, experimentation or implementation on an issue, an allowlisted contributor's comment moves it to **In progress**, without waiting for coding. Valid one-line commands:

| Comment | Actual Project Status |
| --- | --- |
| `/vida status backlog` | Backlog |
| `/vida status needs-decision` | Needs decision |
| `/vida status ready` | Ready |
| `/vida status in-progress` | In progress |
| `/vida status in-review` | In review |
| `/vida status testing` | Testing |
| `/vida status done` | Done |

Only comments authored by GitHub users `smeagol44` or `hernansgarro` on `smeagol44/vidAI` run the command (case-insensitive login matching). Both issues and PRs work because GitHub sends their top-level comments through `issue_comment`. The command must be the entire comment, beginning `/vida status `. Closed items can be marked Done only; open items cannot be marked Done without completing and closing/merging them. Existing GitHub built-in workflows should handle Done and reopened Backlog without an explicit command.

## Contributor ChatGPT connection and activation

- Contribution fork: https://github.com/hernansgarro/vidAI. Shared issues and submitted PRs belong in upstream `smeagol44/vidAI`; do not duplicate the backlog in the fork. Full project instructions: [Contributor workflow](CONTRIBUTOR_WORKFLOW.md).
- ChatGPT acts through the GitHub account/app permissions behind its connection. The status bridge checks the actual GitHub comment author, not the name typed into a comment or prompt. The contributor must connect his own GitHub account; a comment posted as a different bot/shared identity is not authorized by this account allowlist.
- Public upstream issues can be read, created and commented on without upstream code-write access, subject to GitHub interaction policies and the connection's capabilities. The existing upstream intake handles new issues/PRs. Project Write access is optional for direct board editing and does not grant repository access; it is not required for these comment commands.
- Authorization is checked in **both** `.github/workflows/project-status.yml` and `scripts/project-status-bridge.mjs`. Update both through a reviewed main-based PR, keep their account sets identical and run `node --test tests/project-status-bridge.test.mjs`. Never remove author/repository checks or accept arbitrary requested usernames.
- This change is inactive until it lands on upstream `main`; a successful PR test is not a live permission grant. After merge, `hernansgarro` or his GitHub-connected ChatGPT must post an exact status command on a real active issue/PR, then verify the **VIDA Project Status** Action and native field readback. Record the actual author, comment/run URL and observed status in #105. Do not impersonate the contributor or substitute an owner-authored command for this verification.
- Reuse the existing owner-managed `VIDA_PROJECT_TOKEN` secret. Do not share it, copy it to the fork, or grant upstream code-write/merge privileges merely to operate this bridge. Removing an account later requires changing both checks; Project membership alone does not control command access.

**ChatGPT GitHub connector:** `mcp__GitHub__add_comment_to_issue` supports an issue/PR number. Leave a one-line command, then verify Actions success and the project's returned field value. Avoid claiming success on just writing the command. It is a delegated GitHub Action, not a new direct Projects API permission granted to ChatGPT.

**Security:** Action code comes from trusted default-branch `main`, not a PR branch. The comment's real GitHub author must be allowlisted in both checks; status names and target repo/project remain restricted. The dedicated project-scoped token is stored as an Actions secret and is never stored in source. GitHub Actions logs include the requested outcome but not the token. Update #57 with blocked/pending synchronization when this workflow cannot run.

**Limitations:** GitHub Projects API does not automatically deduce the start of work from an arbitrary discussion. We intentionally emit one explicit status command when an issue becomes active. This bridge currently edits **Status only**; Priority, Track, Environment and Target cycle still require a Projects UI/API integration if their values need changing.
