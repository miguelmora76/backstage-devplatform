import { useRef, useState } from 'react';
import Button from '@material-ui/core/Button';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import { useGuardrails } from '../context';
import type { DemoUser } from '../api/types';
import { roleLabelKey, t } from '../texts/texts';
import { srOnly } from './srOnly';

export interface DemoUserSwitchProps {
  users: DemoUser[];
  /** Name of the user the plugin acts as. */
  currentName: string;
  /** Called after a successful switch (the view clears its banner). */
  onSwitched: () => void;
}

/**
 * The demo-user menu button (BR5.1, BR5.2, BR5.4). It is only rendered when
 * the backend gave a user list (NFR5.9), and it offers only users from that
 * list. After a switch it announces the new user politely; focus returns to
 * the button.
 */
export function DemoUserSwitch({
  users,
  currentName,
  onSwitched,
}: DemoUserSwitchProps) {
  const { session } = useGuardrails();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);

  const choose = async (user: DemoUser) => {
    setAnchor(null);
    const changed = await session.select(user.userId);
    if (changed) {
      onSwitched();
      setAnnouncement(t('status.signedIn', { name: user.name }));
    } else {
      setAnnouncement(t('error.generic'));
    }
    buttonRef.current?.focus();
  };

  return (
    <>
      <Button
        ref={buttonRef}
        variant="outlined"
        size="small"
        aria-haspopup="menu"
        aria-expanded={anchor ? 'true' : undefined}
        aria-label={t('label.switchUser', { name: currentName })}
        data-testid="switch-user"
        onClick={e => setAnchor(e.currentTarget)}
      >
        {currentName}
      </Button>
      <Menu
        anchorEl={anchor}
        keepMounted={false}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        aria-label={t('label.demoUsers')}
      >
        {users.map(u => (
          <MenuItem key={u.userId} onClick={() => choose(u)}>
            {t('text.userWithRole', {
              name: u.name,
              role: t(roleLabelKey(u.role)),
            })}
          </MenuItem>
        ))}
      </Menu>
      <span role="status" aria-live="polite" style={srOnly}>
        {announcement}
      </span>
    </>
  );
}
