// Lint fixture: this file must FAIL the backend lint (NFR1.5, NFR5.4).
let counter = 0;
export const next = () => (counter += 1);
export const base = 'http://example.com/api';
export const port = 'localhost:7007';
