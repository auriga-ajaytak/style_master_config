"""Whitelisted link queries and metadata helpers used by Style Master.

Ported from cmv_erp_style_master_addon (Frappe v13). All queries are now
parameterised — the v13 originals interpolated user input straight into SQL.
"""

import frappe
from frappe import _
from frappe.query_builder import DocType


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def get_merchandisers(doctype, txt, searchfield, start, page_len, filters):
	"""Employees belonging to the Merchandising department."""
	employee = DocType("Employee")
	department = DocType("Department")
	return (
		frappe.qb.from_(employee)
		.inner_join(department)
		.on(department.name == employee.department)
		.select(employee.name, employee.employee_name)
		.where(department.department_name == "Merchandising")
		.where(employee.name.like(f"%{txt}%") | employee.employee_name.like(f"%{txt}%"))
		.limit(page_len)
		.offset(start)
	).run()


def _items_by_group_category(category, txt, start, page_len, names=None):
	item = DocType("Item")
	item_group = DocType("Item Group")
	query = (
		frappe.qb.from_(item)
		.inner_join(item_group)
		.on(item.item_group == item_group.name)
		.select(item.name, item_group.name, item_group.parent_item_group)
		.where(item_group.group_category == category)
		.where(item.name.like(f"%{txt}%") | item.item_name.like(f"%{txt}%"))
	)
	if names:
		query = query.where(item.name.isin(names))
	return query.limit(page_len).offset(start).run()


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def fabric_item_group_wise_items(doctype, txt, searchfield, start, page_len, filters):
	return _items_by_group_category("Fabric", txt, start, page_len)


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def trims_item_group_wise_items(doctype, txt, searchfield, start, page_len, filters):
	return _items_by_group_category("Trims", txt, start, page_len)


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def value_addition_fabric(doctype, txt, searchfield, start, page_len, filters):
	"""Fabric items, optionally narrowed to the fabrics already on the style."""
	names = (filters or {}).get("fabrics") or None
	return _items_by_group_category("Fabric", txt, start, page_len, names=names)


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def buyer_lab_testing_template(doctype, txt, searchfield, start, page_len, filters):
	"""Lab Testing Templates for the buyer, falling back to all templates."""
	customer = (filters or {}).get("customer")
	template = DocType("Lab Testing Template")
	query = frappe.qb.from_(template).select(template.template_name)
	if customer and frappe.db.count("Lab Testing Template", {"buyer": customer}):
		query = query.where(template.buyer == customer)
	if txt:
		query = query.where(template.template_name.like(f"%{txt}%"))
	return query.limit(page_len).offset(start).run()


@frappe.whitelist()
def get_doc_wise_columns(doctypename):
	"""Return DocType metadata used to build the frappe-datatable columns.

	v13 read the doctype's JSON file straight off disk, which ignored any
	Customize Form changes. v16 reads the live meta instead.
	"""
	doctype = frappe.unscrub(doctypename)
	if not frappe.db.exists("DocType", doctype):
		frappe.throw(_("DocType {0} not found").format(doctype))
	return frappe.get_meta(doctype).as_dict()
