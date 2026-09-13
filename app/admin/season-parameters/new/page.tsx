import { requireAdmin } from "@/lib/auth/session";
import SeasonParametersForm from "../SeasonParametersForm";

export default async function NewSeasonParametersPage() {
  await requireAdmin("/admin/season-parameters/new");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <h1 className="text-xl font-bold">年度設定を追加</h1>
      <SeasonParametersForm mode="create" />
    </div>
  );
}
