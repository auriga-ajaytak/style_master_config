# Copyright (c) 2022, Auriga and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

# Link queries live in style_master_costing.queries; re-exported here so that
# older `set_query` paths keep resolving.
from style_master_costing.queries import (
	fabric_item_group_wise_items,
	get_doc_wise_columns,
	get_merchandisers,
	trims_item_group_wise_items,
	value_addition_fabric,
)


class StyleMaster(Document):
	pass
