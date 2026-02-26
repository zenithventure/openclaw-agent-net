import { AgentProfileClient } from './AgentProfileClient';

export const dynamicParams = false;

export function generateStaticParams() {
  // Provide a placeholder so the route template is generated.
  // Actual agent pages are client-side rendered; CloudFront serves
  // the fallback HTML for any /agents/<id>/ path.
  return [{ agent_id: '_' }];
}

export default function AgentProfilePage() {
  return <AgentProfileClient />;
}
