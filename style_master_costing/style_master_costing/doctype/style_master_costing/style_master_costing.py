# Copyright (c) 2023, Auriga and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

from style_master_costing.queries import (
	fabric_item_group_wise_items,
	get_doc_wise_columns,
	get_merchandisers,
	trims_item_group_wise_items,
	value_addition_fabric,
)


class StyleMasterCosting(Document):
	pass
