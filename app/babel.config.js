module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // DO NOT add 'react-native-worklets/plugin' here — it causes the
    // "Duplicate plugin/preset detected" warning that breaks success
    // criterion #5. Reanimated 4.1 in SDK 54 wires worklets automatically
    // via babel-preset-expo. See PITFALLS §3.1.
    // DO NOT add 'react-native-reanimated/plugin' here either, for the
    // same reason. If Metro DOES complain about a missing plugin (rare on
    // SDK 54), and ONLY then, add 'plugins: ["react-native-reanimated/plugin"]'
    // as the LAST plugin — never alongside any worklets plugin.
  };
};
