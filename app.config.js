
function requireEnv(key) {
  const v = process.env[key];
  if (!v || !v.trim()) {
    // Warn only — do NOT throw. EAS CLI reads this config before build-time
    // secrets are injected. Throwing here breaks eas secret:create, eas build, etc.
    // The real value will be provided by EAS secrets / local .env during actual builds.
    console.warn(`[app.config.js] Warning: ${key} is not set in environment`);
    return undefined;
  }
  return v.trim();
}

module.exports = {
  name: "PristineHealth",
  slug: "mobileapp",
  scheme: (process.env.APP_SCHEME || "pristinemobile").trim(),

  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  icon: "./assets/icon.png",

  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.pristinehealth.mobileapp",
    deploymentTarget: "15.1",
    icon: "./assets/icon.png",
    config: {
      googleMapsApiKey: requireEnv("GOOGLE_MAPS_API_KEY"),
    },
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "Allow PristineHealth to access your location while using the app to verify shift check-in at service facilities.",
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
    },
  },

  android: {
    package: "com.pristinehealth.mobileapp",
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
    ],
    config: {
      googleMaps: {
        apiKey: requireEnv("GOOGLE_MAPS_API_KEY"),
      },
    },
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#ffffff",
    },
  },

  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },

  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-font",
    [
      "expo-splash-screen",
      {
        image: "./assets/icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: { backgroundColor: "#0f172a" },
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    eas: {
      projectId: "80e94873-d4cf-4a07-a36a-69fc5b81a310",
    },
    API_BASE_URL: requireEnv("API_BASE_URL"),
    GOOGLE_CLIENT_ID: requireEnv("GOOGLE_CLIENT_ID"),
    MICROSOFT_CLIENT_ID: requireEnv("MICROSOFT_CLIENT_ID"),
    MICROSOFT_TENANT: (process.env.MICROSOFT_TENANT || "common").trim(),
  },
};