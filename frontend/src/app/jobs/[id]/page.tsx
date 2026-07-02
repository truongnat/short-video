'use client';

import { useParams } from 'next/navigation';
import JobsView from '@/components/JobsView';

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const selectedJobId = typeof params?.id === 'string' ? params.id : null;

  return <JobsView selectedJobId={selectedJobId} />;
}
