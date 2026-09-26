# Sharing Auto-Pin

Use the post below with the [demo GIF](demo.gif) or [original video](demo.mp4).
The recording shows a newly created workspace appearing in **Pinned** automatically.

## Published links

- [Paseo Show and tell](https://github.com/getpaseo/paseo/discussions/5346)
- [Auto-Pin 0.4.0 release](https://github.com/stv1024/paseo-auto-pin/releases/tag/v0.4.0)
- [npm package](https://www.npmjs.com/package/paseo-auto-pin)
- [paseo.cafe submission](https://github.com/paseo-cafe/paseo-cafe/issues/228)
- [paseo.cafe registry PR](https://github.com/paseo-cafe/paseo-cafe/pull/253)

## Where to check feedback

Start here when checking community responses:

1. [Paseo Show and tell discussion #5346](https://github.com/getpaseo/paseo/discussions/5346):
   read comments and nested replies, and check reactions.
2. [Auto-Pin issues](https://github.com/stv1024/paseo-auto-pin/issues): check both
   open and closed issues, plus any pull request discussions.
3. [paseo.cafe submission #228](https://github.com/paseo-cafe/paseo-cafe/issues/228)
   and [registry PR #253](https://github.com/paseo-cafe/paseo-cafe/pull/253):
   read comments, reviews, and the submission timeline for admission updates.

Use GitHub's GraphQL API for the discussion, including `comments` and each
comment's `replies`; follow pagination when `hasNextPage` is true. GitHub CLI
can read the other sources:

```bash
gh api 'repos/stv1024/paseo-auto-pin/issues?state=all&per_page=100' --paginate
gh issue view 228 --repo paseo-cafe/paseo-cafe --comments
gh api repos/paseo-cafe/paseo-cafe/issues/228/timeline --paginate
gh pr view 253 --repo paseo-cafe/paseo-cafe --json state,mergedAt,mergedBy,comments,reviews
gh api repos/paseo-cafe/paseo-cafe/pulls/253/comments --paginate
```

For additional mentions, search GitHub issues and pull requests for
`"paseo-auto-pin"` and for `"auto-pin"` within `getpaseo/paseo` and
`paseo-cafe/paseo-cafe`. Search results supplement the direct checks; they do
not replace reading the known discussion and its replies.

Separate user experience reports and feature requests from author follow-ups,
bot messages, and registry administration. Record the check date and source
links; no feedback in these sources does not establish that nobody uses the
plugin or that no feedback exists elsewhere.

### Check on 2026-09-26 (Asia/Shanghai)

- **Official discussion:** 0 comments and 0 reactions.
- **Plugin repository:** the all-state issues endpoint returned no issues or
  pull requests.
- **Submission #228:** closed as completed on September 25. Its two comments
  are a Sayr bot task link and the author's request to fix the submission label;
  neither is user feedback. Maintainer `omercnet` added `plugin-submission`
  and edited the title before the automated registry PR was created.
- **Registry PR #253:** merged by `omercnet` on September 25 at 10:00:17 UTC
  (18:00:17 Asia/Shanghai), adding `registry/auto-pin.json`. Its two comments
  are automated: CodeRabbit skipped review because the PR author was a bot,
  and the registry scan reported GitHub source and npm 0.4.0 checks passed,
  with zero blocking or advisory findings. There were no submitted reviews
  or inline review comments.
- **Additional issue search:** `"paseo-auto-pin"` returned only submission #228.

No user bug reports, feature requests, or usage reports were found in the
checked sources. Registry admission has progressed successfully.

## Community post

**Auto-Pin for Paseo: keep new workspaces at the top, with rules for each project**

I made Auto-Pin because I kept manually pinning new Paseo workspaces and wanted
to automate that step.

It now has a default switch and three choices for each project: **Follow
default**, **Always**, or **Never**. For example, you can keep everyday work
pinned while leaving experiments out of the pinned section.

It runs on the daemon, so the panel can stay closed. Rules apply to newly
created workspaces, including worktrees. Existing pins stay as they are.

Install:

```bash
paseo plugin install npm:paseo-auto-pin@0.4.0
```

Requires Paseo 0.9.1–0.9.x.

GitHub: https://github.com/stv1024/paseo-auto-pin

I built this for my own workflow and would enjoy seeing it help someone else.
If you try it, which projects would you set to Always or Never?

## A short GIF

Aim for 10–15 seconds. Show the result clearly enough that it makes sense without
reading the post.

1. Prepare two small demo projects, such as **Everyday** and **Experiments**.
2. Open Auto-Pin. Set Everyday to **Always**, Experiments to **Never**.
3. Create a workspace in Everyday and pause briefly on its pinned position.
4. Create one in Experiments and show that it stays unpinned.
5. End with both visible in the sidebar.

Use fresh workspaces for each take; restoring an archived workspace does not
trigger Auto-Pin. For Git projects, new worktrees make this easy.

Keep the sidebar and the action in frame, enlarge text if needed, and hide
personal paths or unrelated conversations before recording. You do not need to
show installation, logs, or every setting.

The README currently uses `docs/demo.gif`, made from the September 24 recording.
It demonstrates automatic pinning; the longer project-rule sequence above is an
option for a future recording.

The GIF is cropped to the top-left 1280 × 850 area, resized to 960 × 638, and
encoded at 12 fps with a shared palette. Playback is slowed to 1.4 times the
original duration, with a 1.2-second hold on the final frame before looping.
It is about 227 KiB. The unmodified 3.2-second MP4 is kept as `docs/demo.mp4`.

Keep future GIFs a few megabytes if possible. A static screenshot with a link
to a short video is also fine.

## After posting

Respond to concrete workflow questions and note repeated requests. Useful early
feedback is whether people keep the plugin enabled, which exceptions they need,
and whether the default/override behavior is clear. There is no need to promise
a larger automation system before those patterns emerge.
