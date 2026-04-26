import type { BillVersion } from "../../lib/types";

export function formatBillVersionLabel(version: BillVersion) {
  return `${version.versionName} · ${version.stageCode} · ${version.disciplineCode}`;
}

export function BillVersionSelector(props: {
  label?: string;
  onChange: (billVersionId: string) => void;
  selectedVersionId: string;
  versions: BillVersion[];
}) {
  const label = props.label ?? "当前版本";

  return (
    <label className="connection-label">
      {label}
      <select
        aria-label={label}
        className="version-select"
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
        value={props.selectedVersionId}
      >
        {props.versions.map((version) => (
          <option key={version.id} value={version.id}>
            {formatBillVersionLabel(version)}
          </option>
        ))}
      </select>
    </label>
  );
}
