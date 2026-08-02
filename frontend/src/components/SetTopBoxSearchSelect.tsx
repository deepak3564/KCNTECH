import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useI18n } from "../i18n";
import { Box } from "../types";

export function SetTopBoxSearchSelect({
  label,
  boxes,
  value,
  emptyLabel,
  onChange
}: {
  label: string;
  boxes: Box[];
  value: string;
  emptyLabel: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const selectedBox = boxes.find((box) => box.id === value);
  const [query, setQuery] = useState(selectedBox ? boxLabel(selectedBox) : "");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = normalized
      ? boxes.filter((box) => boxLabel(box).toLowerCase().includes(normalized))
      : boxes;
    return filtered.slice(0, 50);
  }, [boxes, query]);

  function choose(box: Box | null) {
    onChange(box?.id ?? "");
    setQuery(box ? boxLabel(box) : "");
    setOpen(false);
  }

  return (
    <label className="search-select-label">
      {label}
      <div className="search-select">
        <Search size={15} />
        <input
          value={query}
          placeholder={t("Search Set Top Box Or Card Number")}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange("");
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        />
        {open && (
          <div className="search-select-menu">
            <button type="button" onMouseDown={() => choose(null)}>{emptyLabel}</button>
            {matches.map((box) => (
              <button type="button" key={box.id} onMouseDown={() => choose(box)}>
                <strong>{box.boxNumber}</strong>
                <span>{box.pairedCardNumber}</span>
              </button>
            ))}
            {matches.length === 0 && <p>{t("No Matching Set Top Box Found.")}</p>}
          </div>
        )}
      </div>
    </label>
  );
}

function boxLabel(box: Box) {
  return `${box.boxNumber} / ${box.pairedCardNumber}`;
}
