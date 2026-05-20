// Server Component — imports a Client Component that handles ssr:false
// This is the correct Next.js 15 App Router pattern.
import ClientRoot from './client-root';

export default function Page() {
  return <ClientRoot />;
}
