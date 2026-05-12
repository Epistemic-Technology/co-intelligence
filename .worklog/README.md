# worklog

This directory is managed by `worklog`. Each event (a commit, a
Claude Code session, a manual note) lives as a markdown file sharded
by month. Reviews under `reviews/` are generated from those events.

## What to commit

Commit the entire `.worklog/` tree. Event files are designed to merge
cleanly: each file's name embeds a timestamp and source id, so two
collaborators capturing in parallel will never write the same path.

## Hooks

`worklog init` installed:

- `.git/hooks/post-commit` — calls `worklog capture-commit` in the
  background for each commit.
- `.claude/settings.json` — registers a SessionEnd hook that runs
  `.worklog/bin/capture-session`. **Claude Code will prompt every
  collaborator to approve this hook on first session after a config
  change** — this is expected.

If you skip a session or commit (hook disabled, hard crash, fresh
clone), `worklog sync` walks the same sources and writes anything
missing.

## API key

LLM summaries call the Anthropic API. Set `ANTHROPIC_API_KEY` in your
shell, or override via a user-level overlay at
`~/.config/worklog/config.yml`. Without a key, events are still captured
using deterministic fallback summaries; run `worklog resummarize`
later to fill them in.
