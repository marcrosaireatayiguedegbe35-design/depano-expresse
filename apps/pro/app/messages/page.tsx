'use client';

import { Blob, PageHead } from '@/components/ds';
import { ConversationList } from '@/components/conversations';

/** Messages : demandes de contact des clients et discussions. */
export default function MessagesPage() {
  return (
    <div className="screen">
      <Blob />
      <PageHead title="Messages clients" back="/demandes" />
      <ConversationList />
    </div>
  );
}
