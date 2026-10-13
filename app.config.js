// The beta is the same code built as its own app: another name, icon and
// identifier, so it installs next to the live app and never replaces it.
// `APP_VARIANT=beta` comes from the "beta" build profile in eas.json, which
// also points the app at the test database.
module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'beta') return config;
  return {
    ...config,
    name: 'The Dugout Beta',
    icon: './assets/icon-beta.png',
    scheme: 'thedugoutbeta',
    ios: { ...config.ios, bundleIdentifier: 'be.fcvdender.thedugout.beta' },
    android: { ...config.android, package: 'be.fcvdender.thedugout.beta' },
  };
};
