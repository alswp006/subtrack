import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Home from './pages/Home';
import SubscriptionNew from './pages/SubscriptionNew';
import SubscriptionDetail from './pages/SubscriptionDetail';
import SubscriptionEdit from './pages/SubscriptionEdit';
import Checklist from './pages/Checklist';
import Compare from './pages/Compare';

// Dev-only TDS Gallery route — `import.meta.env.DEV` is statically replaced
// (true in dev, false in prod) so the entire import + Route is tree-shaken
// from production builds. Verify with: `grep -r "TdsGallery" dist/` → empty.
const DevTdsGallery = import.meta.env.DEV
  ? lazy(() => import('./pages/__TdsGallery'))
  : null;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/subscriptions/new" element={<SubscriptionNew />} />
      <Route path="/subscriptions/:id" element={<SubscriptionDetail />} />
      <Route path="/subscriptions/:id/edit" element={<SubscriptionEdit />} />
      <Route path="/subscriptions/:id/checklist" element={<Checklist />} />
      <Route path="/compare" element={<Compare />} />
      {DevTdsGallery && (
        <Route
          path="/__tds-gallery"
          element={
            <Suspense fallback={null}>
              <DevTdsGallery />
            </Suspense>
          }
        />
      )}
    </Routes>
  );
}
