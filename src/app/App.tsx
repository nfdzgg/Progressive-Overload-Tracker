import { HashRouter, Route, Routes } from 'react-router';
import { KitchenSink } from '../ui/KitchenSink';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/kitchen-sink" element={<KitchenSink />} />
        <Route
          path="*"
          element={
            <main>
              <h1>Overload</h1>
            </main>
          }
        />
      </Routes>
    </HashRouter>
  );
}
