# Griffin Rook Installer

Tiny private-purpose Android helper for Jerome's Griffin House of Rooks phone workflow.

## What it does
- No ads, account, analytics, tracking, or network permission.
- Lets the user select a storage folder using Android's system picker.
- Accepts a full Rook ZIP.
- Validates that the ZIP contains `index.html` and `game.js` before replacing anything.
- Extracts to a temporary `Rook_NEW` folder and verifies extraction before replacing `Rook`.
- Keeps the original ZIP in `RookZips`.

## Build APK on GitHub
Open **Actions → Build Griffin Rook Installer APK → Run workflow**.
When it succeeds, download the **GriffinRookInstaller-APK** artifact. It contains `GriffinRookInstaller.apk`.

The workflow also runs automatically on pushes to `main`.
