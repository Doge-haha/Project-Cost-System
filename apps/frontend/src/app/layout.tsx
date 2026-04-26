import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import {
  getRuntimeConfig,
  onRuntimeConfigChange,
  resetRuntimeConfig,
  saveRuntimeConfig,
} from "../lib/config";

const links = [
  {
    to: "/projects",
    label: "项目工作台",
  },
];

export function AppLayout() {
  const [runtimeConfig, setRuntimeConfig] = useState(() => getRuntimeConfig());
  const [apiBaseUrl, setApiBaseUrl] = useState(runtimeConfig.apiBaseUrl);
  const [apiBearerToken, setApiBearerToken] = useState(
    runtimeConfig.apiBearerToken ?? "",
  );

  useEffect(() => {
    return onRuntimeConfigChange((nextConfig) => {
      setRuntimeConfig(nextConfig);
      setApiBaseUrl(nextConfig.apiBaseUrl);
      setApiBearerToken(nextConfig.apiBearerToken ?? "");
    });
  }, []);

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <p className="app-eyebrow">AI-first Pricing</p>
        <h1 className="app-title">新点 SaaS 计价工作台</h1>
        <p className="app-subtitle">
          先把项目、清单和汇总主链跑通，再逐步扩展为完整业务前台。
        </p>
        <nav className="app-nav" aria-label="主导航">
          {links.map((link) => (
            <NavLink
              key={link.to}
              className={({ isActive }) =>
                isActive ? "app-nav-link active" : "app-nav-link"
              }
              to={link.to}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <section className="connection-panel">
          <h2 className="connection-title">开发连接</h2>
          <p className="connection-copy">
            默认读取 Vite 环境变量，也可以在这里临时保存 API 地址和 Bearer Token。
          </p>
          <label className="connection-label">
            API Base URL
            <input
              className="connection-input"
              onChange={(event) => {
                setApiBaseUrl(event.target.value);
              }}
              type="text"
              value={apiBaseUrl}
            />
          </label>
          <label className="connection-label">
            Bearer Token
            <textarea
              className="connection-textarea"
              onChange={(event) => {
                setApiBearerToken(event.target.value);
              }}
              rows={4}
              value={apiBearerToken}
            />
          </label>
          <div className="connection-actions">
            <button
              className="connection-button primary"
              onClick={() => {
                setRuntimeConfig(
                  saveRuntimeConfig({
                    apiBaseUrl,
                    apiBearerToken,
                  }),
                );
              }}
              type="button"
            >
              保存连接
            </button>
            <button
              className="connection-button secondary"
              onClick={() => {
                resetRuntimeConfig();
              }}
              type="button"
            >
              恢复默认
            </button>
          </div>
          <p className="connection-meta">
            当前地址：{runtimeConfig.apiBaseUrl}
            <br />
            Token：{runtimeConfig.apiBearerToken ? "已保存" : "未提供"}
          </p>
        </section>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
