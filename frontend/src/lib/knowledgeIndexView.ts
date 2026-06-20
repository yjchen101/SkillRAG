import type { KnowledgeIndexStatus } from "@/lib/api";

export type KnowledgeIndexView = {
  label: string;
  hint: string;
  hintClassName: string;
  title: string;
};

const NORMAL_HINT_CLASS = "bg-[rgba(15,139,141,0.12)] text-ocean";
const WARNING_HINT_CLASS = "bg-[rgba(212,106,74,0.14)] text-[var(--color-ember)]";

export function getKnowledgeBackendLabel(status: KnowledgeIndexStatus | null) {
  if (!status) {
    return "向量检索/BM25 关键词检索未就绪";
  }

  if (status.vector_ready && status.bm25_ready) {
    return "向量检索/BM25 关键词检索已就绪";
  }

  if (status.vector_ready) {
    return "仅向量检索就绪";
  }

  if (status.bm25_ready) {
    return "仅 BM25 关键词检索就绪";
  }

  return "向量检索/BM25 关键词检索未就绪";
}

export function getKnowledgeIndexView(
  status: KnowledgeIndexStatus | null
): KnowledgeIndexView {
  const backendLabel = getKnowledgeBackendLabel(status);

  if (status?.building) {
    return {
      label: "索引重建中",
      hint: `知识索引构建中 · ${backendLabel}`,
      hintClassName: NORMAL_HINT_CLASS,
      title: "知识索引正在构建，请稍候"
    };
  }

  if (status?.needs_rebuild) {
    return {
      label: "重建索引",
      hint: `${status.stale_files ?? 0} 个知识文件待索引 · ${backendLabel}`,
      hintClassName: WARNING_HINT_CLASS,
      title: "重建知识索引"
    };
  }

  if (status?.ready) {
    return {
      label: "重建索引",
      hint: `知识索引已就绪 · ${status.indexed_files} 个文件 · ${backendLabel}`,
      hintClassName: NORMAL_HINT_CLASS,
      title: "重建知识索引"
    };
  }

  return {
    label: "重建索引",
    hint: `知识索引未就绪 · ${backendLabel}`,
    hintClassName: WARNING_HINT_CLASS,
    title: "重建知识索引"
  };
}
