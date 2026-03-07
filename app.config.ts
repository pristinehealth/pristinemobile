import fs from "fs";
import path from "path";

type EnvMap = Record<string, string>;

function parseDotEnv(dotenvText: string): EnvMap {
  const out: EnvMap = {};
  for (const line of dotenvText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();

    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }

    out[key] = val;
  }
  return out;
}

function loadEnv(): EnvMap {
  const envPath = path.join(__dirname, ".env");
  const fileEnv = fs.existsSync(envPath)
    ? parseDotEnv(fs.readFileSync(envPath, "utf8"))
    : {};
  return { ...fileEnv, ...process.env } as EnvMap;
}

function requireEnv(env: EnvMap, key: string): string {
  const v = env[key];
  if (!v || !v.trim()) throw new Error(`Missing ${key} in mobileapp/.env`);
  return v.trim();
}

const env = loadEnv();

// NOTE: do NOT include "expo-web-browser" in plugins (it is not a config plugin).
const config = {
  name: "mobileapp",
  slug: "mobileapp",
  scheme: requireEnv(env, "APP_SCHEME"),

  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  icon: "./assets/images/icon.png",

  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.anonymous.mobileapp",
    infoPlist: {
      // Allow all HTTP/HTTPS traffic during development and to Render.com
      // (iOS App Transport Security would otherwise block non-HTTPS or untrusted certs)
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
    },
  },

  android: {
    package: "com.anonymous.mobileapp",
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    config: {
      googleMaps: {
        apiKey: env["GOOGLE_MAPS_API_KEY"] || "",
      },
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
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: { backgroundColor: "#000000" },
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    API_BASE_URL: requireEnv(env, "API_BASE_URL"),
    GOOGLE_CLIENT_ID: requireEnv(env, "GOOGLE_CLIENT_ID"),
    MICROSOFT_CLIENT_ID: requireEnv(env, "MICROSOFT_CLIENT_ID"),
    MICROSOFT_TENANT: (env.MICROSOFT_TENANT || "common").trim(),
    GOOGLE_MAPS_API_KEY: env["GOOGLE_MAPS_API_KEY"] || "",
  },
};

export default config;