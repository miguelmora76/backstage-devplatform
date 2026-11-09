// Lint fixture: this file must FAIL the app lint (NFR5.5, NFR5.3, NFR1.5, NFR1.9, NFR5.4).
let shared = 0;
export const Bad = ({ html }: { html: string }) => {
  shared += 1;
  console.log(localStorage.getItem('token'));
  return <div dangerouslySetInnerHTML={{ __html: html }} data-n={shared} />;
};
export const address = 'https://example.com';
export const port = 'host:7007';
