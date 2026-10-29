import { useMemo, useState } from "react";
import { HOME_DOMAINS } from "@/lib/home-workspace.mjs";
import { relationSelection } from "./relations-state.mjs";
import ArchiveReader from "./ArchiveReader";
import type { Mutate } from "./ArchiveReader";
import type { PrivateLibraryState } from "./private-library";
import type { Article } from "./types";
export default function RelationsView({
  snapshot,
  index,
  archives,
  relations,
  library,
  mutate,
  startId,
  onBack,
  onRemove,
}: {
  snapshot: any;
  index: any;
  archives: any;
  relations: any;
  library: PrivateLibraryState | null;
  mutate: Mutate;
  startId: string;
  onBack: () => void;
  onRemove: (a: Article) => void;
}) {
  const [topic, setTopic] = useState("all"),
    [word, setWord] = useState(""),
    [rootId, setRoot] = useState(""),
    [selected, setSelected] = useState(startId),
    [collapsed, setCollapsed] = useState(false),
    [tab, setTab] = useState("text");
  const nodes = relations?.nodes || [],
    edges = relations?.edges || [],
    byId = useMemo(
      () =>
        new Map<string, Article>(
          (snapshot?.articles || []).map((a: Article) => [a.id, a]),
        ),
      [snapshot],
    );
  const words = (index?.keywords || []).filter(
    (w: any) => !w.inactive && (topic === "all" || w.group === topic),
  );
  const matchingIds = new Set(
    nodes
      .filter(
        (n: any) =>
          byId.has(n.id) &&
          (topic === "all" ||
            (topic === "other" && !n.terms.length) ||
            n.terms.some((t: string) =>
              words.some((w: any) => w.term === t),
            )) &&
          (!word || n.terms.includes(word)),
      )
      .map((n: any) => n.id),
  );
  const { matching, candidates, root, descendants, chosen, evidence } =
    relationSelection(
      nodes,
      edges,
      matchingIds,
      rootId,
      selected,
      topic === "all" && !word ? startId : "",
    );
  const rootEdges = root ? edges.filter((e: any) => e.from === root.id) : [],
    article = byId.get(chosen);
  const related = (relations?.related || [])
      .filter((r: any) => r.from === root?.id)
      .slice(0, 20),
    unmatched = matching
      .filter((n: any) => (relations?.unmatched || []).includes(n.id))
      .slice(0, 30);
  return (
    <>
      <section className="r-topichead">
        <div>
          <button type="button" className="p4-button p4-quiet" onClick={onBack}>
            ← 返回政策动态
          </button>
          <h1>中央—地方</h1>
          <p>从明确的正文引用读文件之间的关系。引用不等于落实成效。</p>
        </div>
        <label>
          主题{" "}
          <select
            aria-label="选择脉络主题"
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              setWord("");
              setRoot("");
              setSelected("");
            }}
          >
            <option value="all">全部主题</option>
            {HOME_DOMAINS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      </section>
      <div className="r-words">
        <button
          type="button"
          className="r-word"
          aria-pressed={!word}
          onClick={() => {
            setWord("");
            setRoot("");
          }}
        >
          全部关键词
        </button>
        {words.slice(0, 24).map((w: any) => (
          <button
            type="button"
            className="r-word"
            key={w.term}
            aria-pressed={word === w.term}
            onClick={() => {
              setWord(word === w.term ? "" : w.term);
              setRoot("");
              setSelected("");
            }}
          >
            {w.term}
          </button>
        ))}
      </div>
      <div className="v4-root-select">
        <label>
          起点文件
          <select
            aria-label="选择实际起点文件"
            value={root?.id || ""}
            onChange={(e) => {
              setRoot(e.target.value);
              setSelected(e.target.value);
            }}
          >
            {!candidates.length && <option value="">无匹配文件</option>}
            {candidates.map((n: any) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
        </label>
        <span>
          {rootEdges.length}条直接引用 · {descendants.length}份下游引用文件
        </span>
      </div>
      <div className="r-link-layout" data-collapsed={collapsed}>
        <aside className="r-tree" data-collapsed={collapsed}>
          <header className="r-tree-head">
            <span>{!collapsed && "文件引用脉络"}</span>
            <button
              type="button"
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? "展开 ＋" : "收起 −"}
            </button>
          </header>
          {!collapsed && (
            <>
              <div className="r-tree-group">
                <span>起点文件</span>
                {root && (
                  <button
                    type="button"
                    className="r-tree-item"
                    aria-pressed={chosen === root.id}
                    onClick={() => setSelected(root.id)}
                  >
                    <strong>{root.title}</strong>
                    <small>{root.issuer || "发文机关未识别"}</small>
                  </button>
                )}
              </div>
              {descendants.map((e) => {
                const n = nodes.find((n: any) => n.id === e.to);
                return (
                  <div className="r-tree-group" data-local="true" key={e.id}>
                    <span>{n?.region || "地区未识别"} · 正文引用</span>
                    <button
                      type="button"
                      className="r-tree-item"
                      aria-pressed={chosen === e.to}
                      onClick={() => {
                        setSelected(e.to);
                        setTab("text");
                      }}
                    >
                      <strong>{byId.get(e.to)?.title}</strong>
                      <small>
                        {n?.issuer || "发文机关未识别"} · 层级{e.depth}
                      </small>
                    </button>
                  </div>
                );
              })}
              {!descendants.length && (
                <p className="p4-empty">此文件尚无可核实的下游正文引用。</p>
              )}
              <div className="r-tree-related">
                <span>主题相关 · 未确认引用</span>
                {related.map((r: any) => (
                  <button
                    type="button"
                    className="r-tree-item"
                    key={r.to}
                    onClick={() => {
                      setTopic("all");
                      setWord("");
                      setRoot(r.to);
                      setSelected(r.to);
                      setTab("text");
                    }}
                  >
                    <strong>{byId.get(r.to)?.title}</strong>
                  </button>
                ))}
                {!related.length && <p className="p4-kicker">暂无主题候选</p>}
              </div>
            </>
          )}
        </aside>
        <section className="r-mainreading">
          <div className="r-reader-context">
            <span>{evidence ? "已核实正文引用" : "独立文件阅读"}</span>
            <div>
              <button
                type="button"
                className="p4-button"
                aria-pressed={tab === "text"}
                onClick={() => setTab("text")}
              >
                连续阅读
              </button>
              <button
                type="button"
                className="p4-button"
                aria-pressed={tab === "evidence"}
                onClick={() => setTab("evidence")}
              >
                引用证据
              </button>
            </div>
          </div>
          <div className="r-mainreading-content">
            {tab === "evidence" ? (
              evidence ? (
                <div className="p4-evidence">
                  <strong>《{byId.get(evidence.from)?.title}》</strong>
                  <blockquote>{evidence.evidence.excerpt}</blockquote>
                  <p>
                    识别依据：
                    {evidence.evidence.match === "full-title"
                      ? "完整标题引用"
                      : "明确文号引用"}{" "}
                    · {evidence.evidence.reference}
                  </p>
                  <p>正文版本：{evidence.evidence.version_id}</p>
                  <p>采集时间：{evidence.evidence.captured_at}</p>
                  <a
                    href={evidence.evidence.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    核对引用文件原文 ↗
                  </a>
                  <p>仅确认正文中的引用关系，不推断执行效果或资金金额。</p>
                </div>
              ) : (
                <div className="p4-empty">
                  当前文件没有已核实的上游引用证据。主题、日期相近不构成引用关系。
                </div>
              )
            ) : article ? (
              <ArchiveReader
                key={article.id}
                article={article}
                archives={archives}
                library={library}
                mutate={mutate}
                onRemove={onRemove}
              />
            ) : (
              <div className="p4-empty">
                没有符合主题的政策节点。可更换关键词或等待正文文字留存。
              </div>
            )}
          </div>
        </section>
      </div>
      {unmatched.length > 0 && (
        <section className="p4-related">
          <header className="p4-section-head">
            <h2>尚未关联的地方文件</h2>
            <span>未发现明确引用证据</span>
          </header>
          {unmatched.map((n: any) => (
            <button
              type="button"
              className="v4-unmatched"
              key={n.id}
              onClick={() => {
                setRoot(n.id);
                setSelected(n.id);
              }}
            >
              {n.title} ↗
            </button>
          ))}
        </section>
      )}
    </>
  );
}
