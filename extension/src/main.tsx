import React from 'react';
import ReactDOM from 'react-dom/client';
import * as SDK from 'azure-devops-extension-sdk';
import App from './app/CloudOpsApp';
import { AzureDevOpsThemeProvider } from './app/providers/AzureDevOpsThemeProvider';
import type { AdoContext } from './app/types';
import './styles.css';

async function bootstrap() {
  let adoContext: AdoContext = {};
  try {
    await SDK.init();
    await SDK.ready();
    const user = SDK.getUser();
    const context = SDK.getWebContext();
    adoContext = {
      userName: user?.displayName,
      userId: user?.id,
      organization: SDK.getHost()?.name,
      project: context?.project?.name,
      projectId: context?.project?.id,
      contributionId: SDK.getContributionId(),
    };
  } catch {
    // Running standalone in Vite for local UI development.
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AzureDevOpsThemeProvider>
        <App adoContext={adoContext} />
      </AzureDevOpsThemeProvider>
    </React.StrictMode>,
  );
}

void bootstrap();
