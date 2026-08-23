from frappe import _


def get_data():
	return {
		"fieldname": "style_master",
		"non_standard_fieldnames": {
			"Operation Bulletin": "style_no",
		},
		"internal_links": {
			"Sales Order": ["items", "sales_order"],
		},
		"transactions": [
			{"label": _("Related"), "items": ["Operation Bulletin"]},
			{"label": _("Reference"), "items": ["Sales Order"]},
		],
	}
