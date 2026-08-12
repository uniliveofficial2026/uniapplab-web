#!/usr/bin/env node
/**
 * Pin Android build toolchain to the latest official Gradle + AGP + Kotlin + JDK path.
 * Run after `pnpm exec cap sync` / `cap add android` if those rewrite versions.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../android');
const GRADLE = '9.6.1';
const AGP = '9.3.0';
const KOTLIN = '2.4.10';
const JDK_HOME = '/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home';

const wrapperPath = path.join(root, 'gradle/wrapper/gradle-wrapper.properties');
const buildPath = path.join(root, 'build.gradle');
const appBuildPath = path.join(root, 'app/build.gradle');
const variablesPath = path.join(root, 'variables.gradle');
const gradlePropsPath = path.join(root, 'gradle.properties');

let wrapper = readFileSync(wrapperPath, 'utf8');
wrapper = wrapper.replace(
  /distributionUrl=.*/,
  `distributionUrl=https\\://services.gradle.org/distributions/gradle-${GRADLE}-all.zip`,
);
writeFileSync(wrapperPath, wrapper);

let build = readFileSync(buildPath, 'utf8');
build = build.replace(
  /classpath ['"]com\.android\.tools\.build:gradle:[^'"]+['"]/,
  `classpath 'com.android.tools.build:gradle:${AGP}'`,
);
if (/kotlin-gradle-plugin/.test(build)) {
  build = build.replace(
    /classpath ["']org\.jetbrains\.kotlin:kotlin-gradle-plugin:[^"']+["']/,
    `classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion"`,
  );
} else {
  build = build.replace(
    /(classpath ['"]com\.android\.tools\.build:gradle:[^'"]+['"])/,
    `$1\n        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion"`,
  );
}
if (!/apply from:\s*["']variables\.gradle["']/.test(build.split('buildscript')[0] || '')) {
  // Ensure variables.gradle is available inside buildscript for $kotlinVersion
  if (!/buildscript\s*\{[\s\S]*?apply from:\s*["']variables\.gradle["']/.test(build)) {
    build = build.replace(
      /buildscript\s*\{/,
      'buildscript {\n    apply from: "variables.gradle"\n',
    );
  }
}
writeFileSync(buildPath, build);

if (existsSync(variablesPath)) {
  let vars = readFileSync(variablesPath, 'utf8');
  if (/kotlinVersion\s*=/.test(vars)) {
    vars = vars.replace(/kotlinVersion\s*=\s*['"][^'"]+['"]/, `kotlinVersion = '${KOTLIN}'`);
  } else {
    vars = vars.replace(
      /(ext\s*\{)/,
      `$1\n    kotlinVersion = '${KOTLIN}'`,
    );
  }
  writeFileSync(variablesPath, vars);
}

let appBuild = readFileSync(appBuildPath, 'utf8');
appBuild = appBuild.replace(
  /getDefaultProguardFile\(['"]proguard-android\.txt['"]\)/,
  "getDefaultProguardFile('proguard-android-optimize.txt')",
);
// AGP 9+ ships built-in Kotlin — remove the legacy kotlin-android plugin if present.
appBuild = appBuild.replace(/\n?apply plugin:\s*['"]kotlin-android['"]\s*/g, '\n');
appBuild = appBuild.replace(/\n{3,}/g, '\n\n');
if (!/kotlin-stdlib/.test(appBuild)) {
  appBuild = appBuild.replace(
    /(implementation project\(['"]:capacitor-android['"]\))/,
    `implementation "org.jetbrains.kotlin:kotlin-stdlib:$kotlinVersion"\n    $1`,
  );
}
if (!/kotlin\s*\{[\s\S]*?jvmToolchain/.test(appBuild)) {
  appBuild = appBuild.replace(
    /(compileOptions\s*\{[\s\S]*?\n\s*\})/,
    `$1\n    kotlin {\n        jvmToolchain(17)\n    }`,
  );
}
writeFileSync(appBuildPath, appBuild);

if (existsSync(gradlePropsPath)) {
  let props = readFileSync(gradlePropsPath, 'utf8');
  if (/^org\.gradle\.java\.home=/m.test(props)) {
    props = props.replace(
      /^org\.gradle\.java\.home=.*/m,
      `org.gradle.java.home=${JDK_HOME}`,
    );
  } else {
    props = `org.gradle.java.home=${JDK_HOME}\n${props}`;
  }
  writeFileSync(gradlePropsPath, props);
}

console.log(
  `[pin-android-toolchain] Gradle ${GRADLE}, AGP ${AGP}, Kotlin ${KOTLIN}, JDK ${JDK_HOME}`,
);
