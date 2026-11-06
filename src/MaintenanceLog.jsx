import React, { useState, useEffect, useMemo } from "react";
import {
  Droplet, Plus, Trash2, Gauge, Calendar, AlertCircle, Wrench, Car,
  ChevronRight, ArrowLeft, Cog, CircleDot, Package, ClipboardList,
  Download, Upload, X, Pencil,
} from "lucide-react";

import { PhotoEditor, PhotoGallery } from './Photos';
import { defaultBackupName, buildBackup, saveBackup, parseBackup, writePhoto, photoRefs, openNativeBackup, isNative } from './media';

const VEHICLES_KEY = "vehicles";
const OIL_RECORDS_KEY = "oil-change-records";
const PART_RECORDS_KEY = "part-replacement-records";
const OTHER_RECORDS_KEY = "other-maintenance-records";
const INTERVALS_KEY = "oil-change-intervals";
const SELECTED_KEY = "selected-vehicle";
const DEFAULT_INTERVAL = 5000;

const OIL_SYSTEMS = [
  { id: "engine", label: "Engine", icon: Droplet },
  { id: "transmission", label: "Transmission", icon: Cog },
  { id: "differential", label: "Differential", icon: CircleDot },
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function todayLocal() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function fmtDate(d) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function MaintenanceLog() {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [oilRecords, setOilRecords] = useState([]);
  const [partRecords, setPartRecords] = useState([]);
  const [otherRecords, setOtherRecords] = useState([]);
  const [intervals, setIntervals] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [backupMsg, setBackupMsg] = useState("");
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [pastedJson, setPastedJson] = useState("");
  const [confirmDeleteVehicle, setConfirmDeleteVehicle] = useState(null);
  const [exportText, setExportText] = useState("");
  const [copyMsg, setCopyMsg] = useState("");
  const [backupName, setBackupName] = useState(defaultBackupName);
  const [backupBusy, setBackupBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  // view: "menu" | "oilMenu" | "oilLog" | "partLog" | "otherLog"
  const [view, setView] = useState("menu");
  const [oilSystem, setOilSystem] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [errors, setErrors] = useState({});

  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehicleErrors, setVehicleErrors] = useState({});
  const [vehicleForm, setVehicleForm] = useState({ year: "", make: "", model: "", trackingUnit: "miles" });

  const [oilForm, setOilForm] = useState({
    date: todayLocal(),
    mileage: "",
    oilBrand: "",
    oilType: "",
    filterBrand: "",
    notes: "",
  });

  const [simpleForm, setSimpleForm] = useState({
    date: todayLocal(),
    mileage: "",
    description: "",
    notes: "",
  });

  useEffect(() => {
    (async () => {
      let existingVehicles = [];
      let existingOil = [];
      let existingParts = [];
      let existingOther = [];
      let existingIntervals = {};
      let existingSelected = null;

      const tryGet = async (key) => {
        try {
          const r = await window.storage.get(key);
          if (r && r.value) return JSON.parse(r.value);
        } catch (e) {
          /* none yet */
        }
        return null;
      };

      existingVehicles = (await tryGet(VEHICLES_KEY)) || [];
      existingOil = (await tryGet(OIL_RECORDS_KEY)) || [];
      existingParts = (await tryGet(PART_RECORDS_KEY)) || [];
      existingOther = (await tryGet(OTHER_RECORDS_KEY)) || [];
      existingIntervals = (await tryGet(INTERVALS_KEY)) || {};
      try {
        const r = await window.storage.get(SELECTED_KEY);
        if (r && r.value) existingSelected = r.value;
      } catch (e) {
        /* none yet */
      }

      if (!existingSelected || !existingVehicles.find((v) => v.id === existingSelected)) {
        existingSelected = existingVehicles[0]?.id || null;
      }

      setVehicles(existingVehicles);
      setOilRecords(existingOil);
      setPartRecords(existingParts);
      setOtherRecords(existingOther);
      setIntervals(existingIntervals);
      setSelectedVehicleId(existingSelected);
      setLoaded(true);
    })();
  }, []);

  async function persistOil(next) {
    await window.storage.set(OIL_RECORDS_KEY, JSON.stringify(next));
    setOilRecords(next);
  }

  async function persistParts(next) {
    await window.storage.set(PART_RECORDS_KEY, JSON.stringify(next));
    setPartRecords(next);
  }

  async function persistOther(next) {
    await window.storage.set(OTHER_RECORDS_KEY, JSON.stringify(next));
    setOtherRecords(next);
  }

  async function persistVehicles(next) {
    await window.storage.set(VEHICLES_KEY, JSON.stringify(next));
    setVehicles(next);
  }

  async function persistIntervals(next) {
    await window.storage.set(INTERVALS_KEY, JSON.stringify(next));
    setIntervals(next);
  }

  async function selectVehicle(id) {
    setSelectedVehicleId(id);
    setView("menu");
    setOilSystem(null);
    setShowForm(false);
    setEditingId(null);
    setConfirmDelete(null);
    try {
      await window.storage.set(SELECTED_KEY, id);
    } catch (e) {
      console.error("Storage error", e);
    }
  }

  async function handleDeleteVehicle(id) {
    const nextVehicles = vehicles.filter((v) => v.id !== id);
    const nextOil = oilRecords.filter((r) => r.vehicleId !== id);
    const nextParts = partRecords.filter((r) => r.vehicleId !== id);
    const nextOther = otherRecords.filter((r) => r.vehicleId !== id);
    const nextIntervals = Object.fromEntries(
      Object.entries(intervals).filter(([key]) => !key.startsWith(`${id}:`))
    );

    await persistVehicles(nextVehicles);
    await persistOil(nextOil);
    await persistParts(nextParts);
    await persistOther(nextOther);
    await persistIntervals(nextIntervals);

    setConfirmDeleteVehicle(null);

    if (selectedVehicleId === id) {
      if (nextVehicles[0]) {
        selectVehicle(nextVehicles[0].id);
      } else {
        setSelectedVehicleId(null);
        try {
          await window.storage.set(SELECTED_KEY, "");
        } catch (e) {
          console.error("Storage error", e);
        }
      }
    }
  }

  function goTo(next) {
    setShowForm(false);
    setEditingId(null);
    setConfirmDelete(null);
    setErrors({});
    setView(next);
  }

  function openOilSystem(system) {
    setOilSystem(system);
    goTo("oilLog");
  }

  const vehicle = vehicles.find((v) => v.id === selectedVehicleId) || null;
  const trackingUnit = vehicle?.trackingUnit === "hours" ? "hours" : "miles";
  const meter = trackingUnit === "hours"
    ? { label: "Hours used", short: "hr", title: "HOURS", example: "e.g. 125.5" }
    : { label: "Mileage", short: "mi", title: "MILES", example: "e.g. 84200" };

  function changeTrackingUnit(value) {
    persistVehicles(vehicles.map((v) => v.id === selectedVehicleId ? { ...v, trackingUnit: value } : v));
    cancelEntryForm();
  }

  const oilKey = selectedVehicleId && oilSystem ? `${selectedVehicleId}:${oilSystem}${trackingUnit === "hours" ? ":hours" : ""}` : null;

  const filteredOil = useMemo(
    () => oilRecords.filter((r) => r.vehicleId === selectedVehicleId && r.system === oilSystem),
    [oilRecords, selectedVehicleId, oilSystem]
  );
  const sortedOil = useMemo(
    () =>
      [...filteredOil].sort((a, b) => {
        const dateDiff = new Date(b.date) - new Date(a.date);
        if (dateDiff !== 0) return dateDiff;
        return Number(b.mileage) - Number(a.mileage);
      }),
    [filteredOil]
  );
  const latestOil = sortedOil[0] || null;
  const oilInterval = oilKey ? intervals[oilKey] ?? (trackingUnit === "hours" ? 0 : DEFAULT_INTERVAL) : DEFAULT_INTERVAL;
  const nextDue = latestOil && oilInterval > 0 ? Number(latestOil.mileage) + Number(oilInterval) : null;

  const filteredParts = useMemo(
    () => partRecords.filter((r) => r.vehicleId === selectedVehicleId),
    [partRecords, selectedVehicleId]
  );
  const sortedParts = useMemo(
    () => [...filteredParts].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [filteredParts]
  );

  const filteredOther = useMemo(
    () => otherRecords.filter((r) => r.vehicleId === selectedVehicleId),
    [otherRecords, selectedVehicleId]
  );
  const sortedOther = useMemo(
    () => [...filteredOther].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [filteredOther]
  );

  function validateOil() {
    const e = {};
    if (!oilForm.date) e.date = "Required";
    if (!oilForm.mileage || isNaN(Number(oilForm.mileage)) || Number(oilForm.mileage) < 0)
      e.mileage = "Enter a valid number";
    if (!oilForm.oilBrand.trim()) e.oilBrand = "Required";
    if (!oilForm.oilType.trim()) e.oilType = "Required";
    if (!oilForm.filterBrand.trim()) e.filterBrand = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function openNewOil() {
    setEditingId(null);
    setOilForm({ date: todayLocal(), mileage: "", oilBrand: "", oilType: "", filterBrand: "", notes: "" });
    setErrors({});
    setConfirmDelete(null);
    setShowForm(true);
  }

  function openEditOil(record) {
    setEditingId(record.id);
    setOilForm({
      date: record.date || todayLocal(), mileage: String(record.mileage ?? ""),
      oilBrand: record.oilBrand || "", oilType: record.oilType || "",
      filterBrand: record.filterBrand || "", notes: record.notes || "", photos: record.photos || {},
    });
    setErrors({});
    setConfirmDelete(null);
    setShowForm(true);
    requestAnimationFrame(() => document.getElementById("entry-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function cancelEntryForm() {
    setShowForm(false);
    setEditingId(null);
    setErrors({});
  }

  async function handleSaveOil() {
    if (!validateOil()) return;
    try {
    const fields = { ...oilForm, mileage: Number(oilForm.mileage) };
    if (editingId) {
      const original = oilRecords.find((r) => r.id === editingId && r.vehicleId === selectedVehicleId && r.system === oilSystem);
      if (!original) return;
      await persistOil(oilRecords.map((r) => r.id === editingId ? { ...r, ...fields } : r));
    } else {
      await persistOil([...oilRecords, { id: uid(), vehicleId: selectedVehicleId, system: oilSystem, ...fields }]);
    }
    setOilForm({
      date: todayLocal(),
      mileage: "",
      oilBrand: "",
      oilType: "",
      filterBrand: "",
      notes: "",
    });
    cancelEntryForm();
    } catch { setBackupMsg("Could not save the entry. Please try again."); }
  }

  function handleDeleteOil(id) {
    persistOil(oilRecords.filter((r) => r.id !== id));
    setConfirmDelete(null);
  }

  function validateSimple() {
    const e = {};
    if (!simpleForm.date) e.date = "Required";
    if (!simpleForm.mileage || isNaN(Number(simpleForm.mileage)) || Number(simpleForm.mileage) < 0)
      e.mileage = "Enter a valid number";
    if (!simpleForm.description.trim()) e.description = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function openNewSimple() {
    setEditingId(null);
    setSimpleForm({ date: todayLocal(), mileage: "", description: "", notes: "" });
    setErrors({});
    setConfirmDelete(null);
    setShowForm(true);
  }

  function openEditSimple(record) {
    setEditingId(record.id);
    setSimpleForm({
      date: record.date || todayLocal(), mileage: String(record.mileage ?? ""),
      description: record.description || "", notes: record.notes || "", photos: record.photos || {},
    });
    setErrors({});
    setConfirmDelete(null);
    setShowForm(true);
    requestAnimationFrame(() => document.getElementById("entry-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function handleSaveSimple(kind) {
    if (!validateSimple()) return;
    try {
    const records = kind === "part" ? partRecords : otherRecords;
    const persist = kind === "part" ? persistParts : persistOther;
    const fields = { ...simpleForm, mileage: Number(simpleForm.mileage) };
    if (editingId) {
      const original = records.find((r) => r.id === editingId && r.vehicleId === selectedVehicleId);
      if (!original) return;
      await persist(records.map((r) => r.id === editingId ? { ...r, ...fields } : r));
    } else {
      await persist([...records, { id: uid(), vehicleId: selectedVehicleId, ...fields }]);
    }
    setSimpleForm({
      date: todayLocal(),
      mileage: "",
      description: "",
      notes: "",
    });
    cancelEntryForm();
    } catch { setBackupMsg("Could not save the entry. Please try again."); }
  }

  function handleDeleteSimple(kind, id) {
    if (kind === "part") persistParts(partRecords.filter((r) => r.id !== id));
    else persistOther(otherRecords.filter((r) => r.id !== id));
    setConfirmDelete(null);
  }

  function validateVehicle() {
    const e = {};
    if (!vehicleForm.year || isNaN(Number(vehicleForm.year))) e.year = "Enter a valid year";
    if (!vehicleForm.make.trim()) e.make = "Required";
    if (!vehicleForm.model.trim()) e.model = "Required";
    setVehicleErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleAddVehicle() {
    if (!validateVehicle()) return;
    const v = { id: uid(), year: Number(vehicleForm.year), make: vehicleForm.make.trim(), model: vehicleForm.model.trim(), trackingUnit: vehicleForm.trackingUnit };
    persistVehicles([...vehicles, v]);
    selectVehicle(v.id);
    setVehicleForm({ year: "", make: "", model: "", trackingUnit: "miles" });
    setVehicleErrors({});
    setShowVehicleForm(false);
  }

  function handleExport() {
    setBackupName(defaultBackupName()); setExportText("open"); setShowImportPanel(false);
  }
  async function handleSaveBackup() {
    setBackupBusy(true); setBackupMsg("");
    try {
      const contents = await buildBackup({ exportedAt: new Date().toISOString(), vehicles, oilRecords, partRecords, otherRecords, intervals, selectedVehicleId });
      await saveBackup(backupName, contents);
      setBackupMsg("Backup saved with all records and photos."); setExportText("");
    } catch (e) { setBackupMsg(e.message || "Backup could not be saved. Please try again."); }
    finally { setBackupBusy(false); }
  }
  async function chooseBackup() {
    try { await applyImport(await openNativeBackup()); }
    catch(e) { setBackupMsg(e.message || "Could not open backup."); }
  }

  async function applyImport(jsonText) {
    setBackupBusy(true);
    try {
      const data = parseBackup(jsonText);
      // Give restored photos new IDs so a failed restore cannot overwrite existing photos.
      const remap = new Map();
      for (const photo of photoRefs([...data.oilRecords, ...data.partRecords, ...data.otherRecords])) {
        if (!remap.has(photo.id)) {
          const id = crypto.randomUUID() + '.jpg';
          await writePhoto(id, data.images[photo.id]); remap.set(photo.id, id);
        }
        photo.id = remap.get(photo.id);
      }
      const mergeById = (existing, incoming) => {
        const merged = new Map(existing.map(x => [x.id, x]));
        for (const record of incoming || []) merged.set(record.id, record);
        return [...merged.values()];
      };
      const nextVehicles = mergeById(vehicles, data.vehicles);
      const nextOil = mergeById(oilRecords, data.oilRecords);
      const nextParts = mergeById(partRecords, data.partRecords);
      const nextOther = mergeById(otherRecords, data.otherRecords);
      const nextIntervals = { ...intervals, ...(data.intervals || {}) };

      await persistVehicles(nextVehicles);
      await persistOil(nextOil);
      await persistParts(nextParts);
      await persistOther(nextOther);
      await persistIntervals(nextIntervals);

      const restoreSelected = nextVehicles.find(v => v.id === data.selectedVehicleId)?.id || selectedVehicleId || nextVehicles[0]?.id;
      if (restoreSelected) selectVehicle(restoreSelected);
      setBackupMsg("Backup restored, including photos. Matching entries were updated.");
      setShowImportPanel(false);
      setPastedJson("");
    } catch (err) {
      setBackupMsg("Import failed — check that the file is a complete Maintenance Log backup.");
    } finally { setBackupBusy(false); }
  }

  function handleImportPaste() {
    if (!pastedJson.trim()) return;
    applyImport(pastedJson);
  }

  function vehicleLabel(v) {
    return `${v.year} ${v.make} ${v.model}`;
  }

  return (
    <div style={styles.page}>
      <style>{`
        
        * { box-sizing: border-box; }
        input:focus, button:focus, textarea:focus { outline: 2px solid #C97A2B; outline-offset: 2px; }
        button { cursor: pointer; }
        .tab-strip::-webkit-scrollbar { height: 0px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
      `}</style>

      <div style={styles.wrap}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <Wrench size={22} color="#C97A2B" strokeWidth={2.25} />
            <div>
              <h1 style={styles.title}>SERVICE LOG</h1>
              <p style={styles.subtitle}>Vehicle Maintenance Record</p>
            </div>
          </div>
          <div style={styles.headerRight}>
            <button
              style={styles.iconBtn}
              onClick={() => { setShowImportPanel(false); handleExport(); }}
              aria-label="Export backup"
              title="Export backup"
            >
              <Download size={16} />
            </button>
            <button
              style={styles.iconBtn}
              onClick={() => { setExportText(""); setShowImportPanel((s) => !s); }}
              aria-label="Restore from backup"
              title="Restore from backup"
            >
              <Upload size={16} />
            </button>
          </div>
        </header>
        {backupMsg && <p style={styles.backupMsg}>{backupMsg}</p>}
        {copyMsg && <p style={styles.backupMsg}>{copyMsg}</p>}
        {exportText && (
          <div style={styles.formCard}>
            <Field label="Backup name">
              <input value={backupName} onChange={e=>setBackupName(e.target.value)} style={styles.input} disabled={backupBusy}/>
            </Field>
            <p style={{...styles.emptyHint, fontSize:12, marginTop:10}}>Includes all profiles, records, settings, and attached photos. Slashes in the name become dashes in the saved filename.</p>
            <div style={styles.formActions}>
              <button style={styles.cancelButton} disabled={backupBusy} onClick={()=>setExportText("")}>Cancel</button>
              <button style={styles.saveButton} disabled={backupBusy || !backupName.trim()} onClick={handleSaveBackup}>{backupBusy ? "Preparing backup…" : "Save backup file"}</button>
            </div>
          </div>
        )}
        {showImportPanel && (
          <div style={styles.formCard}>
            <p style={styles.emptyHint}>Restore adds missing entries and replaces matching entries with the backup's version, including its photos.</p>
            {isNative() ? <button style={{...styles.saveButton,marginTop:12}} disabled={backupBusy} onClick={chooseBackup}>Choose backup file</button> : <input aria-label="Choose backup file" type="file" accept=".json,application/json" disabled={backupBusy} onChange={async e=>{const f=e.target.files?.[0];if(f)await applyImport(await f.text());e.target.value='';}}/>}
            {backupBusy && <p role="status">Restoring backup…</p>}
            <p style={styles.fieldLabelText}>Or paste a previous JSON backup</p>
            <textarea
              value={pastedJson}
              onChange={(e) => setPastedJson(e.target.value)}
              placeholder="Paste the contents of your backup .json file here"
              style={{ ...styles.textarea, minHeight: 100 }}
              rows={5}
            />
            <div style={styles.formActions}>
              <button
                style={styles.cancelButton}
                onClick={() => { setShowImportPanel(false); setPastedJson(""); }}
              >
                Cancel
              </button>
              <button style={styles.saveButton} disabled={backupBusy} onClick={handleImportPaste}>
                <Upload size={16} strokeWidth={2.5} />
                Import
              </button>
            </div>
          </div>
        )}
        <p style={styles.privacyNote}>
          Save a backup file to protect your records and photos. Android device backup also depends on your phone’s settings and storage limits.
        </p>

        {/* Vehicle profile tabs */}
        <div style={styles.tabRow} className="tab-strip">
          {vehicles.map((v) => (
            <div
              key={v.id}
              style={v.id === selectedVehicleId ? styles.tabActive : styles.tab}
            >
              <button
                onClick={() => selectVehicle(v.id)}
                style={styles.tabInnerBtn}
              >
                <Car size={13} strokeWidth={2.25} />
                {vehicleLabel(v)} · {v.trackingUnit === "hours" ? "hr" : "mi"}
              </button>
              <button
                onClick={() => setConfirmDeleteVehicle(v.id)}
                style={styles.tabRemoveBtn}
                aria-label={`Remove ${vehicleLabel(v)}`}
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            </div>
          ))}
          <button style={styles.tabAdd} onClick={() => setShowVehicleForm(true)} aria-label="Add vehicle">
            <Plus size={15} strokeWidth={2.5} />
          </button>
        </div>

        {vehicle && (
          <div style={{ marginBottom: 20 }}>
            <Field label="Track this profile by">
              <select style={styles.input} value={trackingUnit} onChange={(e) => changeTrackingUnit(e.target.value)}>
                <option value="miles">Miles driven</option>
                <option value="hours">Hours used</option>
              </select>
            </Field>
            <p style={{ ...styles.emptyHint, fontSize: 11, marginTop: 6 }}>Choose the unit on the odometer or hour meter. Changing units keeps recorded numbers; review existing entries.</p>
          </div>
        )}

        {confirmDeleteVehicle && (
          <div style={styles.deleteVehicleBanner}>
            <AlertCircle size={16} color="#D4695A" style={{ flexShrink: 0 }} />
            <p style={styles.deleteVehicleText}>
              Remove <b>{vehicleLabel(vehicles.find((v) => v.id === confirmDeleteVehicle) || {})}</b> and all of
              its oil, part, and other history? This can't be undone.
            </p>
            <div style={styles.deleteVehicleActions}>
              <button style={styles.cancelDeleteBtn} onClick={() => setConfirmDeleteVehicle(null)}>Keep</button>
              <button style={styles.confirmDeleteBtn} onClick={() => handleDeleteVehicle(confirmDeleteVehicle)}>Remove</button>
            </div>
          </div>
        )}

        {/* Add vehicle form */}
        {showVehicleForm && (
          <div style={styles.formCard}>
            <div style={styles.formGridThree} className="vehicle-fields">
              <Field label="Year" error={vehicleErrors.year}>
                <input
                  type="number"
                  placeholder="Year"
                  value={vehicleForm.year}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })}
                  style={styles.input}
                />
              </Field>
              <Field label="Make" error={vehicleErrors.make}>
                <input
                  type="text"
                  placeholder="Manufacturer"
                  value={vehicleForm.make}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                  style={styles.input}
                />
              </Field>
              <Field label="Model" error={vehicleErrors.model}>
                <input
                  type="text"
                  placeholder="Model"
                  value={vehicleForm.model}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                  style={styles.input}
                />
              </Field>
            </div>
            <div style={{ marginTop: 14 }}>
              <Field label="Track usage by">
                <select style={styles.input} value={vehicleForm.trackingUnit} onChange={(e) => setVehicleForm({ ...vehicleForm, trackingUnit: e.target.value })}>
                  <option value="miles">Miles driven</option>
                  <option value="hours">Hours used (mowers and equipment)</option>
                </select>
              </Field>
            </div>
            <div style={styles.formActions}>
              <button
                style={styles.cancelButton}
                onClick={() => { setShowVehicleForm(false); setVehicleErrors({}); }}
              >
                Cancel
              </button>
              <button style={styles.saveButton} onClick={handleAddVehicle}>
                <Car size={16} strokeWidth={2.5} />
                Add vehicle
              </button>
            </div>
          </div>
        )}

        {vehicles.length === 0 ? (
          <div style={styles.emptyState}>
            <AlertCircle size={20} color="#5B6670" />
            <p style={styles.emptyHint}>Add a vehicle to start logging maintenance.</p>
          </div>
        ) : (
          <>
            {view === "menu" && (
              <MenuScreen vehicle={vehicle} vehicleLabel={vehicleLabel} onSelect={goTo} />
            )}

            {view === "oilMenu" && (
              <SystemMenuScreen
                onBack={() => goTo("menu")}
                onSelect={openOilSystem}
              />
            )}

            {view === "oilLog" && (
              <OilLogScreen
                meter={meter}
                photoBusy={photoBusy}
                setPhotoBusy={setPhotoBusy}
                system={oilSystem}
                onBack={() => goTo("oilMenu")}
                sorted={sortedOil}
                latest={latestOil}
                nextDue={nextDue}
                interval={oilInterval}
                onIntervalChange={(val) =>
                  persistIntervals({ ...intervals, [oilKey]: val })
                }
                showForm={showForm}
                editingId={editingId}
                onStartAdd={openNewOil}
                onEdit={openEditOil}
                onCancel={cancelEntryForm}
                form={oilForm}
                setForm={setOilForm}
                errors={errors}
                onSave={handleSaveOil}
                confirmDelete={confirmDelete}
                setConfirmDelete={setConfirmDelete}
                onDelete={handleDeleteOil}
                loaded={loaded}
              />
            )}

            {view === "partLog" && (
              <SimpleLogScreen
                meter={meter}
                photoBusy={photoBusy}
                setPhotoBusy={setPhotoBusy}
                kind="part"
                title="Part Replacement History"
                icon={Package}
                onBack={() => goTo("menu")}
                sorted={sortedParts}
                showForm={showForm}
                editingId={editingId}
                onStartAdd={openNewSimple}
                onEdit={openEditSimple}
                onCancel={cancelEntryForm}
                form={simpleForm}
                setForm={setSimpleForm}
                errors={errors}
                onSave={() => handleSaveSimple("part")}
                confirmDelete={confirmDelete}
                setConfirmDelete={setConfirmDelete}
                onDelete={(id) => handleDeleteSimple("part", id)}
                loaded={loaded}
                descriptionPlaceholder="e.g. Front brake pads, NAPA"
              />
            )}

            {view === "otherLog" && (
              <SimpleLogScreen
                meter={meter}
                photoBusy={photoBusy}
                setPhotoBusy={setPhotoBusy}
                kind="other"
                title="Other History"
                icon={ClipboardList}
                onBack={() => goTo("menu")}
                sorted={sortedOther}
                showForm={showForm}
                editingId={editingId}
                onStartAdd={openNewSimple}
                onEdit={openEditSimple}
                onCancel={cancelEntryForm}
                form={simpleForm}
                setForm={setSimpleForm}
                errors={errors}
                onSave={() => handleSaveSimple("other")}
                confirmDelete={confirmDelete}
                setConfirmDelete={setConfirmDelete}
                onDelete={(id) => handleDeleteSimple("other", id)}
                loaded={loaded}
                descriptionPlaceholder="e.g. Coolant flush, alignment"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MenuScreen({ vehicle, vehicleLabel, onSelect }) {
  const items = [
    { id: "oilMenu", label: "Oil Change History", desc: "Engine, transmission, differential", icon: Droplet },
    { id: "partLog", label: "Part Replacement History", desc: "Brakes, belts, and other swapped parts", icon: Package },
    { id: "otherLog", label: "Other History", desc: "Anything else worth tracking", icon: ClipboardList },
  ];
  return (
    <section>
      <h2 style={styles.screenHeading}>
        Maintenance History
        {vehicle && <span style={styles.screenSubheading}>{vehicleLabel(vehicle)}</span>}
      </h2>
      <div style={styles.menuList}>
        {items.map((item) => (
          <button key={item.id} style={styles.menuCard} onClick={() => onSelect(item.id)}>
            <item.icon size={20} color="#C97A2B" strokeWidth={2} />
            <div style={styles.menuCardText}>
              <span style={styles.menuCardLabel}>{item.label}</span>
              <span style={styles.menuCardDesc}>{item.desc}</span>
            </div>
            <ChevronRight size={18} color="#5B6670" />
          </button>
        ))}
      </div>
    </section>
  );
}

function SystemMenuScreen({ onBack, onSelect }) {
  return (
    <section>
      <BackRow onBack={onBack} label="Maintenance History" />
      <h2 style={styles.screenHeading}>Oil Change History</h2>
      <div style={styles.menuList}>
        {OIL_SYSTEMS.map((s) => (
          <button key={s.id} style={styles.menuCard} onClick={() => onSelect(s.id)}>
            <s.icon size={20} color="#C97A2B" strokeWidth={2} />
            <div style={styles.menuCardText}>
              <span style={styles.menuCardLabel}>{s.label}</span>
            </div>
            <ChevronRight size={18} color="#5B6670" />
          </button>
        ))}
      </div>
    </section>
  );
}

function BackRow({ onBack, label }) {
  return (
    <button style={styles.backRow} onClick={onBack}>
      <ArrowLeft size={15} strokeWidth={2.5} />
      {label}
    </button>
  );
}

function OilLogScreen({
  meter, photoBusy, setPhotoBusy,
  system, onBack, sorted, latest, nextDue, interval, onIntervalChange,
  showForm, editingId, onStartAdd, onEdit, onCancel, form, setForm, errors, onSave,
  confirmDelete, setConfirmDelete, onDelete, loaded,
}) {
  const systemMeta = OIL_SYSTEMS.find((s) => s.id === system);
  return (
    <section>
      <BackRow onBack={onBack} label="Oil Change History" />
      <h2 style={styles.screenHeading}>{systemMeta ? systemMeta.label : ""} Oil</h2>

      <div style={styles.stickerRow}>
        <div style={styles.sticker}>
          <div style={styles.stickerRing}>
            <span style={styles.stickerLabel}>NEXT DUE</span>
            <span style={styles.stickerValue}>{nextDue !== null ? nextDue.toLocaleString() : "—"}</span>
            <span style={styles.stickerUnit}>{meter.title}</span>
          </div>
        </div>
        <div style={styles.stickerInfo}>
          {latest ? (
            <>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Last change</span>
                <span style={styles.infoValue}>
                  {fmtDate(latest.date)} @ {Number(latest.mileage).toLocaleString()} {meter.short}
                </span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Interval</span>
                <span style={styles.infoValue}>
                  <input
                    type="number"
                    aria-label="Service interval"
                    min="0"
                    step="any"
                    value={interval}
                    onChange={(e) => onIntervalChange(Number(e.target.value) || 0)}
                    style={styles.intervalInput}
                  />
                  {" "}{meter.short}
                </span>
              </div>
            </>
          ) : (
            <p style={styles.emptyHint}>Log the first change here to start tracking intervals.</p>
          )}
        </div>
      </div>

      {latest && interval <= 0 && <p style={{ ...styles.emptyHint, marginBottom: 16 }}>Set the service interval above from your equipment's maintenance schedule to calculate the next due reading.</p>}
      {!showForm ? (
        <button style={styles.addButton} onClick={onStartAdd}>
          <Plus size={18} strokeWidth={2.5} />
          Log an oil change
        </button>
      ) : (
        <div style={styles.formCard} id="entry-form">
          <h3 style={styles.formHeading}>{editingId ? "Edit oil change" : "Log an oil change"}</h3>
          <div style={styles.formGrid} className="entry-fields">
            <Field label="Date" error={errors.date}>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={styles.input} />
            </Field>
            <Field label={meter.label} error={errors.mileage}>
              <input type="number" min="0" step="any" inputMode="decimal" placeholder={meter.example} value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} style={styles.input} />
            </Field>
            <Field label="Oil brand" error={errors.oilBrand}>
              <input type="text" placeholder="Oil brand" value={form.oilBrand} onChange={(e) => setForm({ ...form, oilBrand: e.target.value })} style={styles.input} />
            </Field>
            <Field label="Oil type" error={errors.oilType}>
              <input type="text" placeholder="Oil specification" value={form.oilType} onChange={(e) => setForm({ ...form, oilType: e.target.value })} style={styles.input} />
            </Field>
            <Field label="Filter brand" error={errors.filterBrand}>
              <input type="text" placeholder="Filter brand" value={form.filterBrand} onChange={(e) => setForm({ ...form, filterBrand: e.target.value })} style={styles.input} />
            </Field>
          </div>
          <label style={{ ...styles.fieldLabel, marginTop: 14 }}>
            <span style={styles.fieldLabelText}>Notes (optional)</span>
            <textarea placeholder="Work performed and notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={styles.textarea} rows={3} />
          </label>
          <PhotoEditor photos={form.photos} onChange={photos=>setForm(current=>({...current,photos}))} onBusy={setPhotoBusy}/>
          <div style={styles.formActions}>
            <button style={styles.cancelButton} disabled={photoBusy} onClick={onCancel}>Cancel</button>
            <button style={styles.saveButton} disabled={photoBusy} onClick={onSave}>
              <Droplet size={16} strokeWidth={2.5} />
              {editingId ? "Save changes" : "Save entry"}
            </button>
          </div>
        </div>
      )}

      <section style={styles.logSection}>
        <h2 style={styles.logHeading}>
          History {sorted.length > 0 && <span style={styles.count}>({sorted.length})</span>}
        </h2>
        {!loaded ? (
          <p style={styles.emptyHint}>Loading log…</p>
        ) : sorted.length === 0 ? (
          <div style={styles.emptyState}>
            <AlertCircle size={20} color="#5B6670" />
            <p style={styles.emptyHint}>No entries yet. Nothing logged, nothing tracked.</p>
          </div>
        ) : (
          <div style={styles.logList}>
            {sorted.map((r, i) => {
              const prev = sorted[i + 1];
              const delta = prev ? Number(r.mileage) - Number(prev.mileage) : null;
              return (
                <div key={r.id} style={styles.logRow}>
                  <div style={styles.logRowMain}>
                    <div style={styles.logMileageBlock}>
                      <Gauge size={15} color="#C97A2B" />
                      <span style={styles.logMileage}>{Number(r.mileage).toLocaleString()}</span>
                      <span style={styles.logMi}>{meter.short}</span>
                    </div>
                    <div style={styles.logDateBlock}>
                      <Calendar size={13} color="#7A756B" />
                      <span style={styles.logDate}>{fmtDate(r.date)}</span>
                    </div>
                    {delta !== null && <span style={styles.logDelta}>+{delta.toLocaleString()} {meter.short} since last</span>}
                  </div>
                  <div style={styles.logDetails}>
                    <span><b>{r.oilBrand}</b> — {r.oilType}</span>
                    <span style={styles.dot}>·</span>
                    <span>Filter: {r.filterBrand}</span>
                  </div>
                  {r.notes && r.notes.trim() && <p style={styles.logNotes}>{r.notes}</p>}
                  <PhotoGallery photos={r.photos}/>
                  <div style={styles.logRowActions}>
                    {confirmDelete === r.id ? (
                      <>
                        <button style={styles.confirmDeleteBtn} onClick={() => onDelete(r.id)}>Delete</button>
                        <button style={styles.cancelDeleteBtn} onClick={() => setConfirmDelete(null)}>Keep</button>
                      </>
                    ) : (
                      <>
                        <button style={styles.editBtn} onClick={() => onEdit(r)} aria-label={`Edit entry from ${fmtDate(r.date)}`}>
                          <Pencil size={14} /> Edit
                        </button>
                        <button style={styles.deleteBtn} onClick={() => setConfirmDelete(r.id)} aria-label="Delete entry">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

function SimpleLogScreen({
  meter, photoBusy, setPhotoBusy,
  kind, title, icon: Icon, onBack, sorted, showForm, editingId, onStartAdd, onEdit, onCancel, form, setForm,
  errors, onSave, confirmDelete, setConfirmDelete, onDelete, loaded, descriptionPlaceholder,
}) {
  return (
    <section>
      <BackRow onBack={onBack} label="Maintenance History" />
      <h2 style={styles.screenHeading}>{title}</h2>

      {!showForm ? (
        <button style={styles.addButton} onClick={onStartAdd}>
          <Plus size={18} strokeWidth={2.5} />
          Log an entry
        </button>
      ) : (
        <div style={styles.formCard} id="entry-form">
          <h3 style={styles.formHeading}>{editingId ? "Edit entry" : "Log an entry"}</h3>
          <div style={styles.formGrid} className="entry-fields">
            <Field label="Date" error={errors.date}>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={styles.input} />
            </Field>
            <Field label={meter.label} error={errors.mileage}>
              <input type="number" min="0" step="any" inputMode="decimal" placeholder={meter.example} value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} style={styles.input} />
            </Field>
          </div>
          <label style={{ ...styles.fieldLabel, marginTop: 14 }}>
            <span style={styles.fieldLabelText}>Description</span>
            <input type="text" placeholder={descriptionPlaceholder} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={styles.input} />
            {errors.description && <span style={styles.fieldError}>{errors.description}</span>}
          </label>
          <label style={{ ...styles.fieldLabel, marginTop: 14 }}>
            <span style={styles.fieldLabelText}>Notes (optional)</span>
            <textarea placeholder="Additional detail" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={styles.textarea} rows={3} />
          </label>
          <PhotoEditor photos={form.photos} onChange={photos=>setForm(current=>({...current,photos}))} onBusy={setPhotoBusy}/>
          <div style={styles.formActions}>
            <button style={styles.cancelButton} disabled={photoBusy} onClick={onCancel}>Cancel</button>
            <button style={styles.saveButton} disabled={photoBusy} onClick={onSave}>
              <Icon size={16} strokeWidth={2.5} />
              {editingId ? "Save changes" : "Save entry"}
            </button>
          </div>
        </div>
      )}

      <section style={styles.logSection}>
        <h2 style={styles.logHeading}>
          History {sorted.length > 0 && <span style={styles.count}>({sorted.length})</span>}
        </h2>
        {!loaded ? (
          <p style={styles.emptyHint}>Loading log…</p>
        ) : sorted.length === 0 ? (
          <div style={styles.emptyState}>
            <AlertCircle size={20} color="#5B6670" />
            <p style={styles.emptyHint}>No entries yet. Nothing logged, nothing tracked.</p>
          </div>
        ) : (
          <div style={styles.logList}>
            {sorted.map((r) => (
              <div key={r.id} style={styles.logRow}>
                <div style={styles.logRowMain}>
                  <div style={styles.logMileageBlock}>
                    <Gauge size={15} color="#C97A2B" />
                    <span style={styles.logMileage}>{Number(r.mileage).toLocaleString()}</span>
                    <span style={styles.logMi}>{meter.short}</span>
                  </div>
                  <div style={styles.logDateBlock}>
                    <Calendar size={13} color="#7A756B" />
                    <span style={styles.logDate}>{fmtDate(r.date)}</span>
                  </div>
                </div>
                <div style={styles.logDetails}>
                  <span>{r.description}</span>
                </div>
                {r.notes && r.notes.trim() && <p style={styles.logNotes}>{r.notes}</p>}
                  <PhotoGallery photos={r.photos}/>
                  <div style={styles.logRowActions}>
                  {confirmDelete === r.id ? (
                    <>
                      <button style={styles.confirmDeleteBtn} onClick={() => onDelete(r.id)}>Delete</button>
                      <button style={styles.cancelDeleteBtn} onClick={() => setConfirmDelete(null)}>Keep</button>
                    </>
                    ) : (
                      <>
                        <button style={styles.editBtn} onClick={() => onEdit(r)} aria-label={`Edit entry from ${fmtDate(r.date)}`}>
                          <Pencil size={14} /> Edit
                        </button>
                        <button style={styles.deleteBtn} onClick={() => setConfirmDelete(r.id)} aria-label="Delete entry">
                          <Trash2 size={14} />
                        </button>
                      </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function Field({ label, error, children }) {
  return (
    <label style={styles.fieldLabel}>
      <span style={styles.fieldLabelText}>{label}</span>
      {children}
      {error && <span style={styles.fieldError}>{error}</span>}
    </label>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#1C1B19",
    color: "#EDE8E0",
    fontFamily: "'JetBrains Mono', monospace",
    padding: "24px 16px 60px",
  },
  wrap: { maxWidth: 640, margin: "0 auto" },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    borderBottom: "2px solid #2A2825",
    paddingBottom: 16,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  headerRight: { display: "flex", alignItems: "center", gap: 6 },
  iconBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    background: "#141312",
    border: "1px solid #2A2825",
    borderRadius: 6,
    color: "#8A8378",
    cursor: "pointer",
  },
  backupMsg: {
    fontSize: 12,
    color: "#C97A2B",
    margin: "-14px 0 14px",
  },
  privacyNote: {
    fontSize: 11,
    color: "#5B6670",
    margin: "-14px 0 18px",
    lineHeight: 1.4,
  },
  title: {
    fontFamily: "'Oswald', sans-serif",
    fontWeight: 700,
    fontSize: 22,
    letterSpacing: "0.08em",
    margin: 0,
    color: "#EDE8E0",
  },
  subtitle: {
    margin: 0,
    fontSize: 12,
    color: "#8A8378",
    letterSpacing: "0.03em",
  },
  tabRow: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    marginBottom: 20,
    paddingBottom: 2,
  },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
    background: "#141312",
    border: "1px solid #2A2825",
    color: "#B8B2A5",
    borderRadius: 20,
    padding: "4px 6px 4px 14px",
    fontFamily: "'Oswald', sans-serif",
    fontSize: 12.5,
    letterSpacing: "0.02em",
    whiteSpace: "nowrap",
  },
  tabActive: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
    background: "rgba(201,122,43,0.14)",
    border: "1px solid #C97A2B",
    color: "#EDE8E0",
    borderRadius: 20,
    padding: "4px 6px 4px 14px",
    fontFamily: "'Oswald', sans-serif",
    fontWeight: 600,
    fontSize: 12.5,
    letterSpacing: "0.02em",
    whiteSpace: "nowrap",
  },
  tabInnerBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "transparent",
    border: "none",
    color: "inherit",
    font: "inherit",
    padding: "4px 0",
  },
  tabRemoveBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 20,
    height: 20,
    background: "transparent",
    border: "none",
    color: "#5B6670",
    borderRadius: "50%",
    flexShrink: 0,
  },
  tabAdd: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: 32,
    height: 32,
    background: "transparent",
    border: "1px dashed #3A362F",
    color: "#8A8378",
    borderRadius: "50%",
  },
  deleteVehicleBanner: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    background: "#1F1512",
    border: "1px solid #4A2B24",
    borderRadius: 8,
    padding: "12px 14px",
    marginBottom: 16,
  },
  deleteVehicleText: {
    flex: 1,
    fontSize: 12.5,
    color: "#D8CFC3",
    lineHeight: 1.4,
    margin: 0,
  },
  deleteVehicleActions: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    flexShrink: 0,
  },
  backRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "transparent",
    border: "none",
    color: "#8A8378",
    fontFamily: "'Oswald', sans-serif",
    fontSize: 12.5,
    letterSpacing: "0.03em",
    padding: 0,
    marginBottom: 14,
  },
  screenHeading: {
    fontFamily: "'Oswald', sans-serif",
    fontWeight: 600,
    fontSize: 19,
    letterSpacing: "0.02em",
    color: "#EDE8E0",
    margin: "0 0 16px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  screenSubheading: {
    fontSize: 12,
    fontWeight: 400,
    color: "#8A8378",
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: "0.02em",
  },
  menuList: { display: "flex", flexDirection: "column", gap: 10 },
  menuCard: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    background: "#141312",
    border: "1px solid #2A2825",
    borderRadius: 10,
    padding: "16px 16px",
    textAlign: "left",
  },
  menuCardText: { flex: 1, display: "flex", flexDirection: "column", gap: 2 },
  menuCardLabel: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 14.5,
    fontWeight: 600,
    color: "#EDE8E0",
    letterSpacing: "0.01em",
  },
  menuCardDesc: { fontSize: 11.5, color: "#8A8378" },
  stickerRow: {
    display: "flex",
    gap: 20,
    alignItems: "center",
    background: "#141312",
    border: "1px solid #2A2825",
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  sticker: { flexShrink: 0 },
  stickerRing: {
    width: 108,
    height: 108,
    borderRadius: "50%",
    border: "3px dashed #C97A2B",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "radial-gradient(circle, rgba(201,122,43,0.08), transparent 70%)",
  },
  stickerLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 9, letterSpacing: "0.12em", color: "#8A8378" },
  stickerValue: { fontFamily: "'Oswald', sans-serif", fontSize: 20, fontWeight: 600, color: "#EDE8E0", lineHeight: 1.1 },
  stickerUnit: { fontSize: 9, color: "#8A8378", letterSpacing: "0.1em" },
  stickerInfo: { flex: 1, minWidth: 180 },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 0",
    fontSize: 13,
    borderBottom: "1px solid #221F1C",
  },
  infoLabel: { color: "#8A8378" },
  infoValue: { color: "#EDE8E0", display: "flex", alignItems: "center", gap: 4 },
  intervalInput: {
    width: 64,
    background: "#0F0E0D",
    border: "1px solid #3A362F",
    borderRadius: 4,
    color: "#EDE8E0",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    padding: "3px 6px",
    textAlign: "right",
  },
  emptyHint: { color: "#8A8378", fontSize: 13, margin: 0 },
  addButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: "#C97A2B",
    color: "#141312",
    border: "none",
    borderRadius: 8,
    padding: "13px 16px",
    fontFamily: "'Oswald', sans-serif",
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: "0.04em",
    marginBottom: 20,
  },
  formCard: {
    background: "#141312",
    border: "1px solid #2A2825",
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
  },
  formHeading: { fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600, margin: "0 0 14px", color: "#EDE8E0" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  formGridThree: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 },
  fieldLabel: { display: "flex", flexDirection: "column", gap: 4 },
  fieldLabelText: { fontSize: 11, letterSpacing: "0.06em", color: "#8A8378", textTransform: "uppercase" },
  input: {
    background: "#0F0E0D",
    border: "1px solid #3A362F",
    borderRadius: 6,
    color: "#EDE8E0",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 14,
    padding: "9px 10px",
    width: "100%",
  },
  fieldError: { fontSize: 11, color: "#D4695A" },
  textarea: {
    background: "#0F0E0D",
    border: "1px solid #3A362F",
    borderRadius: 6,
    color: "#EDE8E0",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    padding: "9px 10px",
    width: "100%",
    resize: "vertical",
  },
  formActions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 },
  cancelButton: {
    background: "transparent",
    border: "1px solid #3A362F",
    color: "#8A8378",
    borderRadius: 6,
    padding: "9px 16px",
    fontFamily: "'Oswald', sans-serif",
    fontSize: 13,
    letterSpacing: "0.03em",
  },
  saveButton: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#C97A2B",
    border: "none",
    color: "#141312",
    borderRadius: 6,
    padding: "9px 18px",
    fontFamily: "'Oswald', sans-serif",
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: "0.03em",
  },
  logSection: { marginTop: 8 },
  logHeading: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 14,
    letterSpacing: "0.08em",
    color: "#8A8378",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  count: { color: "#5B6670" },
  emptyState: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 20,
    background: "#141312",
    border: "1px dashed #2A2825",
    borderRadius: 8,
    marginBottom: 20,
  },
  logList: { display: "flex", flexDirection: "column", gap: 10 },
  logRow: {
    background: "#141312",
    border: "1px solid #221F1C",
    borderRadius: 8,
    padding: "12px 14px",
    position: "relative",
  },
  logRowMain: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 6 },
  logMileageBlock: { display: "flex", alignItems: "center", gap: 5 },
  logMileage: { fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 16, color: "#EDE8E0" },
  logMi: { fontSize: 11, color: "#8A8378" },
  logDateBlock: { display: "flex", alignItems: "center", gap: 5 },
  logDate: { fontSize: 12, color: "#8A8378" },
  logDelta: { fontSize: 11, color: "#6B8F6B", marginLeft: "auto" },
  logDetails: { fontSize: 12.5, color: "#B8B2A5", display: "flex", gap: 8, flexWrap: "wrap" },
  dot: { color: "#3A362F" },
  logNotes: {
    fontSize: 12,
    color: "#8A8378",
    margin: "6px 0 0",
    lineHeight: 1.4,
    borderTop: "1px dashed #221F1C",
    paddingTop: 6,
  },
  logRowActions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 },
  editBtn: { background: "transparent", border: "1px solid #3A362F", color: "#C97A2B", padding: "7px 10px", borderRadius: 5, display: "flex", alignItems: "center", gap: 5, fontFamily: "'Oswald', sans-serif", fontSize: 12 },
  deleteBtn: { background: "transparent", border: "1px solid #3A362F", color: "#8A8378", padding: "7px 10px", borderRadius: 5, display: "flex", alignItems: "center" },
  confirmDeleteBtn: {
    background: "#B33B3B",
    border: "none",
    color: "#EDE8E0",
    fontSize: 11,
    borderRadius: 4,
    padding: "4px 8px",
    fontFamily: "'Oswald', sans-serif",
  },
  cancelDeleteBtn: {
    background: "transparent",
    border: "1px solid #3A362F",
    color: "#8A8378",
    fontSize: 11,
    borderRadius: 4,
    padding: "4px 8px",
    fontFamily: "'Oswald', sans-serif",
  },
};
