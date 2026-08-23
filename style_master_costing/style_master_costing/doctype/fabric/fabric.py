# Copyright (c) 2022, Auriga and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Fabric(Document):
	pass


@frappe.whitelist()
def get_doc_columns():
	"""Fabric child-table metadata for the frappe-datatable grid."""
	return frappe.get_meta("Fabric").as_dict()
