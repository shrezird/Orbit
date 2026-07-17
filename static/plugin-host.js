
"use strict";

(function () {
  if (window.OrbitPlugin) return;


  const hookSlots = {};
  const registered = {};


  window.OrbitPlugin = {

    register(plugin) {
      if (!plugin || !plugin.id) {
        console.error("[OrbitPlugin] Plugin missing 'id'");
        return;
      }
      if (registered[plugin.id]) {
        console.warn("[OrbitPlugin] Plugin '" + plugin.id + "' already registered");
        return;
      }
      registered[plugin.id] = plugin;

      if (plugin.hooks) {
        for (const [slot, fn] of Object.entries(plugin.hooks)) {
          this.on(slot, fn, plugin.id);
        }
      }

      if (typeof plugin.onLoad === "function") {
        try {
          plugin.onLoad();
        } catch (e) {
          console.error("[OrbitPlugin] " + plugin.id + " onLoad error:", e);
        }
      }

      console.log("[OrbitPlugin] Registered '" + plugin.id + "'");
    },


    on(slot, callback, pluginId) {
      if (!hookSlots[slot]) hookSlots[slot] = [];
      hookSlots[slot].push({ callback, pluginId });
    },

    off(slot, pluginId) {
      if (!hookSlots[slot]) return;
      hookSlots[slot] = hookSlots[slot].filter(
        (h) => h.pluginId !== pluginId
      );
    },

    unregister(pluginId) {
      const plugin = registered[pluginId];
      if (plugin && typeof plugin.onUnload === "function") {
        try {
          plugin.onUnload();
        } catch (e) {
          console.error("[OrbitPlugin] " + pluginId + " onUnload error:", e);
        }
      }
      delete registered[pluginId];
      for (const slot of Object.keys(hookSlots)) {
        hookSlots[slot] = hookSlots[slot].filter(
          (h) => h.pluginId !== pluginId
        );
      }
    },


    emit(slot, ...args) {
      const handlers = hookSlots[slot] || [];
      const results = [];
      for (const { callback, pluginId } of handlers) {
        try {
          results.push(callback(...args));
        } catch (e) {
          console.error("[OrbitPlugin] " + pluginId + " error in '" + slot + "':", e);
        }
      }
      return results;
    },


    render(slot, ...args) {
      const elements = [];
      for (const el of this.emit(slot, ...args)) {
        if (el && el.nodeType) elements.push(el);
      }
      return elements;
    },


    async api(pluginId, method, ...args) {
      if (!window.pywebview || !window.pywebview.api) {
        throw new Error("Backend not ready");
      }
      let res;
      if (typeof window.pywebview.api.call_plugin_method === "function") {
        res = await window.pywebview.api.call_plugin_method(pluginId, method, args);
      } else {
        const fnName = "plugin_" + pluginId + "_" + method;
        if (typeof window.pywebview.api[fnName] !== "function") {
          throw new Error("Plugin method '" + fnName + "' not found on backend");
        }
        res = await window.pywebview.api[fnName](...args);
      }
      if (res && typeof res === "object" && res.error) {
        throw new Error(res.error);
      }
      return res;
    },


    getRegistered() {
      return Object.keys(registered);
    },

    async loadFrontend(pluginId) {
      if (registered[pluginId]) return true;
      if (!window.pywebview || !window.pywebview.api) return false;
      try {
        const scripts = await window.pywebview.api.get_plugin_frontend_scripts();
        const p = (scripts || []).find((s) => s.id === pluginId);
        if (!p) return false;
        injectScript(p);
        return true;
      } catch (e) {
        console.error("[OrbitPlugin] loadFrontend failed for '" + pluginId + "':", e);
        return false;
      }
    },
  };

  window.pluginApi = window.OrbitPlugin.api.bind(window.OrbitPlugin);


  function injectScript(p) {
    const esc = (window.CSS && CSS.escape) ? CSS.escape(p.id) : p.id;
    const prev = document.head.querySelector('script[data-plugin-id="' + esc + '"]');
    if (prev) prev.remove();
    const blob = new Blob(["(function () {\n", p.code, "\n})();"],
      { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const script = document.createElement("script");
    script.src = url;
    script.dataset.pluginId = p.id;
    script.onload = () => URL.revokeObjectURL(url);
    script.onerror = () => {
      console.error("[OrbitPlugin] Failed to load frontend script for '" + p.id + "'");
      URL.revokeObjectURL(url);
    };
    document.head.appendChild(script);
  }

  async function loadPluginScripts() {
    try {
      if (!window.pywebview || !window.pywebview.api) {
        setTimeout(loadPluginScripts, 200);
        return;
      }

      const plugins = await window.pywebview.api.get_plugin_frontend_scripts();
      if (!plugins || !plugins.length) return;

      for (const p of plugins) {
        try {
          injectScript(p);
        } catch (e) {
          console.error("[OrbitPlugin] Error loading plugin '" + p.id + "':", e);
        }
      }
    } catch (e) {
      console.error("[OrbitPlugin] Failed to fetch plugin scripts:", e);
    }
  }

  if (window.pywebview && window.pywebview.api) {
    loadPluginScripts();
  } else {
    window.addEventListener("pywebviewready", loadPluginScripts);
  }

  console.log("[OrbitPlugin] Host initialized");
})();
