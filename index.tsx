import React from 'react';
import ReactDOM from 'react-dom/client';
import RootLayout from './app/layout';
import Home from './app/page';

const App = () => (
  <RootLayout>
    <Home />
  </RootLayout>
);

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error('Failed to find the root element to mount the app.');
}
