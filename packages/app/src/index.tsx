import ReactDOM from 'react-dom/client';
// Backstage's page shell (header, navigation, tabs) is built from Backstage UI
// components; this stylesheet is what styles them (FR1.1).
import '@backstage/ui/css/styles.css';
import App from './App';

// Entry point (excluded from coverage): mounts the app.
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(App);
