# Copyright (c) 2022, Auriga and contributors
# See license.txt
"""End-to-end checks for the v13 -> v16 port of Style Master."""

import frappe
from frappe.tests import IntegrationTestCase

from style_master_costing import queries
from style_master_costing.style_master_costing.doctype.fabric_process_route import (
	fabric_process_route as fpr,
)

LINK_QUERY_ARGS = {"txt": "", "searchfield": "name", "start": 0, "page_len": 20}

# This app overrides Item.autoname, so every Item gets a generated code
# (F-0000001, T-0000001, ...). ERPNext's shared test records expect to keep the
# codes they ask for (_Test Item and friends), so this suite opts out of them
# and builds exactly the fixtures it needs.
EXTRA_TEST_RECORD_DEPENDENCIES = []


class TestStyleMaster(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.fabric_group = _mk(
			"Item Group",
			item_group_name="SMC Test Fabric",
			parent_item_group="All Item Groups",
			is_group=0,
			group_category="Fabric",
		)
		cls.trims_group = _mk(
			"Item Group",
			item_group_name="SMC Test Trims",
			parent_item_group="All Item Groups",
			is_group=0,
			group_category="Trims",
		)
		cls.fabric_item = _mk(
			"Item",
			item_name="SMC Test Poplin",
			item_group=cls.fabric_group,
			stock_uom="Meter",
			is_stock_item=0,
			composition="100% Cotton",
		)
		cls.trim_item = _mk(
			"Item",
			item_name="SMC Test Button",
			item_group=cls.trims_group,
			stock_uom="Nos",
			is_stock_item=0,
			composition="Polyester",
		)
		cls.customer = _mk("Customer", customer_name="SMC Test Buyer")
		cls.product = _mk("Product", product_name="SMC Mens Shirt")

	# --- Item override -------------------------------------------------
	def test_item_code_series_follows_item_group_category(self):
		"""StyleItem.autoname prefixes the item code from Item Group.group_category."""
		self.assertTrue(self.fabric_item.startswith("F-"), self.fabric_item)
		self.assertTrue(self.trim_item.startswith("T-"), self.trim_item)

	def test_item_validate_sets_qr_code(self):
		self.assertTrue(frappe.db.get_value("Item", self.fabric_item, "qr_code"))

	# --- the style DocType ------------------------------------------------
	def test_style_master_lifecycle(self):
		doc = self._build("Style Master")
		self.assertEqual(len(doc.fabric_table), 1)
		self.assertEqual(len(doc.trims_table), 1)
		doc.submit()
		self.assertEqual(doc.docstatus, 1)
		doc.cancel()
		self.assertEqual(doc.docstatus, 2)

		amended = frappe.copy_doc(doc)
		amended.amended_from = doc.name
		amended.docstatus = 0
		amended.insert()
		self.assertEqual(amended.amended_from, doc.name)

	def test_style_master_uses_native_tabs(self):
		"""The v13 jQuery tab overlay is replaced by real Tab Break fields."""
		tabs = [f.label for f in frappe.get_meta("Style Master").fields if f.fieldtype == "Tab Break"]
		self.assertEqual(len(tabs), 10, f"{tabs}")
		self.assertEqual(tabs[0], "Style Details")

	def test_amended_from_points_at_own_doctype(self):
		"""v13 pointed Style Master Costing's amended_from at Style Master."""
		df = frappe.get_meta("Style Master").get_field("amended_from")
		self.assertEqual(df.options, "Style Master")

	def test_style_details_tab_carries_the_header_fields(self):
		"""The header fields belong on Style Details, not scattered across later tabs."""
		meta = frappe.get_meta("Style Master")
		order = [f.fieldname for f in meta.fields]
		tab_idx = [i for i, f in enumerate(meta.fields) if f.fieldtype == "Tab Break"]
		first_tab = set(order[tab_idx[0]:tab_idx[1]])
		for fieldname in ("customer", "item", "naming_series", "style_number", "merchandiser", "season", "segment"):
			self.assertIn(fieldname, first_tab, f"{fieldname} is not on the Style Details tab")

	# --- whitelisted endpoints the client script calls -------------------
	def test_link_queries(self):
		self.assertTrue(queries.fabric_item_group_wise_items(doctype="Item", filters=None, **LINK_QUERY_ARGS))
		self.assertTrue(queries.trims_item_group_wise_items(doctype="Item", filters=None, **LINK_QUERY_ARGS))
		self.assertTrue(
			queries.value_addition_fabric(
				doctype="Item", filters={"fabrics": [self.fabric_item]}, **LINK_QUERY_ARGS
			)
		)
		# a fabric filter that matches nothing must not leak every fabric
		self.assertFalse(
			queries.value_addition_fabric(
				doctype="Item", filters={"fabrics": ["does-not-exist"]}, **LINK_QUERY_ARGS
			)
		)

	def test_get_doc_wise_columns_reads_live_meta(self):
		"""v13 read the DocType JSON off disk, ignoring Customize Form changes."""
		fields = queries.get_doc_wise_columns("fabric")["fields"]
		self.assertTrue(any(f["fieldname"] == "fabric_name" for f in fields))

	# --- process route ---------------------------------------------------
	def test_save_process_route_replaces_rows(self):
		style = self._build("Style Master")
		fpr.saveProcessRoute(
			stylemaster=style.name,
			fabric_name=self.fabric_item,
			process_route=[{"fabric_name": self.fabric_item, "process_type": "Dyeing"}],
		)
		fpr.saveProcessRoute(
			stylemaster=style.name,
			fabric_name=self.fabric_item,
			process_route=[{"fabric_name": self.fabric_item, "process_type": "Washing"}],
		)
		rows = frappe.get_all("Fabric Process Route", filters={"parent": style.name}, pluck="process_type")
		self.assertEqual(rows, ["Washing"])

	def test_save_process_route_rejects_unknown_parent(self):
		"""v13 interpolated `stylemaster` straight into a DELETE statement."""
		with self.assertRaises(frappe.ValidationError):
			fpr.saveProcessRoute(
				stylemaster="x' OR '1'='1",
				fabric_name=self.fabric_item,
				process_route=[{"process_type": "X"}],
			)

	# --- operation bulletin ----------------------------------------------
	def test_operation_bulletin_scaffold(self):
		_mk("Production Category", category_name="SMC Sewing")
		rows = frappe.new_doc("Operation Bulletin").load_category()
		self.assertEqual(len(rows) % 3, 0)
		self.assertTrue(any(r["category"] == "Total" for r in rows))

	# --- helpers ----------------------------------------------------------
	def _build(self, doctype):
		return frappe.get_doc(
			{
				"doctype": doctype,
				"style_master_name": f"TEST-{doctype}",
				"customer": self.customer,
				"item": self.product,
				"style_number": "ST-TEST",
				"currency": "INR",
				"garment_qty": 1000,
				"quote_for": "Company",
				"priority": "Medium",
				"sales_price_target": 500,
				"fabric_table": [
					{
						"fabric_name": self.fabric_item,
						"fabric_type": "Local",
						"unit": "Meter",
						"garment_qty": 1000,
						"consumption": 1.5,
						"rate_our": 120,
						"total_req_qty": 1500,
						"amount_our": 180000,
						"gst_percent": 5,
						"total_amt": 189000,
						"per_piece_value": 189,
					}
				],
				"trims_table": [
					{
						"trim_name": self.trim_item,
						"trims_type": "Local",
						"unit": "Nos",
						"trims_qty": 1000,
						"consumption": 8,
						"rate_our": 2,
						"total_req_qty": 8000,
						"amount_our": 16000,
						"gst_percent": 5,
						"total_amt": 16800,
						"per_piece_value": 16.8,
					}
				],
				"manufacturing_cost": [{"cost_head": "CMT", "rate_our": 45, "based_on": "Qty"}],
				"other_cost": [{"cost_head": "COMMISSION", "rate_our": 10}],
				"size": [{"size": "M"}, {"size": "L"}],
			}
		).insert()


def _mk(doctype, **kwargs):
	doc = frappe.get_doc({"doctype": doctype, **kwargs})
	doc.insert(ignore_if_duplicate=True)
	return doc.name
