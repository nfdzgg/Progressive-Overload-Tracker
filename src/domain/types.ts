// Domain model from SPEC section 4. All ids are UUID strings. Dates are local
// calendar dates as YYYY-MM-DD. Weeks start on Monday.

/** Local calendar date, `YYYY-MM-DD`. */
export type ISODate = string;

export type Unit = 'lb' | 'kg';

export type ExerciseType = 'legCompound' | 'upperCompound' | 'largeIsolation' | 'smallIsolation';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs';

export interface Variant {
  id: string;
  name: string;
  note: string;
  archived: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;
  /** One primary group, used for weekly set counts. */
  muscleGroup: MuscleGroup;
  /** Default 2, range 1–10. */
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  /** At least one. */
  variants: Variant[];
  /** The "main way", preselected on the card. */
  defaultVariantId: string;
  /** Default false. */
  perSetWeight: boolean;
  archived: boolean;
}

/** `exerciseIds` is ordered. */
export interface Workout {
  id: string;
  name: string;
  exerciseIds: string[];
}

export type CycleItem = { kind: 'workout'; workoutId: string } | { kind: 'rest' };

export interface CycleState {
  /** Ordered, repeats forever. */
  items: CycleItem[];
  /** Index of the next item. */
  pointer: number;
  /** Date the pointer arrived at this item. */
  pointerSince: ISODate;
  /** Date a scheduled restart takes effect. */
  restartOn: ISODate | null;
}

export interface Session {
  id: string;
  date: ISODate;
  workoutId: string;
  /** Snapshot, so history survives renames. */
  workoutName: string;
  deload: boolean;
  status: 'inProgress' | 'finished';
  /** Epoch ms when created; orders sessions that share a date. (Addition, see PROGRESS.md.) */
  createdAt: number;
}

/** `weight` is used only when the exercise has `perSetWeight`. */
export interface SetLog {
  reps: number | null;
  weight: number | null;
}

export interface LogEntry {
  id: string;
  sessionId: string;
  date: ISODate;
  exerciseId: string;
  variantId: string;
  /** Unit the entry was typed in. */
  unit: Unit;
  /** null = bodyweight / no weight. */
  weight: number | null;
  sets: SetLog[];
  status: 'draft' | 'logged' | 'skipped';
  swappedFromExerciseId: string | null;
  /** Epoch ms when created; orders entries that share a date. (Addition, see PROGRESS.md.) */
  createdAt: number;
}

export interface Settings {
  /** Default 'lb'. */
  unit: Unit;
  /** Default true. */
  restTimerEnabled: boolean;
  /** Default true. */
  restTimerSound: boolean;
  lastExportAt: string | null;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  unit: 'lb',
  restTimerEnabled: true,
  restTimerSound: true,
  lastExportAt: null,
  onboarded: false,
};
