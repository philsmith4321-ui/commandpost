import OutreachEmailQueue from '@/components/outreach-email-queue';
import OutreachSequence from '@/components/outreach-sequence';

export default function Page() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-white mb-4">Email Queue</h1>
      <OutreachEmailQueue />
      <OutreachSequence />
    </div>
  );
}
