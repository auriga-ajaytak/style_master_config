# Copyright (c) 2022, Auriga and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class Timeandaction(Document):
	pass


@frappe.whitelist()
def getTableData(time_and_action):
	if not time_and_action:
		frappe.throw(_("Please select time and action first."))
	return frappe.get_doc("Time and action", time_and_action)
