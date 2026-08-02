import React, { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { api, SessionUser } from "../api/client";
import { Organisation } from "../types";
import { EditableRow } from "../components/EditableRow";
import { Shell } from "../components/Shell";
import { useI18n } from "../i18n";
import { labelFor } from "../utils/labels";

export function SuperAdmin({ user, onLogout, onUserChange }: { user: SessionUser; onLogout: () => void; onUserChange: (user: SessionUser) => void }) {
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [values, setValues] = useState({ organisationName: "", adminName: "", adminEmail: "", adminPhone: "", adminPassword: "" });
  const { t } = useI18n();
  const load = () => api<Organisation[]>("/super-admin/organisations").then(setOrgs);
  useEffect(() => { load().catch(console.error); }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload = Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim() !== ""));
    await api("/super-admin/organisations", { method: "POST", body: JSON.stringify(payload) });
    setValues({ organisationName: "", adminName: "", adminEmail: "", adminPhone: "", adminPassword: "" });
    load();
  }

  return (
    <Shell user={user} onLogout={onLogout} onUserChange={onUserChange}>
      <main className="content">
        <section className="admin-panel">
          <h2><Building2 size={20} /> {t("Create Organisation")}</h2>
          <form className="grid-form" onSubmit={submit}>
            {Object.keys(values).map((key) => <label key={key}>{t(labelFor(key))}<input type={key.toLowerCase().includes("password") ? "password" : "text"} value={(values as any)[key]} onChange={(e) => setValues({ ...values, [key]: e.target.value })} /></label>)}
            <button className="primary">{t("Create Org Admin")}</button>
          </form>
          <p className="hint">{t("If Admin Password Is Blank, The Default Password Is Admin@123.")}</p>
        </section>
        <section className="customer-list">
          {orgs.map((org) => {
            const admin = org.users?.[0];
            return (
              <section className="admin-panel" key={org.id}>
                <h2><Building2 size={20} /> {org.name}</h2>
                {admin ? (
                  <EditableRow
                    title={admin.name}
                    meta={admin.email}
                    badge={admin.isActive ? "Active" : "Inactive"}
                    initial={{ name: admin.name, email: admin.email, phone: admin.phone ?? "", password: "", isActive: String(admin.isActive) }}
                    fields={[
                      { key: "name", label: "Admin Name" },
                      { key: "email", label: "Admin Email" },
                      { key: "phone", label: "Admin Phone" },
                      { key: "password", label: "New Password", type: "password" },
                      { key: "isActive", label: "Status", type: "active" }
                    ]}
                    path={`/super-admin/admins/${admin.id}`}
                    reload={load}
                  />
                ) : (
                  <p className="empty">{t("No Admin Found.")}</p>
                )}
              </section>
            );
          })}
        </section>
      </main>
    </Shell>
  );
}
