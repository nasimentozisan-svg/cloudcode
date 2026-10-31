"use client";

import { useActionState, useState } from "react";
import { addChannelParticipantAction, type ParticipantActionState } from "@/lib/actions/channel-participants";
import SubmitButton from "@/components/SubmitButton";

export default function ChannelParticipantInvite({ channelId, candidates }: {
  channelId: string;
  candidates: { id: string; name: string; categoryLabel: string }[];
}) {
  const [state, action, pending] = useActionState<ParticipantActionState, FormData>(
    addChannelParticipantAction.bind(null, channelId), {}
  );
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const selected = candidates.find(member => member.id === selectedId);
  const matches = candidates.filter(member => member.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  return (
    <details className="mt-4 border-t border-gray-100 pt-3">
      <summary className="cursor-pointer py-2 text-sm font-medium text-emerald-700">個人を招待・追加</summary>
      <p className="my-2 text-xs leading-relaxed text-gray-600">
        登録済みのメンバーを1人ずつ追加できます。追加すると過去の投稿もすぐに閲覧できます。承認待ちや招待通知の送信はありません。
      </p>
      {candidates.length === 0 ? <p className="text-sm text-gray-500">追加できるメンバーはいません。</p> : (
        <form action={action} className="space-y-3">
          <label className="block text-sm text-gray-700">
            名前で絞り込む
            <input type="search" value={query} onChange={e => setQuery(e.target.value)} disabled={pending}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-base" />
          </label>
          <label className="block text-sm text-gray-700">
            追加するメンバー
            <select name="memberId" required value={selected?.id ?? ""} disabled={pending}
              onChange={e => setSelectedId(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-base">
              <option value="">選択してください</option>
              {selected && !matches.some(member => member.id === selected.id) && <option value={selected.id}>{selected.name}（{selected.categoryLabel || "カテゴリー未設定"}）</option>}
              {matches.map(member => <option key={member.id} value={member.id}>{member.name}（{member.categoryLabel || "カテゴリー未設定"}）</option>)}
            </select>
          </label>
          {matches.length === 0 && <p className="text-sm text-gray-500">検索に一致するメンバーはいません。</p>}
          {selected && <p className="text-sm text-gray-700">追加する人：<strong>{selected.name}（{selected.categoryLabel || "カテゴリー未設定"}）</strong></p>}
          <SubmitButton>選んだメンバーを追加</SubmitButton>
        </form>
      )}
      {state.error && <p role="alert" className="mt-2 text-sm text-red-700">{state.error}</p>}
      {state.success && <p role="status" className="mt-2 text-sm text-emerald-700">{state.success}</p>}
    </details>
  );
}
