import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AppProvider } from './context/AppContext.jsx';

/* الخطوط مضمّنة ذاتيًا (self-hosted) — لا طلبات خارجية، تعمل داخل تلجرام بلا CDN.
   Inter للاتينية والأرقام، IBM Plex Sans Arabic للعربية. */
import '@fontsource-variable/inter/index.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';

import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>
);
