import { webDarkTheme, webLightTheme } from '@fluentui/react-components';

function isDarkColor(color: string): boolean {
  const hex = color.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
  const channels = hex
    ? (hex.length === 3 ? [...hex].map((value) => parseInt(value + value, 16)) : hex.match(/../g)!.map((value) => parseInt(value, 16)))
    : color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length < 3) return false;
  const [red, green, blue] = channels;
  return (red * 299 + green * 587 + blue * 114) / 1000 < 128;
}

export function syncAzureDevOpsColorScheme(): boolean {
  const background = getComputedStyle(document.documentElement).getPropertyValue('--background-color').trim();
  const dark = isDarkColor(background);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  return dark;
}

export function createAzureDevOpsTheme() {
  const background = getComputedStyle(document.documentElement).getPropertyValue('--background-color').trim();
  const light = !isDarkColor(background);
  const baseTheme = light ? webLightTheme : webDarkTheme;
  const panelBackground = light
    ? 'color-mix(in srgb, var(--background-color, #ffffff) 94%, var(--text-primary-color, #242424))'
    : 'color-mix(in srgb, var(--background-color, #242424) 88%, var(--text-primary-color, #ffffff))';
  const subtleBorder = 'color-mix(in srgb, var(--background-color, #ffffff) 84%, var(--text-primary-color, #242424))';

  document.documentElement.style.setProperty('--cloudops-card-background', panelBackground);
  document.documentElement.style.setProperty('--cloudops-border', subtleBorder);

  return {
    ...baseTheme,
    colorNeutralForeground1: 'var(--text-primary-color, #242424)',
    colorNeutralForeground2: 'var(--text-secondary-color, #424242)',
    colorNeutralForeground3: 'var(--text-secondary-color, #616161)',
    colorNeutralStroke1: 'var(--cloudops-border, #d1d1d1)',
    colorNeutralStroke2: 'var(--cloudops-border, #e1e1e1)',
    colorBrandBackground: 'var(--communication-background, #0f6cbd)',
    colorBrandForeground1: 'var(--communication-foreground, #115ea3)',
  };
}