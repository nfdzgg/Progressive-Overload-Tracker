import type { Session } from '../../domain';
import { Badge } from '../../ui';

/** Today's top bar accessory: a neutral "Deload" badge while the session is a deload. */
export function DeloadBadge({ session }: { session: Session | null }) {
  return session?.deload ? <Badge>Deload</Badge> : null;
}
