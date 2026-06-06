// Dynamic Expo config. Keeps app.json as the source of truth and only injects
// a web base URL (needed when the static web build is hosted under a sub-path,
// e.g. GitHub Pages at /WhatToWear/). Local dev and native builds are unaffected
// because EXPO_BASE_URL is unset there, leaving baseUrl as "".
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...(config.experiments ?? {}),
    baseUrl: process.env.EXPO_BASE_URL ?? '',
  },
});
