"""Hook registry — plugins register callbacks, Orbit fires them.

Import pattern:  from plugin_system.hooks import hooks

Lifecycle hooks (no data mutation, pure notification):
    on_app_start()
    on_app_exit()
    on_board_open(board_id, board_name)
    on_board_close(board_id)

Data mutation hooks (can modify or veto via context dict):
    before_board_create(ctx)   ctx: {name, description} → plugin may modify
    after_board_create(board_id, name)
    before_board_update(ctx)   ctx: {board_id, fields} → plugin may modify fields
    after_board_update(board_id, fields, old_values)
    before_board_delete(ctx)   ctx: {board_id} → plugin may set ctx["veto"]=True
    after_board_delete(board_id)

    before_list_create(ctx)    ctx: {board_id, name} → plugin may modify name
    after_list_create(board_id, list_id)
    after_list_rename(list_id, name, old_name)
    before_list_delete(ctx)    ctx: {list_id} → plugin may set ctx["veto"]=True
    after_list_delete(list_id, board_id)
    before_list_move(ctx)      ctx: {list_id, new_index}
    after_list_move(list_id, new_index)

    before_card_create(ctx)    ctx: {list_id, title} → plugin may modify title
    after_card_create(card_id, title, list_id)
    before_card_update(ctx)    ctx: {card_id, fields} → plugin may modify fields
    after_card_update(card_id, fields, old_values)
    before_card_delete(ctx)    ctx: {card_id} → plugin may set ctx["veto"]=True
    after_card_delete(card_id, board_id)
    before_card_move(ctx)      ctx: {card_id, to_list_id, new_index}
    after_card_move(card_id, from_list_id, to_list_id, new_index)

    after_attachment_add(card_id, attachments_list)
    after_attachment_delete(attachment_id, card_id)
"""

import traceback


class HookRegistry:
    """A named list of callbacks. Lower priority runs first."""

    def __init__(self):
        self._hooks = {}


    def register(self, hook_name, callback, plugin_id, priority=100):
        """Register a callback for a hook. callback(ctx_or_args...)."""
        self._hooks.setdefault(hook_name, []).append(
            (priority, callback, plugin_id)
        )
        self._hooks[hook_name].sort(key=lambda x: x[0])

    def unregister_all(self, plugin_id):
        """Remove every hook registered by the given plugin."""
        for name in list(self._hooks):
            self._hooks[name] = [
                (p, cb, pid)
                for (p, cb, pid) in self._hooks[name]
                if pid != plugin_id
            ]
            if not self._hooks[name]:
                del self._hooks[name]


    def fire(self, hook_name, *args, **kwargs):
        """Fire all callbacks for a hook_name. Returns list of results.
        Each callback is called with (*args, **kwargs). Results are
        collected but no mutation-chain happens — use fire_ctx() for
        mutable context threading."""
        results = []
        for _priority, cb, pid in self._hooks.get(hook_name, []):
            try:
                results.append(cb(*args, **kwargs))
            except Exception:
                traceback.print_exc()
                print(f"[hooks] Plugin '{pid}' error in '{hook_name}'")
        return results

    def fire_for(self, plugin_id, hook_name, *args, **kwargs):
        """Fire a hook for ONE plugin's callbacks only — used to replay
        lifecycle events (e.g. on_app_start) for a plugin enabled at
        runtime, without re-firing every other plugin's handlers."""
        results = []
        for _priority, cb, pid in list(self._hooks.get(hook_name, [])):
            if pid != plugin_id:
                continue
            try:
                results.append(cb(*args, **kwargs))
            except Exception:
                traceback.print_exc()
                print(f"[hooks] Plugin '{pid}' error in '{hook_name}'")
        return results

    def fire_ctx(self, hook_name, ctx, *args, **kwargs):
        """Fire all callbacks, threading a mutable 'ctx' dict through.
        Each callback receives (ctx, *args, **kwargs) and may mutate ctx.
        If a callback sets ctx["veto"] = True, subsequent callbacks are
        skipped and the veto is signaled via the returned ctx."""
        for _priority, cb, pid in self._hooks.get(hook_name, []):
            try:
                cb(ctx, *args, **kwargs)
                if ctx.get("veto"):
                    break
            except Exception:
                traceback.print_exc()
                print(f"[hooks] Plugin '{pid}' error in '{hook_name}'")
        return ctx


hooks = HookRegistry()
