export function LoadingState(props: { title?: string; body?: string }) {
  return (
    <section className="state-card" aria-live="polite">
      <h2 className="state-title">{props.title ?? "正在加载"}</h2>
      <p className="state-body">
        {props.body ?? "前端工作台正在拉取 API 数据，请稍候。"}
      </p>
    </section>
  );
}
