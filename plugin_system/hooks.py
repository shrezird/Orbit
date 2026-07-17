import traceback


class HookRegistry:

    def __init__(self):
        self._hooks = {}


    def register(self, hook_name, callback, plugin_id, priority=100):
        self._hooks.setdefault(hook_name, []).append(
            (priority, callback, plugin_id)
        )
        self._hooks[hook_name].sort(key=lambda x: x[0])

    def unregister_all(self, plugin_id):
        for name in list(self._hooks):
            self._hooks[name] = [
                (p, cb, pid)
                for (p, cb, pid) in self._hooks[name]
                if pid != plugin_id
            ]
            if not self._hooks[name]:
                del self._hooks[name]


    def fire(self, hook_name, *args, **kwargs):
        results = []
        for _priority, cb, pid in self._hooks.get(hook_name, []):
            try:
                results.append(cb(*args, **kwargs))
            except Exception:
                traceback.print_exc()
                print(f"[hooks] Plugin '{pid}' error in '{hook_name}'")
        return results

    def fire_for(self, plugin_id, hook_name, *args, **kwargs):
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
