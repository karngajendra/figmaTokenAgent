# FigmaDS — Figma Design Token Sync Agent for Android

A custom **GitHub Copilot agent pipeline** that automatically pulls design tokens from Figma and converts them into ready-to-use **Jetpack Compose** Kotlin foundation files in your Android project.

---

## What It Does

```
Figma File  →  Raw Tokens  →  Style Dictionary  →  Kotlin Compose Files
(Variables/Styles API)      (normalise + transform)   (Colors.kt, Typography.kt, Elevation.kt …)
```

Every time your Figma file changes, running `@figma-ds sync` in Copilot Chat (or `npm run full-sync` in the terminal) will:

1. **Connect** to Figma and pull all design tokens (colors, typography, elevation, etc.)
2. **Check** if the Figma file version has changed since the last sync — skips if nothing changed
3. **Convert** tokens via Style Dictionary into Android Compose-ready JSON
4. **Write** or update Kotlin foundation files in your Android project, preserving any manual code you've added

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org/) | **≥ 18** | Uses native `fetch` and ES modules |
| [VS Code](https://code.visualstudio.com/) | Latest | Required for Copilot agent support |
| [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) extension | Latest | Powers the `@figma-ds` chat agent |
| [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat) extension | Latest | Required to invoke agents |
| [Android Studio](https://developer.android.com/studio) _(optional)_ | Any recent | To build and run the Android app |

---

## Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd CustomAgent
```

### 2. Install dependencies

```bash
npm install
```

This installs `style-dictionary`, `dotenv`, and `fs-extra`. All runtime output directories (`tokens/raw/`, `tokens/build/android/`, etc.) are **created automatically** by the scripts on first run — you don't need to create anything manually.

### 3. Create your `.env` file

The `.env` file is **gitignored** and must be created manually. It holds your Figma credentials.

```bash
touch .env
```

Add the following two values:

```env
FIGMA_ACCESS_TOKEN=your_personal_access_token_here
FIGMA_FILE_KEY=your_figma_file_key_here
```

**How to get these values:**

- **`FIGMA_ACCESS_TOKEN`**
  1. Log in to [figma.com](https://figma.com)
  2. Go to **Account Settings** → scroll to **Personal access tokens**
  3. Click **Generate new token**, give it a name, and copy the value

- **`FIGMA_FILE_KEY`**
  - Open your Figma file in the browser
  - The URL looks like: `https://www.figma.com/file/ABC123XYZ.../Your-File-Name`
  - The `FILE_KEY` is the segment after `/file/` — e.g. `ABC123XYZ...`

---

## Running the Sync

### Option A — Copilot Chat (recommended)

Open **Copilot Chat** in VS Code and type:

```
@figma-ds sync
```

You'll see a live step-by-step progress timeline:

```
[1/4] 🔌 Connecting to Figma...          ✓ Connected — 87 tokens (colors, typography, elevation)
[2/4] 🔍 Checking version...             ✓ New version detected
[3/4] 🔄 Converting tokens...            ✓ 87 tokens converted across 3 categories
[4/4] 📁 Syncing Android foundations...  ✓ 3 files written
```

If nothing has changed in Figma since the last sync:

```
[2/4] 🔍 Checking version... ⏭ No changes — sync skipped
✅ FigmaDS: All up to date.
```

**Other Copilot Chat commands:**

| Command | What it does |
|---|---|
| `@figma-ds sync` | Full pipeline (version-gated) |
| `@figma-ds` → click **Force re-sync** | Skip version check and force re-sync |
| `@figma-ds` → click **Check version only** | Just check if Figma has changed |

### Option B — Command Line (npm scripts)

Run the full pipeline in one command:

```bash
npm run full-sync
```

Or run each step individually:

```bash
npm run check-version      # Step 2: check if Figma file version changed
npm run sync-tokens        # Step 1: fetch tokens from Figma API
npm run build-tokens       # Step 3: convert via Style Dictionary
npm run write-foundations  # Step 4: write Kotlin files to Android project
```

---

## Project Structure

```
CustomAgent/
├── .env                          ← Your credentials (gitignored — create manually)
├── .version-cache.json           ← Tracks last-synced Figma version (gitignored)
├── package.json
│
├── .github/
│   ├── copilot-instructions.md   ← Project-wide Copilot context
│   └── agents/
│       ├── figma-ds.agent.md         ← Orchestrator agent (@figma-ds)
│       ├── figma-connect.agent.md    ← Step 1: fetch from Figma API
│       ├── version-check.agent.md    ← Step 2: detect version changes
│       ├── token-convert.agent.md    ← Step 3: Style Dictionary transform
│       └── foundation-sync.agent.md  ← Step 4: write Kotlin files
│
├── scripts/
│   ├── figma/
│   │   ├── fetchTokens.js        ← Pulls tokens from Figma (Variables API → Styles API fallback)
│   │   ├── checkVersion.js       ← Compares current vs cached Figma version
│   │   └── saveVersion.js        ← Writes new version to .version-cache.json
│   ├── style-dictionary/
│   │   ├── build.js              ← Runs the Style Dictionary pipeline
│   │   ├── config.js             ← SD platform and transform config
│   │   └── transforms/
│   │       ├── composeColor.js       ← RGBA floats → Color(0xAARRGGBB)
│   │       ├── composeDimension.js   ← numbers → 16.dp / 16.sp
│   │       └── composeTypography.js  ← typography token transforms
│   └── android/
│       └── writeFoundation.js    ← Writes/updates .kt foundation files
│
├── tokens/
│   ├── raw/                      ← Raw Figma JSON output (gitignored)
│   ├── converted/                ← Normalised Style Dictionary input JSON
│   └── build/android/            ← Style Dictionary output JSON (gitignored)
│
└── AndroidApp/FigmaDS/app/src/main/java/com/gajendrakarn/figmadsapp/
    ├── foundations/              ← AUTO-GENERATED Kotlin files (Colors.kt, Typography.kt, …)
    └── components/               ← MANUAL Kotlin Compose components (never overwritten)
```

---

## Generated Kotlin Files

After a successful sync, the following files are created or updated under `AndroidApp/.../foundations/`:

| File | Kotlin Object | Example value |
|---|---|---|
| `Colors.kt` | `FigmaColors` | `val PrimaryMain = Color(0xFF7A41F7)` |
| `Typography.kt` | `FigmaTypography` | `val BodyMd = TextStyle(fontSize = 16.sp)` |
| `Elevation.kt` | `FigmaElevation` | `val Card = 4.dp` |

### Using tokens in your Compose UI

```kotlin
import com.gajendrakarn.figmadsapp.foundations.FigmaColors
import com.gajendrakarn.figmadsapp.foundations.FigmaTypography

Text(
    text = "Hello",
    color = FigmaColors.PrimaryMain,
    style = FigmaTypography.BodyMd
)
```

### Safe to add manual code

Each generated file contains a guarded block:

```kotlin
// AUTO-GENERATED by FigmaDS agent. Do not edit the generated block manually.
// <figma-ds:generated version="..." updated="...">
object FigmaColors {
    val PrimaryMain = Color(0xFF7A41F7)
    // ... all tokens here
}
// </figma-ds:generated>

// ✅ Add your own extensions or aliases BELOW this line — they will never be overwritten
val brandPrimary = FigmaColors.PrimaryMain
```

Any code you write **outside** the `<figma-ds:generated>` markers is preserved across every sync.

---

## How the Agent Pipeline Works

```
@figma-ds (orchestrator)
  │
  ├─▶ @figma-connect   → scripts/figma/fetchTokens.js      → tokens/raw/figma-tokens.json
  │
  ├─▶ @version-check   → scripts/figma/checkVersion.js     → compare with .version-cache.json
  │                       (exits early with NO_CHANGE if version matches)
  │
  ├─▶ @token-convert   → scripts/style-dictionary/build.js → tokens/build/android/*.json
  │
  └─▶ @foundation-sync → scripts/android/writeFoundation.js → foundations/*.kt
                          scripts/figma/saveVersion.js       → .version-cache.json (updated)
```

The agents are defined in `.github/agents/` and are automatically available in VS Code Copilot Chat. Only `@figma-ds` is user-invocable; the sub-agents are invoked internally by the orchestrator.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `FIGMA_ACCESS_TOKEN is not set` | Create `.env` with your token (see Setup step 3) |
| `HTTP 403 from Figma API` | Token is wrong or expired — regenerate in Figma Account Settings |
| `0 tokens fetched` | The `FIGMA_FILE_KEY` may be pointing to the wrong file, or the file has no Variables/Styles defined |
| `tokens/raw/figma-tokens.json not found` | Run `npm run sync-tokens` before `npm run build-tokens` |
| `tokens/build/android/ is empty` | Run `npm run build-tokens` before `npm run write-foundations` |
| Agent not appearing in Copilot Chat | Make sure GitHub Copilot and Copilot Chat extensions are installed and you're signed in |
| Style Dictionary config error | Check `scripts/style-dictionary/config.js` for platform/transform mismatches |

---

## Token Categories Supported

| Category | Figma source | Kotlin output |
|---|---|---|
| Colors | Variables / Styles | `Color(0xAARRGGBB)` |
| Typography | Variables / Text Styles | `TextStyle(fontSize, fontWeight, …)` |
| Spacing / Dimensions | Variables | `Dp` values (`8.dp`, `16.dp`) |
| Elevation | Variables | `Dp` values |
| Borders | Variables | `Dp` (border width) |
| Opacity | Variables | `Float` (`0.0f` – `1.0f`) |

---

## Security Notes

- **Never commit `.env`** — it's gitignored but double-check before pushing
- The `FIGMA_ACCESS_TOKEN` grants read access to your Figma files — treat it like a password
- All credentials are read from environment variables only; nothing is hardcoded in scripts
