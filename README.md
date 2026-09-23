# Auto-Pin for Paseo

Automatically pin new [Paseo](https://paseo.sh) workspaces, with exceptions for individual projects.

Keep everyday work near the top of your sidebar and leave experiments unpinned.
Auto-Pin runs in the background, even when its panel is closed.

## Install

Requires **Paseo 0.9.1–0.9.x** and Node.js/npm on the machine running the Paseo daemon.

```bash
paseo plugin install https://github.com/stv1024/paseo-auto-pin
```

Open **Auto-Pin** in the sidebar to adjust your settings. It starts with auto-pin
on for all new workspaces.

## Choose what gets pinned

The **Pin new workspaces by default** switch sets the behavior for projects
without an override. Each project has three choices:

| Rule | What happens when you create a workspace |
| --- | --- |
| **Follow default** | Uses the current default switch. |
| **Always** | Pins it, even when the default is off. |
| **Never** | Leaves it unpinned, even when the default is on. |

For example, set your main project to **Always**, experiments to **Never**, and
leave everything else on **Follow default**.

Projects appear automatically from Paseo. You can search by name or folder path.
Rules apply to new workspaces belonging to that project, including worktrees.

### A few things to know

- Changes save automatically and are shared by clients connected to the same daemon.
- Rules only affect workspaces created afterward. Existing pins stay as they are.
- Restoring an archived workspace does not pin it again.
- Auto-Pin never removes a pin. You can still pin or unpin workspaces yourself.
- **Always** and **Never** override the default switch. To pause the entire plugin,
  disable it in Paseo's plugin settings.

In the Command Center, use **Auto-Pin: Toggle Default** for a quick change, or
**Auto-Pin: Open Panel** to manage project rules.

## Update

For an installation from Git:

```bash
paseo plugin update auto-pin --check
paseo plugin update auto-pin
```

Updating from 0.3 keeps your existing on/off setting. Every project starts on
**Follow default** until you choose otherwise.

Auto-Pin **0.4.x** supports Paseo **0.9.1–0.9.x**.
For Paseo 0.8, use Auto-Pin 0.2.0; for Paseo 0.7, use 0.1.0.

## Need a hand?

If a new workspace is not pinned, check its project rule and the default switch.
If you just changed a setting on another device, press **Refresh** in the panel.

For errors or unexpected behavior, [open an issue](https://github.com/stv1024/paseo-auto-pin/issues).
Include your Paseo and Auto-Pin versions, the rule you selected, and what happened.
Logs are available with `paseo plugin logs auto-pin`; remove private paths before
sharing them.

Have a workflow this does not cover? Describe it in an issue. A concrete example
helps decide what to build next.

[What's changed](CHANGELOG.md) · [Development](docs/development.md) · [Community post and demo guide](docs/community.md)

## License

[MIT](LICENSE)