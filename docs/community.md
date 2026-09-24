# Sharing Auto-Pin

Use the post below with the [demo GIF](demo.gif) or [original video](demo.mp4).
The recording shows a newly created workspace appearing in **Pinned** automatically.

## Published links

- [Paseo Show and tell](https://github.com/getpaseo/paseo/discussions/5346)
- [Auto-Pin 0.4.0 release](https://github.com/stv1024/paseo-auto-pin/releases/tag/v0.4.0)
- [npm package](https://www.npmjs.com/package/paseo-auto-pin)
- [paseo.cafe submission](https://github.com/paseo-cafe/paseo-cafe/issues/228)

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
