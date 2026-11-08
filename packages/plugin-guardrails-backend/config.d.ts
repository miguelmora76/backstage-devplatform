export interface Config {
  /** Settings of the guardrails plugin (contract C3). */
  guardrails?: {
    server?: {
      /**
       * Address of the guardrails server (MCP endpoint is `<url>/mcp`, health
       * route is `<url>/healthz`). No default in code.
       * @visibility backend
       */
      url?: string;
      /**
       * Read timeout in milliseconds. Default 3000.
       * @visibility backend
       */
      readTimeoutMs?: number;
      /**
       * Write timeout in milliseconds. Default 10000, kept below the 30 second
       * claim release.
       * @visibility backend
       */
      writeTimeoutMs?: number;
    };
    demoSignIn?: {
      /**
       * Turns on the passwordless `demo` sign-in provider and the open list of
       * demo users. Default false. Never turn this on in a hosted copy.
       * @visibility backend
       */
      enabled?: boolean;
    };
  };
}
