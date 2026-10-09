import { Navigate, Route, Routes } from 'react-router';
import { CyclePage } from './CyclePage';
import { ExercisePage } from './ExercisePage';
import { ExercisesPage } from './ExercisesPage';
import { NewExercisePage } from './NewExercisePage';
import { SettingsHome } from './SettingsHome';
import { WorkoutPage } from './WorkoutPage';
import { WorkoutsPage } from './WorkoutsPage';

/** The Settings tab (`/settings/*`) and its sub-pages. */
export function SettingsScreen() {
  return (
    <Routes>
      <Route index element={<SettingsHome />} />
      <Route path="cycle" element={<CyclePage />} />
      <Route path="workouts" element={<WorkoutsPage />} />
      <Route path="workouts/:workoutId" element={<WorkoutPage />} />
      <Route path="exercises" element={<ExercisesPage />} />
      <Route path="exercises/new" element={<NewExercisePage />} />
      <Route path="exercises/:exerciseId" element={<ExercisePage />} />
      <Route path="*" element={<Navigate to="/settings" replace />} />
    </Routes>
  );
}
