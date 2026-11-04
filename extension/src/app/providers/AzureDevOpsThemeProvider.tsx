import { useEffect, useState, type ReactNode } from 'react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { createAzureDevOpsTheme, syncAzureDevOpsColorScheme } from './azureDevOpsTheme';

export function AzureDevOpsThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState(webLightTheme);

  useEffect(() => {
    const updateTheme = () => {
      syncAzureDevOpsColorScheme();
      setTheme(createAzureDevOpsTheme());
    };

    window.addEventListener('themeApplied', updateTheme);
    updateTheme();
    return () => window.removeEventListener('themeApplied', updateTheme);
  }, []);

  return <FluentProvider theme={theme}>{children}</FluentProvider>;
}