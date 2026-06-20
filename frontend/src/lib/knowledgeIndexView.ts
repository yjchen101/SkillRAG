import type { KnowledgeIndexStatus } from "@/lib/api";

export type KnowledgeIndexView = {
  label: string;
  hint: string;
  hintClassName: string;
};

const NORMAL_HINT_CLASS = "bg-[rgba(15,139,141,0.12)] text-ocean";
const WARNING_HINT_CLASS = "bg-[rgba(212,106,74,0.14)] text-[var(--color-ember)]";

export function getKnowledgeIndexView(
  status: KnowledgeIndexStatus | null
): KnowledgeIndexView {
  if (status?.building) {
    return {
      label: "索引重建中",
      hint: "知识索引构建中",
      hintClassName: NORMAL_HINT_CLASS
    };
  }

  if (status?.needs_rebuild) {
    return {
      label: "重建索引",
      hint: `${status.stale_files ?? 0} 个知识文件待索引`,
      hintClassName: WARNING_HINT_CLASS
    };
  }

  if (status?.ready) {
    return {
      label: "重建索引",
      hint: `知识索引已就绪 · ${status.indexed_files} 个文件`,
      hintClassName: NORMAL_HINT_CLASS
    };
  }

  return {
    label: "重建索引",
    hint: "知识索引未就绪",
    hintClassName: WARNING_HINT_CLASS
  };
}
