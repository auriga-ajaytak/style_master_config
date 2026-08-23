app_name = "style_master_costing"
app_title = "Style Master Costing"
app_publisher = "Auriga IT"
app_description = "Apparel style master and style costing for ERPNext"
app_email = "ajay@aurigait.com"
app_license = "mit"

# Apps
# ------------------

required_apps = ["erpnext"]

# Includes in <head>
# ------------------

# Shared Style Master / Style Master Costing form logic. In v13 this was three
# near-identical copies wired up through doctype_js; it is now one bundle.
app_include_js = "style_master_costing.bundle.js"

# include js in doctype views
doctype_js = {
	"Item": "public/js/item.js",
	"Quotation": "public/js/quotation.js",
}

doctype_list_js = {
	"Item": "public/js/item_list.js",
}

# DocType Class
# ---------------
# Override standard doctype classes

override_doctype_class = {
	"Item": "style_master_costing.docevents.item.StyleItem",
}

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
	"Quotation": {
		"validate": "style_master_costing.docevents.quotation.validate",
	},
	"Item": {
		"validate": "style_master_costing.docevents.item.validate",
	},
}

# Fixtures
# --------
# Master data this app ships. The v13 app also exported a site-wide dump of all
# 34 Workspaces, which would overwrite the standard ERPNext ones - the Styling
# workspace is a proper app workspace here instead.

fixtures = [
	{"dt": "Cost Head"},
	{"dt": "Cost Type"},
	{"dt": "Merchandiser"},
	{"dt": "Production Process"},
	{"dt": "Season"},
	{"dt": "Segment"},
	{"dt": "Value Addition"},
]
