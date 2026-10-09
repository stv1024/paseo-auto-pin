Auto-Pin pins each new workspace as soon as Paseo creates it, so it appears in the **Pinned** section of the sidebar. It runs on the daemon, so it also works when no app is open and when the Auto-Pin panel is closed.

**Pin new workspaces by default** is the global switch. It starts on. Each project can override it:

- **Follow default** uses the switch.
- **Always** pins new workspaces in that project, even when the switch is off.
- **Never** leaves them unpinned, even when the switch is on.

Rules apply to new workspaces in a project, worktrees included. Set them in the Auto-Pin panel, which lists your Paseo projects with search. From the Command Center you can also toggle the default, or set the rule for the current workspace's project without opening the panel.

Auto-Pin only acts when a workspace is created. Existing workspaces are unchanged, restoring an archived workspace does not pin it again, and the plugin never unpins anything. You can still pin and unpin workspaces yourself. To pause it completely, disable the plugin.

The switch and project rules are stored in `plugin-data/auto-pin.json` in the Paseo home directory and are shared by every client connected to that daemon. To pin a workspace, the plugin opens a short connection to the daemon endpoint configured in Paseo's `config.json`. If that endpoint is not reachable from the daemon process, the pin fails and the error appears in the plugin log. The plugin makes no other network connections.

On Paseo 0.9.2 and later, a new pin can briefly disappear from the sidebar when the workspace starts with an agent. The daemon keeps the pin, and the row returns on the next sidebar update.
