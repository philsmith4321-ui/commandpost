import { redirect } from 'next/navigation';

// The Radio/Video tool now lives at /content. Keep this path working for the
// "CommandPost Ingest" droplet and any existing links.
export default function VideoRedirect() {
  redirect('/content');
}
