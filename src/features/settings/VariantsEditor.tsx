import { useId, useState } from 'react';
import {
  addVariant,
  removeVariant,
  renameVariant,
  reorderVariants,
  setDefaultVariant,
  variantHasHistory,
} from '../../data';
import type { Exercise, Variant } from '../../domain';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  IconButton,
  SectionLabel,
  Select,
  Stack,
  Text,
} from '../../ui';
import { moveItem } from './cycleEdit';
import { EditList, EditRow } from './EditRow';
import { validateVariantName } from './exerciseForm';
import { NameSheet } from './NameSheet';

interface Removal {
  variant: Variant;
  hasHistory: boolean;
}

/**
 * Variants of an exercise: add, rename, reorder, archive or delete, and the
 * default ("main way", preselected on Today). Archived variants are hidden.
 * An exercise keeps at least one active variant.
 */
export function VariantsEditor({ exercise }: { exercise: Exercise }) {
  const labelId = useId();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removal, setRemoval] = useState<Removal | null>(null);

  const active = exercise.variants.filter((v) => !v.archived);
  const activeIds = active.map((v) => v.id);
  const editing = active.find((v) => v.id === editingId);
  const canRemove = active.length > 1;

  async function askRemove(variant: Variant) {
    setEditingId(null);
    setRemoval({ variant, hasHistory: await variantHasHistory(exercise.id, variant.id) });
  }

  return (
    <section aria-labelledby={labelId}>
      <SectionLabel id={labelId}>Variants</SectionLabel>
      <Stack gap="sm">
        <Card variant="group">
          <EditList label={`Variants of ${exercise.name}`}>
            {active.map((v, i) => (
              <EditRow
                key={v.id}
                name={v.name}
                badge={v.id === exercise.defaultVariantId ? <Badge>Default</Badge> : undefined}
                index={i}
                count={active.length}
                onMove={(from, to) =>
                  void reorderVariants(exercise.id, moveItem(activeIds, from, to))
                }
                actions={
                  <IconButton
                    icon="edit"
                    label={`Edit ${v.name}`}
                    onClick={() => setEditingId(v.id)}
                  />
                }
              />
            ))}
          </EditList>
        </Card>
        {active.length > 1 && (
          <Stack gap="xs">
            <Select
              label="Default variant"
              options={active.map((v) => ({ value: v.id, label: v.name }))}
              value={exercise.defaultVariantId}
              onValueChange={(id) => void setDefaultVariant(exercise.id, id)}
            />
            <Text as="p" variant="caption" tone="tertiary">
              Preselected on Today. Each variant keeps its own history.
            </Text>
          </Stack>
        )}
        <Button fullWidth onClick={() => setAdding(true)}>
          Add variant
        </Button>
      </Stack>

      <NameSheet
        open={adding}
        title="Add variant"
        label="Variant name"
        placeholder="e.g. Machine"
        confirmLabel="Add variant"
        validate={(name) => validateVariantName(name, exercise.variants)}
        onClose={() => setAdding(false)}
        onSubmit={async (name) => {
          await addVariant(exercise.id, name);
          setAdding(false);
        }}
      />

      <NameSheet
        open={!!editing}
        title="Edit variant"
        label="Variant name"
        confirmLabel="Save"
        initialValue={editing?.name}
        validate={(name) => validateVariantName(name, exercise.variants, editing?.id)}
        onClose={() => setEditingId(null)}
        onSubmit={async (name) => {
          if (editing) await renameVariant(exercise.id, editing.id, name);
          setEditingId(null);
        }}
      >
        {editing &&
          (canRemove ? (
            <Stack gap="xs" align="start">
              <Button variant="destructive" onClick={() => void askRemove(editing)}>
                Remove variant
              </Button>
            </Stack>
          ) : (
            <Text as="p" variant="body-sm" tone="subtle">
              This is the only variant. An exercise needs at least one, so it cannot be removed.
            </Text>
          ))}
      </NameSheet>

      <ConfirmDialog
        open={!!removal}
        title={`${removal?.hasHistory ? 'Archive' : 'Delete'} ${removal?.variant.name ?? ''}?`}
        message={
          removal?.hasHistory
            ? `${removal.variant.name} has logged history, so it is archived: it disappears from Today and pickers, and its history, charts, and PRs stay.`
            : `${removal?.variant.name ?? ''} has no logged history, so it is deleted for good.`
        }
        confirmLabel={removal?.hasHistory ? 'Archive' : 'Delete'}
        tone="destructive"
        onCancel={() => setRemoval(null)}
        onConfirm={() => {
          const target = removal;
          setRemoval(null);
          if (target) void removeVariant(exercise.id, target.variant.id);
        }}
      />
    </section>
  );
}
