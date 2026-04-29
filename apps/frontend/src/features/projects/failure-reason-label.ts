export function formatFailureReasonLabel(reasonCode: string | null) {
  if (reasonCode === "missing_field") {
    return "缺少必填字段";
  }
  if (reasonCode === "invalid_value") {
    return "字段值非法";
  }
  if (reasonCode === "parse_error") {
    return "解析失败";
  }
  if (reasonCode === "duplicate_code") {
    return "重复编码";
  }
  if (reasonCode === "unmapped_parent") {
    return "父级无法映射";
  }
  if (reasonCode === "unmapped_work_item") {
    return "工作内容无法挂接";
  }
  return null;
}

export function normalizeFailureReason(reasonCode: string | null) {
  return formatFailureReasonLabel(reasonCode) ? reasonCode : null;
}

export function normalizeFailureSubsetFilter(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildFailureCollaborationUnitLabel(input: {
  failureReasonLabel: string;
  failureResourceType?: string | null;
  failureAction?: string | null;
}) {
  const parts = [input.failureReasonLabel];

  if (input.failureResourceType) {
    parts.push(`资源 ${input.failureResourceType}`);
  }

  if (input.failureAction) {
    parts.push(`动作 ${input.failureAction}`);
  }

  return parts.join(" · ");
}

export function appendFailureCollaborationParams(
  params: URLSearchParams,
  input: {
    failureReason?: string | null;
    failureResourceType?: string | null;
    failureAction?: string | null;
  },
) {
  if (input.failureReason) {
    params.set("failureReason", input.failureReason);
  }
  if (input.failureResourceType) {
    params.set("failureResourceType", input.failureResourceType);
  }
  if (input.failureAction) {
    params.set("failureAction", input.failureAction);
  }

  return params;
}
