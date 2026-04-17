export const apiAppDescriptor = {
  name: "@saas-pricing/api",
  role: "business-api",
  modules: [
    "project",
    "stage",
    "member",
    "discipline",
    "bill",
    "quota",
    "pricing",
    "review",
    "report",
    "audit"
  ]
} as const;

export function describeApiApp(): string {
  return `${apiAppDescriptor.name}:${apiAppDescriptor.role}`;
}

export { createApp } from "./app/create-app.js";
