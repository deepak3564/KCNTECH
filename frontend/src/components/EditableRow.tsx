import React, { useState } from "react";
import { Edit2, Trash2, X } from "lucide-react";
import { api } from "../api/client";
import { useI18n } from "../i18n";

export type EditableField = {
  key: string;
  label: string;
  type?: "planType" | "active" | "boxStatus" | "password";
};

export function EditableRow({
  title,
  meta,
  badge,
  editMeta,
  initial,
  fields,
  path,
  deletePath,
  reload
}: {
  title: string;
  meta: string;
  badge: string;
  editMeta?: React.ReactNode;
  initial: Record<string, string>;
  fields: EditableField[];
  path: string;
  deletePath?: string;
  reload: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(initial);
  const [error, setError] = useState("");
  const { t } = useI18n();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const payload: Record<string, string | boolean | null> = {};
    for (const [key, value] of Object.entries(values)) {
      if (key === "password" && value.trim() === "") continue;
      if (key === "isActive") payload[key] = value === "true";
      else payload[key] = value.trim() === "" ? null : value;
    }
    try {
      await api(path, { method: "PUT", body: JSON.stringify(payload) });
      setEditing(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update");
    }
  }

  async function softDelete() {
    setError("");
    if (!confirm(t("Are You Sure You Want To Delete This Record?"))) return;
    try {
      await api(deletePath ?? path, { method: "DELETE" });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could Not Delete Record");
    }
  }

  if (editing) {
    return (
      <form className="edit-row" onSubmit={submit}>
        {editMeta && <div className="edit-row-meta">{editMeta}</div>}
        {fields.map((field) => (
          <label key={field.key}>
            {t(field.label)}
            <EditableInput field={field} value={values[field.key] ?? ""} onChange={(value) => setValues({ ...values, [field.key]: value })} />
          </label>
        ))}
        <div className="edit-actions">
          <button className="primary save-button" type="submit">{t("Save")}</button>
          <button type="button" onClick={() => { setValues(initial); setEditing(false); }}><X size={16} /> {t("Cancel")}</button>
        </div>
        {error && <p className="error inline-error">{t(error)}</p>}
      </form>
    );
  }

  return (
    <div className="master-row">
      <div className="master-row-main">
        <strong>{title}</strong>
        <span>{meta}</span>
      </div>
      <div className="row-actions">
        <span className="pill row-badge">{t(badge)}</span>
        <span className="row-action-buttons">
          <button className="small-button" onClick={() => setEditing(true)} title={t("Edit")}><Edit2 size={15} /></button>
          {deletePath && <button className="small-button delete-icon-button" onClick={softDelete} title={t("Delete")}><Trash2 size={15} /></button>}
        </span>
      </div>
      {error && <p className="error inline-error">{t(error)}</p>}
    </div>
  );
}

function EditableInput({ field, value, onChange }: { field: EditableField; value: string; onChange: (value: string) => void }) {
  const { t } = useI18n();
  if (field.type === "planType") {
    return <select value={value} onChange={(e) => onChange(e.target.value)}><option value="CABLE">{t("Cable")}</option><option value="INTERNET">{t("Internet")}</option></select>;
  }
  if (field.type === "active") {
    return <select value={value} onChange={(e) => onChange(e.target.value)}><option value="true">{t("Active")}</option><option value="false">{t("Inactive")}</option></select>;
  }
  if (field.type === "boxStatus") {
    return <select value={value} onChange={(e) => onChange(e.target.value)}><option value="ACTIVE">{t("Active")}</option><option value="REPAIRED">{t("Repaired")}</option><option value="REPLACED">{t("Replaced")}</option><option value="RETURNED">{t("Returned")}</option></select>;
  }
  if (field.type === "password") {
    return <input type="password" placeholder={t("Leave Blank To Keep Old Password")} value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  return <input value={value} onChange={(e) => onChange(e.target.value)} />;
}
