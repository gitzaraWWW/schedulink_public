import springBackdrop from "../../assets/themes/spring/spring-backdrop.png";
import springTopOverlay from "../../assets/themes/spring/spring-top-overlay.png";

const STORAGE_KEY = "schedulink-ui-preferences";
const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 18;

export const THEME_PRESETS = [
  {
    key: "mint",
    label: "Mint",
    palette: {
      50: "#f4fbfa",
      100: "#dff8f5",
      300: "#92ece4",
      500: "#58d1c8",
      600: "#46c2ba",
    },
  },
  {
    key: "ocean",
    label: "Ocean",
    palette: {
      50: "#f2f7ff",
      100: "#dbeafe",
      300: "#93c5fd",
      500: "#3b82f6",
      600: "#2563eb",
    },
  },
  {
    key: "coral",
    label: "Coral",
    palette: {
      50: "#fff6f3",
      100: "#ffe1d7",
      300: "#fda58a",
      500: "#f97360",
      600: "#ea5b49",
    },
  },
  {
    key: "violet",
    label: "Violet",
    palette: {
      50: "#f7f4ff",
      100: "#ece4ff",
      300: "#c4b5fd",
      500: "#8b5cf6",
      600: "#7c3aed",
    },
  },
  {
    key: "sunset",
    label: "Sunset",
    palette: {
      50: "#fff8ef",
      100: "#ffedc2",
      300: "#fcd34d",
      500: "#f59e0b",
      600: "#d97706",
    },
  },
  {
    key: "forest",
    label: "Forest",
    palette: {
      50: "#f3fbf6",
      100: "#d8f4df",
      300: "#86d7a0",
      500: "#22c55e",
      600: "#16a34a",
    },
  },
  {
    key: "spring-blossom",
    label: "Spring",
    palette: {
      50: "#fff7fb",
      100: "#ffe7f1",
      300: "#f7b5ce",
      500: "#f48fb8",
      600: "#ea6c9d",
    },
    assets: {
      calendarBackdrop: springBackdrop,
      calendarTopOverlay: springTopOverlay,
    },
  },
];

export const BACKGROUND_PRESETS = [
  {
    key: "paper",
    label: "Paper",
    palette: {
      app: "#f9fafc",
      shell: "#ffffff",
      stage: "#f6f8fd",
      stageStrong: "#eef2fb",
      card: "#ffffff",
      border: "#e4e9f4",
    },
  },
  {
    key: "butter",
    label: "Butter",
    palette: {
      app: "#fffdf6",
      shell: "#fffef9",
      stage: "#fff8e3",
      stageStrong: "#fff0c8",
      card: "#fffdf5",
      border: "#f2e2a6",
    },
  },
  {
    key: "peach",
    label: "Peach",
    palette: {
      app: "#fffaf7",
      shell: "#fffdfb",
      stage: "#ffefe5",
      stageStrong: "#ffdccc",
      card: "#fffaf7",
      border: "#f2d4c4",
    },
  },
  {
    key: "sage",
    label: "Sage",
    palette: {
      app: "#f7fbf7",
      shell: "#fcfefc",
      stage: "#edf7ee",
      stageStrong: "#dceede",
      card: "#fbfefb",
      border: "#d4e5d6",
    },
  },
  {
    key: "sky",
    label: "Sky",
    palette: {
      app: "#f7fbff",
      shell: "#fbfdff",
      stage: "#edf4ff",
      stageStrong: "#d9e8ff",
      card: "#fbfdff",
      border: "#d5e3fb",
    },
  },
  {
    key: "lavender",
    label: "Lavender",
    palette: {
      app: "#faf8ff",
      shell: "#fdfcff",
      stage: "#f1edff",
      stageStrong: "#e3dcff",
      card: "#fcfbff",
      border: "#ddd6fb",
    },
  },
];

export const MANUAL_ACCENT_PRESETS = THEME_PRESETS.filter(
  (preset) => preset.key !== "spring-blossom"
);

export const DEFAULT_UI_PREFERENCES = {
  themeKey: "custom",
  backgroundKey: "peach",
  accentKey: "spring-blossom",
  fontSize: 16,
};

function clampFontSize(value) {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, value));
}

function hexToRgbString(hexColor) {
  const normalized = String(hexColor || "").replace("#", "");

  if (normalized.length !== 6) {
    return "88, 209, 200";
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `${red}, ${green}, ${blue}`;
}

function rgba(rgbString, alpha) {
  return `rgba(${rgbString}, ${alpha})`;
}

export function getThemePreset(accentKey) {
  return (
    THEME_PRESETS.find((preset) => preset.key === accentKey) || THEME_PRESETS[0]
  );
}

export function getBackgroundPreset(backgroundKey) {
  return (
    BACKGROUND_PRESETS.find((preset) => preset.key === backgroundKey) ||
    BACKGROUND_PRESETS[0]
  );
}

export function normalizeUiPreferences(preferences = {}) {
  const backgroundPreset = getBackgroundPreset(preferences.backgroundKey);
  const accentPreset = getThemePreset(preferences.accentKey);
  const rawFontSize = Number(preferences.fontSize);

  return {
    themeKey: "custom",
    backgroundKey: backgroundPreset.key,
    accentKey: accentPreset.key,
    fontSize: clampFontSize(
      Number.isFinite(rawFontSize)
        ? rawFontSize
        : DEFAULT_UI_PREFERENCES.fontSize
    ),
  };
}

export function loadUiPreferences() {
  if (typeof window === "undefined") {
    return DEFAULT_UI_PREFERENCES;
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return DEFAULT_UI_PREFERENCES;
    }

    return normalizeUiPreferences(JSON.parse(rawValue));
  } catch {
    return DEFAULT_UI_PREFERENCES;
  }
}

