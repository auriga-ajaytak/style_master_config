# Copyright (c) 2022, Auriga and contributors
# For license information, please see license.txt

from base64 import b64encode
from io import BytesIO

import frappe
from erpnext.stock.doctype.item.item import Item
from frappe.model.naming import make_autoname

# Item code prefix by Item Group -> group_category (a custom field this app adds)
ITEM_CODE_PREFIX = {
	"Fabric": "F-",
	"Trims": "T-",
	"Capital Goods": "CG-",
	"Consumables": "C-",
	"Garment": "G-",
	"Stationary": "S-",
	"Yarn": "Y-",
}
DEFAULT_ITEM_CODE_PREFIX = "I-"


class StyleItem(Item):
	def autoname(self):
		super().autoname()
		self.set_item_code()
		self.name = self.item_code

	def set_item_code(self):
		if not self.item_group:
			return
		category = frappe.db.get_value("Item Group", self.item_group, "group_category")
		prefix = ITEM_CODE_PREFIX.get(category, DEFAULT_ITEM_CODE_PREFIX)
		self.item_code = make_autoname(prefix + ".#######")


@frappe.whitelist()
def get_item_sub_group(item_group):
	if not item_group:
		return []
	return frappe.get_all("Item Group", filters={"parent_item_group": item_group})


def validate(doc, event):
	"""Refresh the item's QR code payload."""
	doc.qr_code = get_qr_code(
		"Item Code - {}\nItem Name - {}\nItem Group - {}\nHSN/SAC - {}".format(
			doc.item_code, doc.item_name, doc.item_group, doc.get("gst_hsn_code") or ""
		)
	)


def get_qr_code(data: str) -> str:
	"""Return a PNG data: URI so the browser can render it inline."""
	import qrcode

	buffered = BytesIO()
	qrcode.make(data).save(buffered, format="PNG")
	return "data:image/png;base64, " + b64encode(buffered.getvalue()).decode("utf-8")
