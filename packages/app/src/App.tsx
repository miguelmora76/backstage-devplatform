import { createApp } from '@backstage/frontend-defaults';
import { appFeatures } from './features';

// Bootstrap file (excluded from coverage): creates the app from the feature list.
export default createApp({ features: appFeatures }).createRoot();
