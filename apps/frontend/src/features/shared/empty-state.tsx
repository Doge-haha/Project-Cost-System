export function EmptyState(props: { title: string; body: string }) {
  return (
    <section className="state-card">
      <h2 className="state-title">{props.title}</h2>
      <p className="state-body">{props.body}</p>
    </section>
  );
}
