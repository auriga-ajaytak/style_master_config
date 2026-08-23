// Copyright (c) 2022, Auriga and contributors
// For license information, please see license.txt
//
// Quotations in this app quote *styles*, not items, so the standard item and
// tax layout is hidden and the `styles` child table drives the document.

frappe.ui.form.on("Quotation", {
	refresh: function (frm) {
		hide_core_fields_sections(frm);
	},
	onload_post_render: function (frm) {
		$(".custom-actions").hide();
	},
	currency: function (frm) {
		frm.set_currency_labels(["rate"], frm.doc.currency, "styles");
	},
});

// v13 read cur_frm.fields_dict.items.grid unguarded. The first refresh hides
// `items`, so on the next refresh the control no longer exists and the form
// threw "Cannot read properties of undefined (reading 'grid')".
function hide_core_fields_sections(frm) {
	const items_grid = frm.fields_dict.items && frm.fields_dict.items.grid;
	if (items_grid) {
		["item_code", "item_name", "qty", "uom"].forEach((f) => items_grid.toggle_reqd(f, 0));
	}

	frm.set_df_property("items", "reqd", 0);

	[
		"items",
		"ignore_pricing_rule",
		"selling_price_list",
		"sec_break23",
		"taxes_section",
		"section_break_36",
		"sec_tax_breakup",
		"section_break_39",
		"section_break_44",
		"totals",
		"print_settings",
		"auto_repeat_section", // v13: subscription_section
		"more_info_tab", // v13: more_info
	].forEach((fieldname) => {
		if (frm.get_docfield(fieldname)) {
			frm.set_df_property(fieldname, "hidden", 1);
		}
	});
}

frappe.ui.form.on("Quotation Style Master", {
	style_master: function (frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		if (!row.style_master) return;

		const duplicate = (frm.doc.styles || []).some(
			(other) => other.name !== row.name && other.style_master === row.style_master
		);
		if (duplicate) {
			frappe.model.set_value(cdt, cdn, "style_master", "");
			frappe.throw(__("Style {0} is already on this quotation.", [row.style_master]));
		}
	},
});
