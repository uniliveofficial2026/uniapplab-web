export type AppStackKind =
  | "react-web"
  | "react-native"
  | "flutter"
  | "ios-native"
  | "android-native"
  | "capacitor";

export type AppStackSpec = {
  stack: AppStackKind;
  label: string;
  runtime: string;
  targets: string[];
};

const STACK_CATALOG: AppStackSpec[] = [
  { stack: "react-web", label: "React (Vite web)", runtime: "Node + browser", targets: ["web", "pwa", "desktop"] },
  { stack: "react-native", label: "React Native (Expo)", runtime: "Expo + Metro", targets: ["ios", "android"] },
  { stack: "flutter", label: "Flutter", runtime: "Dart + Flutter SDK", targets: ["ios", "android", "web", "desktop"] },
  { stack: "ios-native", label: "iOS (SwiftUI)", runtime: "Xcode + Swift", targets: ["ios", "ipad"] },
  { stack: "android-native", label: "Android (Kotlin Compose)", runtime: "Gradle + Kotlin", targets: ["android"] },
  { stack: "capacitor", label: "Capacitor hybrid", runtime: "React + native shell", targets: ["ios", "android", "web"] },
];

export function listAppStacks(): AppStackSpec[] {
  return STACK_CATALOG;
}

export function inferAppStack(message: string): AppStackSpec {
  const lower = message.toLowerCase();

  if (/\bflutter\b/.test(lower)) return spec("flutter");
  if (/\b(react[- ]?native|expo)\b/.test(lower) || /\brn app\b/.test(lower)) return spec("react-native");
  if (/\b(capacitor|ionic)\b/.test(lower) || /\bhybrid app\b/.test(lower)) return spec("capacitor");

  const wantsIos = /\b(ios|swiftui|swift|iphone|ipad)\b/.test(lower);
  const wantsAndroid = /\b(android|kotlin|jetpack compose|compose ui)\b/.test(lower);

  if (wantsIos && !wantsAndroid && !/\bflutter\b/.test(lower)) return spec("ios-native");
  if (wantsAndroid && !wantsIos && !/\bflutter\b/.test(lower)) return spec("android-native");

  if (/\bnative app\b/.test(lower) || (/\bnative\b/.test(lower) && /\b(mobile|app)\b/.test(lower))) {
    return spec("react-native");
  }

  if (/\b(react|vite|next\.?js|web app|pwa)\b/.test(lower)) return spec("react-web");

  return spec("react-web");
}

function spec(stack: AppStackKind): AppStackSpec {
  return STACK_CATALOG.find((s) => s.stack === stack)!;
}

export function projectKindForStack(stack: AppStackKind): "react-vite" | "react-native" | "flutter" | "ios-native" | "android-native" | "custom" {
  switch (stack) {
    case "react-web":
    case "capacitor":
      return "react-vite";
    case "react-native":
      return "react-native";
    case "flutter":
      return "flutter";
    case "ios-native":
      return "ios-native";
    case "android-native":
      return "android-native";
    default:
      return "custom";
  }
}
