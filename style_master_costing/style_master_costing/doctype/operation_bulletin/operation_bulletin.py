# Copyright (c) 2022, Auriga and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

BLANK_ROW = {
	"smv": 0.0,
	"ssv": 0.0,
	"allocated_manpower": 0.0,
	"h_target_hr": 0.0,
	"s_target_hr": 0.0,
	"day_target": 0.0,
	"grade_value": 0.0,
	"no_of_machines": 0.0,
	"total_grade": 0.0,
	"rate_per_piece": 0,
}


class OperationBulletin(Document):
	@frappe.whitelist()
	def load_category(self):
		"""Build the operation-bulletin scaffold: one header, one editable and
		one total row per Production Category."""
		categories = frappe.get_all("Production Category", pluck="name", order_by="name")

		rows = []
		for idx, category in enumerate(categories):
			rows.append(
				{
					"category": category,
					"parent": category,
					"lock_row": 1,
					"row_idx": idx * 3,
					"position": idx,
				}
			)
			rows.append({**BLANK_ROW, "category": " ", "lock_row": 0, "parent": category, "position": idx})
			rows.append(
				{**BLANK_ROW, "category": "Total", "lock_row": 1, "parent": category, "position": idx}
			)
		return rows
