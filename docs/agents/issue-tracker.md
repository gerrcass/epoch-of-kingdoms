# Issue tracker: GitHub

Specs and tickets for this repo live as GitHub issues in `gerrcass/epoch-of-kingdoms`. Use the
`gh` CLI from the repo root.

## Conventions

- **Create**: `gh issue create --title "..." --body-file <file>` (write the body to
  `.scratch/` first; never inline a huge heredoc in a command).
- **Read**: `gh issue view <n> --comments`.
- **List open work**: `gh issue list --state open --json number,title,labels,body,assignees`.
- **Comment**: `gh issue comment <n> --body "..."`.
- **Label**: `gh issue edit <n> --add-label "ready-for-agent"`.
- **Close**: `gh issue close <n> --comment "Resolved by #<pr>."`.

Infer the repo from `git remote -v`; `gh` does this automatically inside the clone.

## Blocking edges

GitHub native issue dependencies are the canonical representation. For a ticket blocked by
issue `B`, with blocker database id `ID`:

```sh
gh api --method POST repos/gerrcass/epoch-of-kingdoms/issues/<child>/dependencies/blocked_by \
  -F issue_id=<ID>
```

`ID` is `gh api repos/gerrcass/epoch-of-kingdoms/issues/<B> --jq .id` (the numeric database
id, not the issue number). The frontier is every open ticket whose open-blocker count is zero.

## Pull requests as a request surface

**No.** PRs are delivery vehicles, not feature requests.
