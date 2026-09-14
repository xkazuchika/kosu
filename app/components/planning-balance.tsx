type PlanningBalanceValue = {
  isActive: boolean;
  isConfirmed: boolean;
  balanceHours: number | null;
};

export function PlanningBalance({ value }: { value: PlanningBalanceValue }) {
  if (!value.isActive)
    return <span className="text-slate-500">無効メンバー（配分対象外）</span>;
  if (value.balanceHours === null)
    return <span className="text-slate-500">稼働可能時間が未設定</span>;
  if (value.balanceHours < 0)
    return (
      <span className="font-medium text-amber-700">
        予定超過 {Math.abs(value.balanceHours)}h
      </span>
    );
  if (!value.isConfirmed)
    return (
      <span className="text-slate-500">
        未確認（仮の残り {value.balanceHours}h）
      </span>
    );
  return (
    <span className="font-medium text-emerald-700">
      予定上の余力 {value.balanceHours}h
    </span>
  );
}
