import { useId } from 'react';
import { APP_BUILD, APP_VERSION, usePwaStatus } from '../../app/pwa';
import { Badge, Card, ListGroup, ListItem, ListRow, SectionLabel } from '../../ui';
import styles from './Settings.module.css';

/** App version, update notes (never a blocking prompt), and how to install. */
export function AboutSection() {
  const labelId = useId();
  const { updated, updateWaiting } = usePwaStatus();

  return (
    <section aria-labelledby={labelId}>
      <SectionLabel id={labelId}>About</SectionLabel>
      <Card variant="group">
        <ListGroup label="About">
          <ListItem>
            <ListRow
              title="Version"
              detail={updateWaiting ? 'Update ready, applies next launch' : undefined}
              trailing={
                <>
                  {updated && <Badge>Updated</Badge>}
                  <span className={styles.numbers}>
                    {APP_VERSION} ({APP_BUILD})
                  </span>
                </>
              }
            />
          </ListItem>
          <ListItem>
            <ListRow
              title="Install"
              detail="iPhone: open the app in Safari, tap Share, then Add to Home Screen. Desktop: use the install icon in the address bar or the browser menu."
            />
          </ListItem>
        </ListGroup>
      </Card>
    </section>
  );
}
