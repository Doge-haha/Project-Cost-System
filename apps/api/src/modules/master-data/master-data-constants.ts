export const sourceSystemCodes = ["xindian_jiangsu"] as const;

export type SourceSystemCode = (typeof sourceSystemCodes)[number];

export const defaultSourceSystemCode: SourceSystemCode = "xindian_jiangsu";