export function saveUiPreferences(preferences) {
  const normalized = normalizeUiPreferences(preferences);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }

  return normalized;
}

export function applyUiTheme(preferences) {
  if (typeof document === "undefined") {
    return;
  }

  const normalized = normalizeUiPreferences(preferences);
  const backgroundPreset = getBackgroundPreset(normalized.backgroundKey);
  const preset = getThemePreset(normalized.accentKey);
  const rootStyle = document.documentElement.style;
  const rgb50 = hexToRgbString(preset.palette[50]);
  const rgb100 = hexToRgbString(preset.palette[100]);
  const rgb300 = hexToRgbString(preset.palette[300]);
  const rgb500 = hexToRgbString(preset.palette[500]);
  const rgb600 = hexToRgbString(preset.palette[600]);

  rootStyle.setProperty("--font-size-root", `${normalized.fontSize}px`);
  rootStyle.setProperty("--mint-100", preset.palette[100]);
  rootStyle.setProperty("--mint-300", preset.palette[300]);
  rootStyle.setProperty("--mint-500", preset.palette[500]);
  rootStyle.setProperty("--mint-600", preset.palette[600]);
  rootStyle.setProperty("--accent", preset.palette[500]);
  rootStyle.setProperty("--theme-rgb-50", rgb50);
  rootStyle.setProperty("--theme-rgb-100", rgb100);
  rootStyle.setProperty("--theme-rgb-300", rgb300);
  rootStyle.setProperty("--theme-rgb-500", rgb500);
  rootStyle.setProperty("--theme-rgb-600", rgb600);
  rootStyle.setProperty("--theme-surface", preset.palette[50]);
  rootStyle.setProperty("--app-bg", backgroundPreset.palette.app);
  rootStyle.setProperty("--app-shell-bg", backgroundPreset.palette.shell);
  rootStyle.setProperty("--app-stage-bg", backgroundPreset.palette.stage);
  rootStyle.setProperty(
    "--app-stage-bg-strong",
    backgroundPreset.palette.stageStrong
  );
  rootStyle.setProperty("--app-card-bg", backgroundPreset.palette.card);
  rootStyle.setProperty("--app-stage-border", backgroundPreset.palette.border);
  rootStyle.setProperty(
    "--app-stage-gradient",
    `linear-gradient(180deg, ${backgroundPreset.palette.stage} 0%, ${backgroundPreset.palette.stageStrong} 100%)`
  );
  rootStyle.setProperty("--theme-soft-72", rgba(rgb100, 0.72));
  rootStyle.setProperty("--theme-soft-88", rgba(rgb100, 0.88));
  rootStyle.setProperty("--theme-soft-90", rgba(rgb100, 0.9));
  rootStyle.setProperty("--theme-soft-92", rgba(rgb100, 0.92));
  rootStyle.setProperty("--theme-soft-96", rgba(rgb100, 0.96));
  rootStyle.setProperty("--theme-soft-98", rgba(rgb100, 0.98));
  rootStyle.setProperty("--theme-fill-04", rgba(rgb500, 0.04));
  rootStyle.setProperty("--theme-fill-08", rgba(rgb500, 0.08));
  rootStyle.setProperty("--theme-fill-10", rgba(rgb500, 0.1));
  rootStyle.setProperty("--theme-fill-14", rgba(rgb500, 0.14));
  rootStyle.setProperty("--theme-fill-16", rgba(rgb500, 0.16));
  rootStyle.setProperty("--theme-fill-24", rgba(rgb500, 0.24));
  rootStyle.setProperty("--theme-fill-28", rgba(rgb500, 0.28));
  rootStyle.setProperty("--theme-outline-40", rgba(rgb500, 0.4));
  rootStyle.setProperty("--theme-shadow-20", rgba(rgb500, 0.2));
  rootStyle.setProperty("--theme-shadow-24", rgba(rgb500, 0.24));
  rootStyle.setProperty("--theme-shadow-28", rgba(rgb500, 0.28));
  rootStyle.setProperty("--theme-border-82", rgba(rgb300, 0.82));
  rootStyle.setProperty("--theme-border-92", rgba(rgb300, 0.92));
  rootStyle.setProperty("--theme-border-96", rgba(rgb300, 0.96));
  rootStyle.setProperty(
    "--theme-gradient-strong",
    `linear-gradient(135deg, ${preset.palette[500]} 0%, ${preset.palette[600]} 100%)`
  );
  rootStyle.setProperty(
    "--theme-gradient-soft",
    `linear-gradient(135deg, ${rgba(rgb100, 0.96)} 0%, ${preset.palette[50]} 100%)`
  );
  rootStyle.setProperty(
    "--calendar-backdrop-image",
    preset.assets?.calendarBackdrop ? `url("${preset.assets.calendarBackdrop}")` : "none"
  );
  rootStyle.setProperty(
    "--calendar-backdrop-opacity",
    preset.assets?.calendarBackdrop ? "1" : "0"
  );
  rootStyle.setProperty(
    "--calendar-top-overlay-image",
    preset.assets?.calendarTopOverlay
      ? `url("${preset.assets.calendarTopOverlay}")`
      : "none"
  );
  rootStyle.setProperty(
    "--calendar-top-overlay-opacity",
    preset.assets?.calendarTopOverlay ? "1" : "0"
  );
}
