# Service Log

An offline Android maintenance log for vehicles and small engines.

- Multiple profiles tracked by miles driven or hours used
- Editable oil, part replacement, and other maintenance records
- Receipt, before, and after photos
- Complete JSON export and restore, including attached photos
- Custom backup names; default: `Maintenance log backup mm/dd/yyyy`

## Build and install

Requires Node.js 22, JDK 21, Android SDK Platform 35 and Build Tools 35.

```sh
npm ci
npm run android:sync
cd android
chmod +x gradlew
./gradlew assembleDebug
```

Install `android/app/build/outputs/apk/debug/app-debug.apk` on Android 6.0 or later. Allow installation from your file manager when prompted. Debug builds are for evaluation; physical-device testing is still needed, especially photo selection and backup/restore. Keep backups before updating.

The GitHub Actions workflow builds an evaluation APK, available in the successful run's artifacts. Each build uses an ephemeral debug signing key: later builds may require uninstalling the previous evaluation build. Export a complete backup before uninstalling, then restore it afterward. No signing keys are distributed.

The public edition uses the neutral application ID `org.maintenancelog.app` and installs separately from other editions. To transfer data, export a complete backup from the old installation and import it into this one. Do not uninstall the old app until you have verified the restored records and photos.

## Data and privacy

New installations start empty. The source contains no saved profiles, maintenance records, receipts, backups, or personal photos. Records are stored in Android private preferences; photos are stored in app-private files. There is no app-operated server, analytics, or account login.

Android Auto Backup is enabled and may back up app data according to the device's settings and system limits. Manual JSON backups include records and pictures and are not encrypted. Store them privately. The Android document picker can save to a cloud provider such as Google Drive if installed; this is not live synchronization.

Imported backups merge records by ID and can replace matching entries. Photo backups fail if an attached photo cannot be read. Photo imports are resized to a maximum 2000-pixel longest edge. Filename slashes in the default date are replaced with dashes for compatibility.

## Sharing

You may use, copy, modify, and redistribute this project, with or without modifications. It is provided as-is, without warranty. Third-party dependencies retain their own licenses.
