# Copyright (c) 2022, Auriga and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Process(Document):
	pass


@frappe.whitelist()
def get_routes_list(process_name):
	return frappe.get_all(
		"Process",
		filters={"parent": process_name},
		fields=["process_name", "process_description"],
		order_by="idx",
	)
