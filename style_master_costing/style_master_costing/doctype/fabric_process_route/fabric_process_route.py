# Copyright (c) 2022, Auriga and contributors
# For license information, please see license.txt

import json

import frappe
from frappe import _
from frappe.model.document import Document


class FabricProcessRoute(Document):
	pass


@frappe.whitelist()
def saveProcessRoute(stylemaster, fabric_name, process_route):
	"""Replace the saved process route rows for one fabric on a style.

	v13 built the DELETE with str.format (SQL injection) and re-inserted rows
	from unvalidated client JSON. v16 validates the parent, uses a parameterised
	delete and only writes fields that exist on the child DocType.
	"""
	if not stylemaster or not fabric_name or not process_route:
		frappe.throw(_("Style, fabric and process route are all required."))

	parenttype = frappe.db.get_value("Fabric Process Route", {"parent": stylemaster}, "parenttype")
	for candidate in (parenttype, "Style Master Costing", "Style Master"):
		if candidate and frappe.db.exists(candidate, stylemaster):
			parenttype = candidate
			break
	else:
		frappe.throw(_("Style {0} not found.").format(stylemaster))

	parent = frappe.get_doc(parenttype, stylemaster)
	parent.check_permission("write")

	if isinstance(process_route, str):
		process_route = json.loads(process_route)

	meta = frappe.get_meta("Fabric Process Route")
	writable = {df.fieldname for df in meta.fields}

	frappe.db.delete(
		"Fabric Process Route",
		{"parent": stylemaster, "fabric_name": fabric_name},
	)

	for idx, row in enumerate(process_route, start=1):
		values = {k: v for k, v in row.items() if k in writable}
		values.update(
			{
				"doctype": "Fabric Process Route",
				"fabric_name": fabric_name,
				"parent": stylemaster,
				"parenttype": parenttype,
				"parentfield": "process_route_table",
				"idx": idx,
			}
		)
		frappe.get_doc(values).insert(ignore_permissions=True)
