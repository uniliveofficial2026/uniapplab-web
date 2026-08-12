# Implementation Plan - Fix Warnings in `AndroidManifest.xml`

The `AndroidManifest.xml` file currently contains warnings regarding tag placement and empty tag bodies. This plan outlines the steps to resolve these warnings.

## User Review Required

> [!IMPORTANT]
> I have identified warnings in multiple files, but `AndroidManifest.xml` contains the most significant Android-specific warnings. Please confirm if this is the "current file" you are referring to. If you meant another file (e.g., `app/build.gradle` or a specific Java file), please let me know.

## Proposed Changes

### App Module

#### [MODIFY] [AndroidManifest.xml](file:///Volumes/Wei2TB/Universal-Fixer/artifacts/instacollab/android/app/src/main/AndroidManifest.xml)
- Move `<uses-permission>` and `<uses-feature>` tags before the `<application>` tag to follow standard Android manifest structure and resolve the warning.
- Change the `<meta-data>` tag for `FILE_PROVIDER_PATHS` to a self-closing tag to resolve the "empty body" warning.

## Verification Plan

### Manual Verification
- Run `analyze_file` on `app/src/main/AndroidManifest.xml` to ensure all warnings are resolved.
- Run `gradle_sync` to ensure the project still synchronizes correctly.
