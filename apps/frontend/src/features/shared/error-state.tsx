import type { ReactNode } from "react";

export function ErrorState(props: {
  title?: string;
  body: string;
  onRetry?: () => void;
  actions?: ReactNode;
}) {
  return (
    <section className="state-card error" role="alert">
      <h2 className="state-title">{props.title ?? "加载失败"}</h2>
      <p className="state-body">{props.body}</p>
      {props.onRetry ? (
        <button className="state-action" onClick={props.onRetry} type="button">
          重新加载
        </button>
      ) : null}
      {props.actions ? <div className="version-card-actions">{props.actions}</div> : null}
    </section>
  );
}
