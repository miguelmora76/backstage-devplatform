import { useEffect, useReducer, useRef, useState } from 'react';
import type { IdentityApi } from '@backstage/frontend-plugin-api';
import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import Paper from '@material-ui/core/Paper';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import { createIdentityHolder } from './identityHolder';
import { createRequestGuard, type SignInClient } from './signInClient';
import { initialSignInState, reduceSignIn, type DemoUser } from './signInState';
import { roleLabel, signInStrings } from './strings';

// Every colour and space comes from the active theme (dark by default), so
// the page matches the rest of the app in both themes (FR1.2, FR2.2).
const useStyles = makeStyles(theme => ({
  page: {
    minHeight: '100vh',
    boxSizing: 'border-box',
    padding: theme.spacing(8, 2),
    backgroundColor: theme.palette.background.default,
    color: theme.palette.text.primary,
  },
  container: {
    maxWidth: 640,
    padding: 0,
  },
  users: {
    padding: 0,
  },
  userText: {
    flex: 1,
    minWidth: 0,
  },
}));

export interface SignInPageProps {
  client: SignInClient;
  /** Called once, with the identity of the chosen demo user. */
  onSignInSuccess(identityApi: IdentityApi): void;
}

/**
 * The first screen of the app: the three demo users, or a text that the demo
 * sign-in is off (BR2.2). All behavior is in `reduceSignIn`; this component
 * reads the list, starts the sign-in and shows the current state as text and
 * real buttons. Names and roles are text children, never markup (NFR5.5).
 */
export function SignInPage({ client, onSignInSuccess }: SignInPageProps) {
  const [state, dispatch] = useReducer(reduceSignIn, initialSignInState);
  const [guard] = useState(createRequestGuard);
  // Set in the same tick as the press, so a second activation inside one
  // frame sends no second request (NFR1.2).
  const pressed = useRef(false);

  useEffect(() => {
    if (state.kind !== 'loading') {
      return;
    }
    const request = guard.next();
    client.listUsers().then(result => {
      if (!guard.isCurrent(request)) {
        return;
      }
      if (result.status === 'ok') {
        dispatch({ type: 'listLoaded', users: result.users });
      } else if (result.status === 'off') {
        dispatch({ type: 'listOff' });
      } else {
        dispatch({ type: 'listFailed' });
      }
    });
  }, [state.kind, client, guard]);

  function choose(userId: string) {
    if (
      pressed.current ||
      (state.kind !== 'choosing' && state.kind !== 'signInFailed') ||
      !state.users.some(user => user.userId === userId)
    ) {
      return;
    }
    pressed.current = true;
    dispatch({ type: 'choose', userId });
    client.start(userId).then(answer => {
      if (answer) {
        dispatch({ type: 'startSucceeded' });
        onSignInSuccess(createIdentityHolder(answer));
      } else {
        pressed.current = false;
        dispatch({ type: 'startFailed' });
      }
    });
  }

  const classes = useStyles();

  return (
    <main className={classes.page} data-testid="sign-in-page">
      <Container
        maxWidth={false}
        className={classes.container}
        data-testid="sign-in-container"
      >
        <Typography variant="h3" component="h1" gutterBottom>
          {signInStrings.title}
        </Typography>
        <Body
          state={state}
          onChoose={choose}
          onRetry={() => dispatch({ type: 'retry' })}
        />
      </Container>
    </main>
  );
}

function Body(props: {
  state: ReturnType<typeof reduceSignIn>;
  onChoose(userId: string): void;
  onRetry(): void;
}) {
  const { state } = props;
  switch (state.kind) {
    case 'loading':
      return (
        <Typography role="status" data-testid="sign-in-loading">
          {signInStrings.loading}
        </Typography>
      );
    case 'demoOff':
      return (
        <Typography role="alert" data-testid="sign-in-off">
          {signInStrings.off}
        </Typography>
      );
    case 'listFailed':
      return (
        <>
          <Typography role="alert" data-testid="sign-in-load-failed">
            {signInStrings.loadFailed}
          </Typography>
          <Button
            variant="contained"
            color="inherit"
            onClick={props.onRetry}
            data-testid="sign-in-retry"
          >
            {signInStrings.retry}
          </Button>
        </>
      );
    case 'signedIn':
      return null;
    default:
      return (
        <>
          <Typography paragraph>{signInStrings.intro}</Typography>
          {state.kind === 'signInFailed' && (
            <Typography role="alert" data-testid="sign-in-failed">
              {signInStrings.failed}
            </Typography>
          )}
          {state.kind === 'starting' && (
            <Typography role="status">{signInStrings.working}</Typography>
          )}
          <UserList
            users={state.users}
            workingUserId={state.kind === 'starting' ? state.userId : undefined}
            onChoose={props.onChoose}
          />
        </>
      );
  }
}

function UserList(props: {
  users: DemoUser[];
  workingUserId: string | undefined;
  onChoose(userId: string): void;
}) {
  const classes = useStyles();
  const busy = props.workingUserId !== undefined;
  return (
    <Paper>
      <List aria-label={signInStrings.title} className={classes.users}>
        {props.users.map(user => (
          <ListItem key={user.userId} divider>
            <div className={classes.userText}>
              <Typography component="span" variant="subtitle1">
                {user.name}
              </Typography>
              <Typography
                component="span"
                display="block"
                color="textSecondary"
                id={`sign-in-role-${user.userId}`}
              >
                {roleLabel(user.role)}
              </Typography>
            </div>
            <Button
              variant="outlined"
              color="inherit"
              disabled={busy}
              aria-label={signInStrings.choose(user.name)}
              aria-describedby={`sign-in-role-${user.userId}`}
              onClick={() => props.onChoose(user.userId)}
              data-testid={`sign-in-choose-${user.userId}`}
            >
              {props.workingUserId === user.userId
                ? signInStrings.working
                : signInStrings.action}
            </Button>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}
