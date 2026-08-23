# Style Master Costing

Apparel **style master** and **style costing** for ERPNext — style definition, BOM
(fabric + trims), process routes, tech packs, markers, SMV/production cost,
value addition, time & action, lab testing, and a costing sheet with a sales
price markup ladder.

Ported from `cmv_erp_style_master_addon` (Frappe/ERPNext v13) to **Frappe v16 /
ERPNext v16**. Modelled on the style costing module of Visual Gems ERP.

## Requirements

| | |
|---|---|
| Frappe | v16 (`version-16`) |
| ERPNext | v16 (`version-16`) — declared via `required_apps` |
| Python | ≥ 3.14 (Frappe v16 requirement) |
| Node | ≥ 24 |
| MariaDB | ≥ 10.6 |

## Install

```bash
bench get-app style_master_costing <repo-url>
bench --site <site> install-app style_master_costing
```

## What the app adds

**63 DocTypes**, headed by two submittable masters that share one schema and one
client script:

* **Style Master** — the style, its BOM and its costing.
* **Style Master Costing** — the same form, used for buyer quoting.

Both carry 110 fields across 10 tabs: Style Details, Techpack, BOM, Marker,
SMV / Production Cost, Value Addition / T&A, Logistics & Incentive Cost,
Instructions, Sales Price Markup, Lab Test.

**Item extensions** — 50 custom fields and 16 property setters covering fabric
construction, GSM, composition, weave, trims attributes, item references and a
generated QR code, plus custom fields on Brand, Item Group, Item Barcode and
Item Supplier.

**Item naming override** — `StyleItem` derives the item code series from
`Item Group.group_category`: `F-` fabric, `T-` trims, `G-` garment, `Y-` yarn,
`CG-` capital goods, `C-` consumables, `S-` stationery, `I-` otherwise.

## Layout

```
style_master_costing/
├── queries.py                      whitelisted link queries + meta helper
├── docevents/                      Item class override, Item/Quotation hooks
├── public/js/
│   ├── style_form.js               shared Style Master / Style Master Costing logic
│   ├── style_master_costing.bundle.js
│   ├── item.js, item_list.js, quotation.js
├── fixtures/                       master data (cost heads, seasons, segments, ...)
└── style_master_costing/
    ├── custom/                     Customize Form exports (Item, Brand, ...)
    ├── doctype/                    63 DocTypes
    ├── print_format/               Style Master Costing Sheet
    └── workspace/styling/          the "Styling" workspace
```

## Notes on the v13 → v16 port

### Framework changes handled

| v13 | v16 |
|---|---|
| `setup.py` + `requirements.txt` | `pyproject.toml` (flit) |
| `config/desktop.py`, `config/docs.py` | removed — module comes from `modules.txt` + Workspace |
| `app_version`, `app_color`, `app_icon` in `hooks.py` | removed |
| Desk route `/app/...` | `/desk/...` |
| `name_case` on DocType | removed |
| `Order Type` DocType (ERPNext) | removed — now a Select on Quotation / Sales Order |
| `gst_hsn_code` → Link "GST HSN Code" | GST moved to `india_compliance`; field is now Data |
| `hub_sync_id` and Hub property setters | removed with Frappe Hub |
| Quotation `subscription_section`, `more_info` | `auto_repeat_section`, `more_info_tab` |

### Deliberate changes

**Native tabs.** v13 layered a ~160-line jQuery overlay (`setupTabView`) on top
of Section Breaks to fake tabs — it rewrote DOM classes, hid sections by hand and
re-rendered fields on every tab click. The DocTypes now use real `Tab Break`
fields and the overlay is gone.

**One implementation instead of three.** v13 carried the same logic in
`style_master.js` (1,900 lines), `fabric/fabric.js` (913 lines, layered onto
Style Master through `doctype_js`) and `style_master_costing.js` (2,716 lines —
the union of the first two). All three are now `public/js/style_form.js`, which
both DocTypes register.

**Child handlers register once.** v13 called `frappe.ui.form.on()` for the 12
child DocTypes from inside the parent's `onload`, so a new copy of every handler
was added on each form load. They now register a single time.

**Parameterised SQL.** `saveProcessRoute` (fabric and trims), the merchandiser
and item link queries, and the lab-testing-template query all built SQL with
`str.format` or `+` on client-supplied values. They now use the query builder,
and `saveProcessRoute` validates the parent document and its permissions and
only writes fields that exist on the child DocType.

**Live metadata.** `get_doc_wise_columns` read the DocType's JSON file straight
off disk, so Customize Form changes never reached the datatable. It now returns
`frappe.get_meta(...)`.

### Bugs fixed in passing

* `Style Master Costing` had two `amended_from` fields, the surviving one
  pointing at `Style Master`; amending produced a link to the wrong DocType.
* The module name was split across `"CMV ERP Style Master Addon"` (51 DocTypes)
  and `"Cmv Erp Style Master Addon"` (11); `modules.txt` declared only the
  second. Everything is now one module.
* `doctype_js` mapped `"Style Master"` to `doctype/fabric/fabric.js` — a file
  named after an unrelated child DocType. That code is now in `style_form.js`.
* `quotation.js` read `cur_frm.fields_dict.items.grid` unguarded. Its own first
  run hides `items`, so the next refresh threw
  `Cannot read properties of undefined (reading 'grid')`.
* The `styles` custom field on Quotation, which `quotation.js` and the
  `Quotation Style Master` child table both depend on, was never committed — it
  existed only on the client's site. It ships in `custom/quotation.json` now.
* A stray `console.log` on every fabric/trim cell edit.

### Not carried over

The v13 `fixtures/workspace.json` was a 432 KB dump of **all 34 workspaces on
the source site** — Accounting, HR, Healthcare, Education and the rest.
Installing it would overwrite the standard ERPNext workspaces. Only this app's
own workspace was ported, rebuilt as `workspace/styling` in the v16 `content`
format.

`fixtures/custom_field.json` duplicated the Item fields already in
`custom/item.json` and was dropped in favour of the Customize Form export.

The `stock_custom` workspace ("Stock-Custom", `extends: Stock`) was a
link-for-link copy of the v13 standard Stock workspace and added nothing, so it
was not carried over.

## Things to know

**Every Item gets a generated code.** The `StyleItem` override replaces
`item_code` on *every* Item, even when one is typed in — this is v13 behaviour,
kept as-is. It means an Item cannot be created with a chosen code while this app
is installed, so data imports that rely on specific item codes, and ERPNext's own
shared test records (`_Test Item` and friends), do not work unchanged. The app's
test suite opts out of those shared records for this reason.

**Do not name a Workspace after a DocType.** The v16 desk resolves
`/desk/<slug>/...` to a Workspace before a DocType, so a workspace called
"Style Master Costing" would shadow the Style Master Costing form. The workspace
is called "Styling", as it was in v13.

## Tests

```bash
bench --site <site> run-tests --app style_master_costing
```

`doctype/style_master/test_style_master.py` covers the item-code series, the QR
hook, insert/submit/cancel/amend on both style DocTypes, the tab structure, the
`amended_from` fix, every whitelisted link query, process-route replacement, and
that an injected parent name is rejected.

## License

MIT
