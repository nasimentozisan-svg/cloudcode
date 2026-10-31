import type { ReactNode } from "react";

/** Only receive the current channel's server-authorized display names.
 * Native disclosure works without hydration and supports keyboard activation.
 * This does not provide a directory or change channel membership.
 */
export default function ChannelParticipants({
  members,
  children,
}: {
  members: { id: string; name: string }[];
  children?: ReactNode;
}) {
  return (
    <details className="mt-3 rounded-xl border border-gray-200 bg-white">
      <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-medium text-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600">
        参加者（{members.length}人）
      </summary>
      <div className="border-t border-gray-100 px-4 py-3">
        <p className="mb-2 text-xs text-gray-500">
          このチャンネルを閲覧できるメンバーです。
        </p>
        {members.length === 0 ? (
          <p className="text-sm text-gray-500">参加者はいません。</p>
        ) : (
          <ul aria-label="参加者一覧" className="max-h-64 space-y-2 overflow-y-auto text-sm text-gray-700">
            {members.map((member) => (
              <li key={member.id} className="break-words">{member.name}</li>
            ))}
          </ul>
        )}
        {children}
      </div>
    </details>
  );
}
