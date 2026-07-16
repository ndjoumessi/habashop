// Learn more: https://docs.expo.dev/guides/customizing-metro/
// getSentryExpoConfig = getDefaultConfig + génération des source maps (debug IDs)
// pour la symbolication Sentry. Drop-in : fonctionne aussi en dev / Expo Go.
const { getSentryExpoConfig } = require('@sentry/react-native/metro')

const config = getSentryExpoConfig(__dirname)

module.exports = config
