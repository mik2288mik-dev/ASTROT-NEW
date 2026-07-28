# Release and Git guide

1. Fetch and fast-forward `main` before work.
2. Preserve unrelated modifications and untracked local tooling directories.
3. Inspect the final path-scoped diff; stage only the requested files.
4. Commit one focused change with a descriptive message.
5. If the user asks to publish directly to `main`, push with `git push origin main:main`.
6. Verify the same SHA through `HEAD`, `origin/main`, and `git ls-remote origin refs/heads/main`.

Creating a PR, merging, or checking a production deployment is an external action: do it only when the user explicitly requests it.
