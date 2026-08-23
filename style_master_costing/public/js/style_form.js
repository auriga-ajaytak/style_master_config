// Copyright (c) 2022, Auriga and contributors
// For license information, please see license.txt
//
// Shared form logic for Style Master and Style Master Costing.
// Ported from cmv_erp_style_master_addon (Frappe v13) -> Frappe v16.
//
// Changes from v13:
//   * the jQuery tab overlay (setupTabView) is gone - the DocTypes now use
//     native `Tab Break` fields
//   * child-table handlers register once instead of on every form load
//   * one implementation instead of three near-identical copies

frappe.provide("style_master_costing");

// v13 called frappe.ui.form.on() for child DocTypes from inside the parent's
// onload, so handlers accumulated with every form load. Register once.
style_master_costing._child_handlers = {};
style_master_costing.on_child = function (doctype, handlers) {
	if (style_master_costing._child_handlers[doctype]) return;
	style_master_costing._child_handlers[doctype] = true;
	frappe.ui.form.on(doctype, handlers);
};

style_master_costing.style_form = {
	refresh:function(frm){
		$('.page-wrapper .page-content').find('.layout-side-section').css('display','none');
		cur_frm.get_field('size').grid.grid_buttons.css({'visibility':'hidden'});
		cur_frm.fields_dict['size'].grid.wrapper.find('.btn-open-row').hide();

		cur_frm.fields_dict["process_route_table"].grid.add_custom_button(__('Save Process Route'), 
			function(frm) {
				saveProcessRoute(frm);
        });
        cur_frm.fields_dict["process_route_table"].grid.grid_buttons.find('.btn-custom').removeClass('btn-default').addClass('btn-primary');

		frm.setupFabricProcessRoute(frm);

		cur_frm.fields_dict["trims_process_route_table"].grid.add_custom_button(__('Save Process Route'), 
			function(frm) {
				saveTrimProcessRoute(frm);
        });
        cur_frm.fields_dict["trims_process_route_table"].grid.grid_buttons.find('.btn-custom').removeClass('btn-default').addClass('btn-primary');

		cur_frm.fields_dict['template_table'].grid.grid_buttons.hide(); // lab template table hide add or delete button
		setupTrimProcessRoute(frm);
		frm.getCostingTable(frm);
		hideTechpackEdit(frm);
		if(typeof frm.is_new() == 'undefined' && frm.is_new() == 'undefined'){			
			if(frm.doc.techpack_table.length > 0){
				let techpackData = frm.doc.techpack_table[frm.doc.techpack_table.length-1];
				techpackData.view_data = 1;
				frm.refresh_field('techpack_table');
				loadTechpack(frm, techpackData);
			}
		}

		cur_frm.fields_dict["smv_table"].grid.add_custom_button(__('Sync SMV Price'), 
			function(frm) {
				cur_frm.trigger('syncSmvPrice');
        });
		cur_frm.fields_dict["smv_table"].grid.grid_buttons.find('.btn-custom').removeClass('btn-default').addClass('btn-primary');

		// loadTechpack(frm); // load techpack when refresh or when load
		// loadFabricTable(frm);

		Object.keys(frm.html_datatable_arr).forEach(function(value, index, array){
            frm.get_docwise_columns(value); // setup table columns
            setTimeout(function(){
                frm.setupDataTable(value, index, array); 
            },2000);            
        });
	},
	updateCoreTable: function (frm){
        if(frm.process_route_settings > 0){
            frm.setup_process_route_data(frm);
            frm.process_route_settings = 0;
        }
        let htmlTableData = frm.datatable[frm.setuptablename].datamanager.data;
        let doctable = frm.html_datatable_arr[frm.setuptablename]['table'];
        if(typeof frm.is_new() == 'undefined'){    
            frm.doc[doctable] = [];    
        }
        frm.clear_table(doctable);
        htmlTableData.forEach(function(eh){
            let row = frm.add_child(doctable, eh);
        });
        frm.refresh_field(doctable);

        if(frm.executeCosting > 0){
            frm.getCostingTable(frm);
            frm.executeCosting = 0;
          }
    },
	onload: function(frm) {
		frm.roundDecimal = (num, decimalPlaces = 0) => {
            num = Math.round(num + "e" + decimalPlaces);
            return Number(num + "e" + -decimalPlaces);
        }
		frm.set_query("fabric_name","fabric_table", function(doc, cdt, cdn){
			return {
				"query":"style_master_costing.queries.fabric_item_group_wise_items"
				// "filters":[
				// 	["Item Group","is_item_fabric","=",1]
				// ]
			}
		});

		frm.set_query("fabric","value_addition", function(doc, cdt, cdn){
			let fabrics = [];
			cur_frm.doc.fabric_table.forEach(function(prs){
				fabrics.push(prs.fabric_name);
			});
			return {
				"query":"style_master_costing.queries.value_addition_fabric",
				"filters":{
					'fabrics':fabrics
				}
			}
		});

		frm.set_query("lab_testing_template","template_table", function(doc, cdt, cdn){
			return {
				"query":"style_master_costing.queries.buyer_lab_testing_template",
				"filters":{
					'customer':frm.doc.customer
				}
			}
		});

		

		frm.set_query("trim_name","trims_table", function(){
			return {
				"query":"style_master_costing.queries.trims_item_group_wise_items"
				// filters:{
				// 	'item_group':'Trims'
				// }
			}
		});

		frm.process_route_settings = 0; // for display settings.
        frm.datatable = {}	
        frm.datatable_columns = {};
        frm.html_datatable_arr = {
            'fabric':{
                'doctypeKey':'fabric',
                'table':'fabric_table',
                'doctype':'Fabric',
                'html_table':'fabric_html_table',
                'table_buttons':'fabric_table_buttons'
            },
            'trims':{
                'doctypeKey':'trims',
                'table':'trims_table',
                'doctype':'Trims',
                'html_table':'trims_html_table',
                'table_buttons':'trims_table_buttons'
            },
        }
        
        frm.blank_row = false;			
		
		let sidebar_toggle = $('.page-head').find('.sidebar-toggle-btn');
		sidebar_toggle.click(()=>{
			// frm.datatable.refresh(frm.datatable.datamanager.data);
		})
        /**
         * function to calculate the total amount on row basis data
         */
         frm.calculateFabricTableTotalRow = function(row){
            

            let total_amt = 0;
            let total_amt_buyer = 0;
            let total_req_qty = 0;
            let total_reqd_qty_buyer = 0;
            let insurance_amt = 0;
            let rate_our = 0;
            let amount_our = 0;
            let rate_buyer = 0;
            let amount_buyer = 0;

            if(row.total_req_qty > 0){
                total_req_qty = row.total_req_qty;
            }
            if(row.total_reqd_qty_buyer > 0){
                total_reqd_qty_buyer = row.total_reqd_qty_buyer;
            }
            if(row.rate_our > 0){
                rate_our = row.rate_our;
            }
            if(row.rate_buyer > 0){
                rate_buyer = row.rate_buyer;
            }

            amount_our = (rate_our * total_req_qty);
            row.amount_our = frm.round(amount_our,2);

            amount_buyer = (rate_buyer * total_reqd_qty_buyer);
            row.amount_buyer = frm.round(amount_buyer,2);

            if(row.insurance_amt > 0){
                insurance_amt = row.insurance_amt;
                amount_our = amount_our + insurance_amt;
                amount_buyer = amount_buyer + insurance_amt;
            }

            let freight_with_gst_our = row.freight_with_gst > 0 ? row.freight_with_gst : 0;
            let freight_with_gst_buyer = row.freight_with_gst > 0 ? row.freight_with_gst : 0;

            if(row.freight_based_on == 'Percentage'){
                freight_with_gst_our = ((amount_our*row.freight_with_gst)/100);
                freight_with_gst_buyer = ((amount_buyer*row.freight_with_gst)/100);
            }

            let freight_amt = freight_with_gst_our;

            amount_our = amount_our + freight_with_gst_our;
            amount_buyer = amount_buyer + freight_with_gst_buyer
            row.freight_amt = frm.round(freight_amt,2);

            if(row.fabric_type == 'Import' && row.import_duty > 0){
                let import_duty = ((amount_our * row.import_duty)/100);
                let import_duty_buyer = ((amount_buyer * row.import_duty)/100);
                amount_our = amount_our + import_duty;
                amount_buyer = amount_buyer + import_duty_buyer;
                row.import_duty_amt = frm.round(import_duty,2);
            }

            if(row.fabric_type == 'Import' && row.handling_charges > 0){
                let handling_charges = row.handling_charges;
                amount_our = amount_our + handling_charges;
                amount_buyer = amount_buyer + handling_charges;
            }
            if(row.gst_percent > 0){
                let gst_percent = row.gst_percent;
                let gst_amt_our = ((amount_our*gst_percent)/100);
                let gst_amt_buyer = ((amount_buyer*gst_percent)/100);

                row.gst_amt = frm.round(gst_amt_our, 2);

                amount_our = amount_our + gst_amt_our;
                amount_buyer = amount_buyer + gst_amt_buyer;
            }

            total_amt = amount_our;
            total_amt_buyer = amount_buyer;

            row.total_amt = frm.round(total_amt, 2);
            row.total_amt_buyer = frm.round(total_amt_buyer, 2);

            let per_piece_value = (total_amt / row.garment_qty);

            row.per_piece_value = frm.round(per_piece_value, 2);
            let per_piece_value_buyer = (total_amt_buyer / row.garment_qty);

            row.per_piece_value_buyer = frm.round(per_piece_value_buyer, 2);

            frm.datatable[frm.setuptablename].refresh(frm.datatable[frm.setuptablename].datamanager.data);

        }
        /**
        * function to calculate total qty on row basis data
        */
        frm.calulateFabricTableTotalRowQty = function(rowData){
            let total_req_qty = 0;
            let total_reqd_qty_buyer = 0;
            let garment_qty = 0;
            let consumption = 0;
            let consumption_buyer = rowData.consumption_buyer > 0 ? rowData.consumption_buyer : 0;
            let purchase_extra = 0;
            let production_extra = 0;
            let garment_wastage = 0;
            let sample_qty = 0;
            if(rowData.garment_qty > 0){
                garment_qty = rowData.garment_qty;
            }
            if(rowData.consumption > 0){
                consumption = rowData.consumption;
            }
            if(rowData.purchase_extra > 0 && garment_qty > 0){
                purchase_extra = ((garment_qty*rowData.purchase_extra)/100);
            }
            if(rowData.production_extra > 0 && garment_qty > 0){
                production_extra = ((garment_qty*rowData.production_extra)/100);
            }
            if(rowData.garment_wastage > 0 && garment_qty > 0){
                garment_wastage = ((garment_qty*rowData.garment_wastage)/100);
            }
            if(rowData.sample_qty > 0){
                sample_qty = row.sample_qty;
            }

            total_req_qty = (((garment_qty + purchase_extra + production_extra + garment_wastage) * consumption) + sample_qty);
            total_reqd_qty_buyer = (((garment_qty + purchase_extra + production_extra + garment_wastage) * consumption_buyer) + sample_qty);

            rowData.total_req_qty = frm.round(total_req_qty, 2);
            if(typeof rowData.total_reqd_qty_buyer !== 'undefined')
                rowData.total_reqd_qty_buyer = frm.round(total_reqd_qty_buyer, 2);
            
            frm.datatable[frm.setuptablename].refresh(frm.datatable[frm.setuptablename].datamanager.data);
        }

        /**
 * For Trims Table
 * function to calculate the total amount on row basis data
 */
  frm.calculateTrimsTableTotalRow = (row) => {
	// let row = locals[cdt][cdn];

	let total_amt = 0;
	let total_amt_buyer = 0;
	let total_req_qty = 0;
	let total_req_qty_buyer = 0;
	let insurance_amt = 0;
	let rate_our = 0;
	let rate_buyer = 0;
	let amount_our = 0;
	let amount_buyer = 0;

	if(row.total_req_qty > 0){
		total_req_qty = row.total_req_qty;
	}
	if(row.total_req_qty_buyer > 0){
		total_req_qty_buyer = row.total_req_qty_buyer;
	}
	if(row.rate_our > 0){
		rate_our = row.rate_our;
	}
	if(row.rate_buyer > 0){
		rate_buyer = row.rate_buyer;
	}

	amount_our = (row.per_garment * (rate_our * total_req_qty));
	row.amount_our = frm.round(amount_our, 2);

	amount_buyer = (row.per_garment * (rate_buyer * total_req_qty_buyer));
	row.amount_buyer = frm.round(amount_buyer, 2);

	if(row.insurance_amt > 0){
		insurance_amt = row.insurance_amt;
		amount_our = amount_our + insurance_amt;
		amount_buyer = amount_buyer + insurance_amt;
	}

	let freight_with_gst_our = row.freight_with_gst > 0 ? row.freight_with_gst : 0;
	let freight_with_gst_buyer = row.freight_with_gst > 0 ? row.freight_with_gst : 0;

	if(row.freight_based_on == 'Percentage'){
		freight_with_gst_our = ((amount_our*row.freight_with_gst)/100);
		freight_with_gst_buyer = ((amount_buyer*row.freight_with_gst)/100);
	}

	let freight_amt_our = freight_with_gst_our;

	amount_our = amount_our + freight_with_gst_our;
	amount_buyer = amount_buyer + freight_with_gst_buyer;
	row.freight_amt = frm.round(freight_amt_our, 2);

	if(row.trims_type == 'Import' && row.import_duty > 0){
		let import_duty_our = ((amount_our * row.import_duty)/100);
		amount_our = amount_our + import_duty_our;
		let import_duty_buyer = ((amount_buyer * row.import_duty)/100);
		amount_buyer = amount_buyer + import_duty_buyer;
		row.import_duty_amt = frm.round(import_duty_our, 2);
	}

	if(row.trims_type == 'Import' && row.handling_charges > 0){
		let handling_charges = row.handling_charges;
		amount_our = amount_our + handling_charges;
		amount_buyer = amount_buyer + handling_charges;
	}
	if(row.gst_percent > 0){
		let gst_percent = row.gst_percent;
		let gst_amt_our = ((amount_our*gst_percent)/100);
		let gst_amt_buyer = ((amount_buyer*gst_percent)/100);

		row.gst_amt = frm.round(gst_amt_our, 2);

		amount_our = amount_our + gst_amt_our;
		amount_buyer = amount_buyer + gst_amt_buyer;
	}

	total_amt = amount_our;
	total_amt_buyer = amount_buyer;

	row.total_amt = frm.round(total_amt, 2);
	row.total_amt_buyer = frm.round(total_amt_buyer, 2);

	let per_piece_value_our = (total_amt / row.trims_qty);

	row.per_piece_value = frm.round(per_piece_value_our, 2);

	let per_piece_value_buyer = (total_amt_buyer / row.trims_qty);

	row.per_piece_value_buyer = frm.round(per_piece_value_buyer, 2);

	frm.datatable[frm.setuptablename].refresh(frm.datatable[frm.setuptablename].datamanager.data);

}
/**
 * For Trims table
 * function to calculate total qty on row basis data
 */
frm.calulateTrimsTableTotalRowQty = (row) => {
	// let row = locals[cdt][cdn];
	let total_req_qty = 0;
	let total_req_qty_buyer = 0;
	let trims_qty = 0;
	let consumption = 0;
	let consumption_buyer = 0;
	let purchase_extra = 0;
	let production_extra = 0;
	let trims_wastage = 0;
	let sample_qty = 0;
	if(row.trims_qty > 0){
		trims_qty = row.trims_qty;
	}
	if(row.consumption > 0){
		consumption = row.consumption;
	}
	consumption_buyer = (row.consumption_buyer > 0) ? row.consumption_buyer : 0;
	if(row.purchase_extra > 0 && trims_qty > 0){
		purchase_extra = ((trims_qty*row.purchase_extra)/100);
	}
	if(row.production_extra > 0 && trims_qty > 0){
		production_extra = ((trims_qty*row.production_extra)/100);
	}
	if(row.trims_wastage > 0 && trims_qty > 0){
		trims_wastage = ((trims_qty*row.trims_wastage)/100);
	}
	if(row.sample_qty > 0){
		sample_qty = row.sample_qty;
	}

	total_req_qty = (((trims_qty + purchase_extra + production_extra + trims_wastage) * consumption) + sample_qty);
	total_req_qty_buyer = (((trims_qty + purchase_extra + production_extra + trims_wastage) * consumption_buyer) + sample_qty);

	row.total_req_qty = frm.round(total_req_qty, 2);
	row.total_req_qty_buyer = frm.round(total_req_qty_buyer, 2);

	frm.datatable[frm.setuptablename].refresh(frm.datatable[frm.setuptablename].datamanager.data);
}

		
		frm.load_datatable = function (data) {
           let dynamic_html_table = frm.html_datatable_arr[frm.setuptablename]['html_table']; // html field
           let dynamic_doctype_field = frm.html_datatable_arr[frm.setuptablename]['table']; // doctype table field name
           let dynamic_doctype_table = frm.setuptablename; // doctype table name
		  frm.$child_wrapper = frm.fields_dict[dynamic_html_table].$wrapper;
		  frm.$child_wrapper.empty();
		  let random_id = Math.floor(Math.random() * 1000000000 + 1);
		  let $datatable_wrapper = $(
			`<div class="datatable-wrapper" id="${random_id}">`
		  );
          
          let table_columns = frm.make_columns(dynamic_doctype_table);          
          table_columns.sort(frm.GetSortOrder("col_sequence"));
		  frm.$child_wrapper.append($datatable_wrapper);
		  frm.datatable[dynamic_doctype_table] = new frappe.DataTable($datatable_wrapper.get(0), {
			columns: table_columns,
			data: data,
			getEditor: frm.get_editing_object.bind(frm),
			cellHeight: 35,
			width: "auto",
			layout: 'fixed', // fixed, fluid, ratio
			// inlineFilters: true,
			serialNoColumn: true,
            checkboxColumn: true,
			noDataMessage: __("No Data"),
			disableReorderColumn: true,
			dynamicRowHeight: false,
			freezeMessage: 'updating...',
            checkedRows:[],
            getCheckedRows: ()=>{
                return this.datatable[dynamic_doctype_table].rowmanager
                    .getCheckedRows()
                    .map(i => parseInt(i, 10));
            },
            events:{
                onCheckRow:(row) => {
                    Object.keys(this.datatable).forEach(function(val,index){
                        let valarr = frm.datatable[val].rowmanager.getCheckedRows();
                        if(valarr.length > 0){
                            frm.setuptablename = val;
                        }
                    });
                    frm.setup_action_buttons(frm.setuptablename);
                }
            }
            
		});
        
        
        frm.setColorStyle(table_columns);
        frm.set_listeners(dynamic_doctype_table);
		  document.getElementsByClassName("dt-scrollable")[0].style.overflow=null
          frm.refresh_field(dynamic_html_table);
          frm.datatable[dynamic_doctype_table].refresh();
		}

        frm.setColorStyle = (table_columns) => {
            if(table_columns.length > 0){
                
                table_columns.forEach(function(columnData, index){                    
                    if(typeof columnData.docfield.description !== 'undefined' && columnData.docfield.description){                        
                        index = parseInt(index) + 2;                        
                        let cellstr = '.dt-cell--col-'+index;                        
                        let parsedSettings = JSON.parse(columnData.docfield.description);   
                        if(typeof parsedSettings !== 'undefined' && typeof parsedSettings.backgroundColor !== 'undefined')                     
                            frm.datatable[frm.setuptablename].style.setStyle(cellstr, {backgroundColor:parsedSettings.backgroundColor});
                    }
                })
            }
        }

        frm.setup_action_buttons = (dynamic_doctype_table) =>{
            let checkedRows = frm.datatable[dynamic_doctype_table].options.getCheckedRows();
            let hidden = 'none';
            if(checkedRows.length > 0){
                hidden = '';
            }

            $('#delete_row_'+dynamic_doctype_table).removeClass('hidden');
            if(hidden !== ''){
                $('#delete_row_'+dynamic_doctype_table).addClass('hidden');
            }
        }
        
        
		frm.set_listeners = function (dynamic_doctype_table) {
            $("#delete_row_"+dynamic_doctype_table).on("click",()=>{ 
                frm.deleteRow(frm,dynamic_doctype_table);            
            });
            $("#add_row_"+dynamic_doctype_table).on("click",()=>{ 
                frm.setuptablename = dynamic_doctype_table;
                frm.addRow(frm,dynamic_doctype_table);            
            });
		}
		

        frm.get_docwise_columns = function(doctypename) {            
            frappe.call({
                method: "style_master_costing.queries.get_doc_wise_columns",
                args: {'doctypename':doctypename},
                callback: function(r) {
                    if(typeof r.message !== 'undefined' && typeof r.message.fields !== 'undefined'){
                        if(r.message.fields.length > 0){
                            frm.datatable_columns[doctypename] = r.message.fields;                        
                        }
                    }
                }
            });
        }
		
		// Only fabric_name / trim_name carry a width in their DocField meta. Every
		// other in_list_view field leaves it unset, so frappe-datatable fell back to
		// its 30px minimum and the BOM grids rendered as a wall of truncated headers
		// ("Consumption" -> "C..."). Fall back to a width that suits the fieldtype
		// and still fits the column label.
		const DEFAULT_COLUMN_WIDTHS = {
			"Link": 140, "Dynamic Link": 140, "Data": 140, "Select": 130,
			"Date": 110, "Datetime": 150, "Check": 70,
			"Currency": 110, "Float": 100, "Int": 90, "Percent": 90,
			"Small Text": 170, "Text": 170, "Text Editor": 170,
			"Attach": 130, "Attach Image": 130, "HTML": 120,
		};
		frm.get_column_width = function (column) {
			let width = parseInt(column.width, 10);
			if (width) return width;
			let base = DEFAULT_COLUMN_WIDTHS[column.fieldtype] || 120;
			return Math.max(base, (column.label || "").length * 8 + 28);
		};

		frm.make_columns = function (doctypename) {
			let columns = [];
            var order_seq = 1;
            frm.datatable_columns[doctypename].forEach((column) => {
                if(column.in_list_view == 1 && (typeof column.hidden == 'undefined' || column.hidden == 0)){
                    if(column.fieldname == 'fabric_name'){
                        column.get_query = "style_master_costing.queries.fabric_item_group_wise_items"                        
                    }
                    if(column.fieldname == 'trim_name'){
                        column.get_query = "style_master_costing.queries.trims_item_group_wise_items"
                    }
                    if(column.fieldname == 'component' || column.fieldname == 'panel'){
                        column.options = [""];
                    }
                    
                    let col_data = {
                        id: column.fieldname,
                        name: column.label,
                        dropdown: false,
                        align: 'center',
                        width: frm.get_column_width(column),
                        docfield: column,
                        editable: true,
                        overflow:null,
                        precision: typeof column.precision !== 'undefined' ? column.precision : false,
                        focusable: column.fieldtype=='HTML' ? false : true,
                        col_sequence:order_seq
                    }
                    if(typeof column.description !== 'undefined' && column.description){                                                                        
                        let parsedSettings = JSON.parse(column.description);   
                        if(typeof parsedSettings !== 'undefined' && typeof parsedSettings.position !== 'undefined')                     
                            col_data.col_sequence = parsedSettings.position;
                    }
                   
                    columns.push(col_data);
                    order_seq++;
                }
            });
			return columns;
		}

		frm.GetSortOrder = function(prop) {    
            return function(a, b) {    
                if (a[prop] > b[prop]) {    
                    return 1;    
                } else if (a[prop] < b[prop]) {    
                    return -1;    
                }    
                return 0;    
            }    
        } 
        
		frm.render_editing_input = function (colIndex, value, parent, dynamic_doctype_table) {
		  const col = frm.datatable[dynamic_doctype_table].getColumn(colIndex);
		  let control = null;
	
        
        if(frm.doc.is_set > 0 && col.docfield.fieldname == 'component'){			
            let component = [];
            if(typeof frm.doc.style_component !== 'undefined' && frm.doc.style_component !== 'undefined'){
                if(frm.doc.style_component.length > 0){
                    frm.doc.style_component.forEach(function(cmt){
                        component.push(cmt.component_name);
                    });
                    col.docfield.options = [""].concat(component);
                }
            }
        }

        if(frm.doc.is_panel > 0 && col.docfield.fieldname == 'panel'){			
            let panel = [];
            if(typeof frm.doc.panel_table !== 'undefined' && frm.doc.panel_table !== 'undefined'){
                if(frm.doc.panel_table.length > 0){
                    frm.doc.panel_table.forEach(function(cmt){
                        panel.push(cmt.panel_name);
                    });
                    col.docfield.options = [""].concat(panel);
                }
            }
        }

        

		  if (col.docfield.fieldtype === "Text Editor") {
			const d = new frappe.ui.Dialog({
			  title: __("Edit {0}", [col.docfield.label]),
			  fields: [col.docfield],
			  primary_action: () => {
				frm.datatable[dynamic_doctype_table].cellmanager.submitEditing();
				frm.datatable[dynamic_doctype_table].cellmanager.deactivateEditing();
				d.hide();
			  },
			});
			d.show();
			control = d.fields_dict[col.docfield.fieldname];
		  } else {
			// make control
			control = frappe.ui.form.make_control({
			  df: col.docfield,
			  parent: parent,
			  render_input: true,
			});
            
			control.set_value(value);
			control.toggle_label(false);
			control.toggle_description(false);
		  }
	
		  return control;
		}
		frm.get_editing_object = function (colIndex, rowIndex, value, parent) {
          let own_datatable_html = $(parent).closest('.frappe-control').attr('data-fieldname');
          let obj = Object.keys(frm.html_datatable_arr).find((o, i) => {
            if(frm.html_datatable_arr[o].html_table == own_datatable_html){
                frm.setuptablename = o;
            }
            // if (o.name === 'string 1') {
            //     arr[i] = { name: 'new string', value: 'this', other: 'that' };
            //     return true; // stop searching
            // }
          });
		  const control = frm.render_editing_input(colIndex, value, parent, frm.setuptablename);
		  if (!control) return false;
	
		  control.df.change = () => control.set_focus();
	
		  return {
			initValue: (value) => {
			  return control.set_value(value);
			},
			setValue: (value) => {
              frm.executeCosting = 0;
			  const cell = frm.datatable[frm.setuptablename].getCell(colIndex, rowIndex);
			  if (value != cell.content) {                
				let row_data = frm.datatable[frm.setuptablename].datamanager.getData(rowIndex);
                // var cat = frm.datatable[frm.setuptablename].datamanager.data[rowIndex].parent
                
				row_data[cell.column.id] = value;
				row_data.is_edited = 1;
				row_data.is_splited = 0;
                if(cell.column.id == 'fabric_name' || cell.column.id == 'trim_name'){
                    frappe.db.get_doc('Item', row_data[cell.column.id]).then(doc=>{
                        if(cell.column.id == 'fabric_name')
                            row_data['fabric_data_name'] = doc.item_name;
                        if(cell.column.id == 'trim_name')
                            row_data['trim_data_name'] = doc.item_name;
                        row_data['category'] = doc.item_sub_group;
                        row_data['hs_code'] = doc.gst_hsn_code;
                        row_data['description'] = doc.composition;
                        row_data['unit'] = doc.stock_uom;
                        if(typeof doc.is_nominated !== 'undefined' && doc.is_nominated == 1){
                            row_data['nominated_or_self'] = 'Nominated';
                            if (doc.supplier_items && doc.supplier_items.length > 0)
                                row_data['fabric_supplier_name'] = doc.supplier_items[0].supplier;
                        }
                        frm.datatable[frm.setuptablename].refresh(frm.datatable[frm.setuptablename].datamanager.data);
                      });
                      

                      add_row_lab_template(row_data,cell.column.id == 'fabric_name' ? 'Fabric' : 'Trims');
                      
                }
                if(cell.column.id == 'fabric_type' || cell.column.id == 'trims_type'){
                    frm.process_route_settings = 1; // set this settings to 1 when load process route table once.
                }
                const update_qty_columns = ['garment_qty','trims_qty','consumption','purchase_extra','production_extra','garment_wastage','trims_wastage','sample_qty'];                
                if(update_qty_columns.indexOf(cell.column.id) !== -1){
                    if(frm.setuptablename == 'fabric')
                        frm.calulateFabricTableTotalRowQty(row_data);
                    if(frm.setuptablename == 'trims')
                        frm.calulateTrimsTableTotalRowQty(row_data);
                }

                const update_price_columns = ['rate_our','rate_buyer','insurance_amt','freight_based_on','freight_with_gst','import_duty','handling_charges','gst_percent'];
                if(update_price_columns.indexOf(cell.column.id) !== -1){
                    if(frm.setuptablename == 'fabric')
                        frm.calculateFabricTableTotalRow(row_data);
                    if(frm.setuptablename == 'trims')
                        frm.calculateTrimsTableTotalRow(row_data);
                    
                    frm.executeCosting = 1;
                }

                if(cell.column.id == 'loss_percent'){
                    let reqd_input_qty = 0;
                    let finish_reqd_qty = row_data.finish_reqd_qty;

                    if(finish_reqd_qty > 0){
                        reqd_input_qty = (finish_reqd_qty/((100 - row_data.loss_percent)/100));
                        row_data.reqd_input_qty = frm.round(reqd_input_qty, 2);
                    }
                }
                if(cell.column.id == 'process_rate'){
                    let total_input_rate = 0;
                    let process_rate = row_data.process_rate;
                    let reqd_input_qty = row_data.reqd_input_qty;
                    let finish_reqd_qty = row_data.finish_reqd_qty;
                    let calculated_rate = 0;
                    if(process_rate > 0){
                        calculated_rate = (reqd_input_qty * process_rate);
                        total_input_rate = (calculated_rate / finish_reqd_qty)
                    }
                    row_data.total_input_rate = frm.round(total_input_rate, 2);
                }
                if(cell.column.id == 'item_rate'){
                    let total_input_rate = 0;
                    let item_rate = row_data.item_rate;
                    let reqd_input_qty = row_data.reqd_input_qty;
                    let finish_reqd_qty = row_data.finish_reqd_qty;
                    let calculated_rate = 0;
                    if(item_rate > 0){
                        calculated_rate = (reqd_input_qty * item_rate);
                        total_input_rate = (calculated_rate / finish_reqd_qty)
                    }
                    row_data.total_input_rate = frm.round(total_input_rate, 2);
                }
			  }
              cur_frm.trigger('updateCoreTable');
			  frm.datatable[frm.setuptablename].refresh(frm.datatable[frm.setuptablename].datamanager.data);              
			  frm.dirty();
			  document.getElementsByClassName("dt-scrollable")[0].style.overflow=null
            //   console.log(value);
			  return control.set_value(value);
			},
			getValue: () => {
			  return typeof control.get_value() !== 'undefined' ? control.get_value() : '';
			},
            
		  };
		},
        frm.deleteRow = function(frm, dynamic_doctype_table){
            frappe.confirm(
                "Are you sure you want to delete this row?",
                function () {
                    let row_id = frm.datatable[dynamic_doctype_table].options.getCheckedRows();
                    // console.log(row_id);
                    for(let i=0;i<row_id.length;i++){
                        frm.datatable[dynamic_doctype_table].rowmanager.checkRow(row_id[i],0);
                    frm.datatable[dynamic_doctype_table].datamanager.data.splice(
                        
                        row_id[i],
                        1
                        );                        
                        frm.datatable[dynamic_doctype_table].refresh(frm.datatable[dynamic_doctype_table].datamanager.data);
                    }
                    
                    frm.setup_action_buttons(dynamic_doctype_table);
                    // frm.dirty();
                    frm.datatable[dynamic_doctype_table].refresh(frm.datatable[dynamic_doctype_table].datamanager.data);
                },
                function () {
                    frm.setup_action_buttons(dynamic_doctype_table);
                    // console.log($(this));
                }
              );
        }
        frm.addRow = function(frm, table_name){
            
            let blank_obj = {};
            frm.datatable_columns[table_name].forEach((column) => {
                
                if(column.in_list_view == 1 && (typeof column.hidden == 'undefined' || column.hidden == 0)){
                    var fieldn = column.fieldname;  
                    if(column.fieldname == 'garment_qty' || column.fieldname == 'trims_qty'){
                        blank_obj[fieldn] = frm.doc.garment_qty;
                        
                    }
                    else                                        
                        blank_obj[fieldn] = '';         
                }
            }
            
            );
            
            if(table_name == 'fabric_process_route' || table_name == 'trims_process_route'){                
                if(typeof frm.doc[frm.html_datatable_arr[frm.html_datatable_arr[table_name]['parentTable']]['table']] !== 'undefined'){
                    frm.doc[frm.html_datatable_arr[frm.html_datatable_arr[table_name]['parentTable']]['table']].forEach(function(fb){  
                        if((typeof fb.fabric_type !== 'undefined' && fb.fabric_type == 'Process') || (typeof fb.trims_type !== 'undefined' && fb.trims_type == 'Process')){                        
                            blank_obj['finished_cons'] = fb.consumption;
                            blank_obj['finished_rate'] = fb.rate_our;
                            blank_obj['finish_reqd_qty'] = fb.total_req_qty;
                        }
                    });
                }
            }
            

            if(!frm.blank_row){    
                // console.log(frm.datatable[table_name].datamanager.data.length);                          
                frm.datatable[table_name].datamanager.data.splice(frm.datatable[table_name].datamanager.data.length + 1, 0, blank_obj);
                frm.datatable[table_name].datamanager.data.join()
                blank_obj.is_edited = 1;
                blank_obj.is_splited = 1;
                
                frm.datatable[table_name].refresh(frm.datatable[table_name].datamanager.data);
                frm.dirty();
            }
            else{
                return blank_obj;
            }
        }
        frm.addFabricChildRow = (frm) => {
            if(frm.blank_obj !== ''){
                frm.add_child('fabric_table', frm.blank_obj);
                frm.refresh_field('fabric_table');
            }
        }

        frm.setupDataTable = function(docname, index, array){
            frm.setuptablename = docname;
            let table_name = frm.html_datatable_arr[docname]['table'];
            var data_rows = [];
            
            
            if(frm.doc[table_name] !== 'undefined'){
                data_rows = frm.doc[table_name];
            }
            
            if(typeof data_rows == 'undefined'){
                // console.log('Manish');
                var data_rows = [];
                frm.blank_row = true;
                let blank_obj = frm.addRow(frm, docname);
                data_rows.push(blank_obj);
                frm.blank_row = false;
            }
            frm.load_datatable(data_rows);
      },
      frm.setup_process_route_data = (frm) =>{
            let route_data = [];
			let readonly = 1;
			
            let display_div = '';
            let display_select = '';
			if(typeof frm.doc[frm.html_datatable_arr[frm.setuptablename]['table']] !== 'undefined'){
				// frm.clear_table('process_route_table');
                let htmlTableData = frm.datatable[frm.setuptablename].datamanager.data;
				htmlTableData.forEach(function(prs){
					
					if((typeof prs.fabric_type !== 'undefined' && prs.fabric_type == 'Process')){
						readonly = 0;
						route_data.push(prs.fabric_name);
                        display_select = 'fabric_for_process';
                        display_div = 'fabric_process_route_details';
					}
                    else if(typeof prs.trims_type !== 'undefined' && prs.trims_type == 'Process'){
                        readonly = 0;
						route_data.push(prs.trim_name);
                        display_select = 'trims_for_process';
                        display_div = 'trims_process_route_details';
                    }
				});
				
                if(frm.html_datatable_arr[frm.setuptablename]['parentTable'] == 'fabric')
				    frm.showProcessRoute(frm);
                if(frm.html_datatable_arr[frm.setuptablename]['parentTable'] == 'trims')
                    frm.showTrimsProcessRoute(frm);

				frm.set_df_property(display_select, 'options', [""].concat(route_data));
				frm.set_df_property(display_select, 'read_only', readonly);
			}
			
			frm.toggle_display(display_div, readonly == 0);
			frm.refresh_field(frm.html_datatable_arr[frm.setuptablename]['table']);
      }

       frm.round = (num, decimalPlaces = 0) => {
            num = Math.round(num + "e" + decimalPlaces);
            return Number(num + "e" + -decimalPlaces);
        }

		frm.showTrimsProcessRoute = (frm) => {
			if(frm.doc.trims_for_process !== 'undefined' || frm.doc.trims_for_process !== ''){
				frm.clear_table('trims_process_route_table')
				frappe.db.get_list('Trims Process Route',{
					filters:{
						"trim_name":frm.doc.trims_for_process,
						"parent":frm.doc.name
					},
					fields:["*"],
					// fields:['fabric_name','process_name','cost_price'],
					order_by:'creation'
				}).then(res=>{
					for(let key in res){
						let cols = Object.keys(res[key]);
						let colobj = {}
						for(let i = 0;i<cols.length;i++){
							colobj[cols[i]] = res[key][cols[i]];
						}
						let row = frm.add_child('trims_process_route_table', colobj);		
					}	
					frm.refresh_field('trims_process_route_table');	
				})
			}
		}

		frm.showProcessRoute = (frm) => {
			if(frm.doc.fabric_for_process !== 'undefined' || frm.doc.fabric_for_process !== ''){
				frm.clear_table('process_route_table')
				// console.log("Enter process route");
				frappe.db.get_list('Fabric Process Route',{
					filters:{
						"fabric_name":frm.doc.fabric_for_process,
						"parent":frm.doc.name
					},
					fields:["*"],
					// fields:['fabric_name','process_name','cost_price'],
					order_by:'creation'
				}).then(res=>{
					for(let key in res){
						let cols = Object.keys(res[key]);
						let colobj = {}
						for(let i = 0;i<cols.length;i++){
							colobj[cols[i]] = res[key][cols[i]];
						}
						let row = frm.add_child('process_route_table', colobj);		
					}	
					frm.refresh_field('process_route_table');	
				})
			}
		}
		frm.setupFabricProcessRoute = (frm) => {
			let fabrics = [];
			let readonly = 1;
			// console.log("In process route table");
			if(typeof frm.doc.fabric_table !== 'undefined'){
				frm.clear_table('process_route_table');
				frm.doc.fabric_table.forEach(function(prs){
					// console.log(prs.fabric_type);
					if(prs.fabric_type == 'Process'){
						readonly = 0;
						fabrics.push(prs.fabric_name);
					}
				});
				// console.log(frm.doc.fabric_table);
				// console.log(fabrics);
				frm.showProcessRoute(frm);
				frm.set_df_property('fabric_for_process', 'options', [""].concat(fabrics));
				frm.set_df_property('fabric_for_process', 'read_only', readonly);
			}
			// console.log("Exit process route");
			frm.toggle_display('fabric_process_route_details', readonly == 0);
			frm.refresh_field('process_route_table');
		}
		frm.getCostingTable = (frm)=>{
			let total_cost = calculateTotalcost(frm);
		
			let currency_val = frm.doc.currency;
			// frm.clear_table('style_costing');
			let table_heading = [
				'Cost Head',
				'% of Cost',
				'Rs.',
				// 'Rs. (buyer)'
			];
		
			if(currency_val !== 'INR'){
				table_heading.push(currency_val);
				// table_heading.push(currency_val + ' (buyer)');
			}
		
			let data = {
				'heading':table_heading,
				'col_data':total_cost,
				'bold_heads':['Total Cost(A)','Sales Price Target(B)']
			}
		
			// if (!cur_frm.doc.__islocal) {
			$(cur_frm.fields_dict['costing_table'].wrapper).html(frappe.render_template("costing_table", {'data':data}));
			// }
			cur_frm.refresh_field('costing_table');
			var total_cost_percent = 0;
			var total_final_cost = parseFloat($($($('#fixed-table tbody').find('tr')[6]).find('td')[2]).find('div').text().replace(',',''));
			frm.doc.cost_price_our = !isNaN(total_final_cost) ? total_final_cost : 0;
			frm.refresh_field('cost_price_our');
			$('#fixed-table tbody').find('tr').each(function(index, val){
				if(index < 6){
					let calculate_cost_percent = 0;
					let elem_cost = parseFloat($($(val).find('td')[2]).find('div').text());
					calculate_cost_percent = ((elem_cost/total_final_cost)*100);
					if(!isNaN(calculate_cost_percent))
						calculate_cost_percent = frm.roundDecimal(calculate_cost_percent,2)
					else
						calculate_cost_percent = 0;
					
					total_cost_percent += calculate_cost_percent;
					$($(val).find('td')[1]).text(calculate_cost_percent);
				}
				if(index == 6){
					$($(val).find('td')[1]).text(Math.round(total_cost_percent));
				}
			});

			update_markup_table(frm); // update markup table as well
			cur_frm.refresh_field('costing_table');
		}
		
		// display none when is_set checkbox have uncheck
		frm.toggle_display('style_component_details', frm.doc.is_set > 0);
		frm.toggle_display('panel_details', frm.doc.is_panel > 0);
		frm.toggle_display('pcs_per_pack', frm.doc.is_pack > 0);
	
		style_master_costing.on_child("Fabric",{
			form_render:function(frm, cdt, cdn){
				let row = locals[cdt][cdn];
				frm.trigger('loadComponentSelectOptions');	
				frm.trigger('loadPanelSelectOptions');		
			},
			fabric_table_add:function(frm, cdt, cdn){
				let row = locals[cdt][cdn];
				row.garment_qty = frm.doc.garment_qty;
				frm.trigger('loadComponentSelectOptions');
				frm.trigger('loadPanelSelectOptions');
				cur_frm.refresh_field('fabric_table');
			},
			fabric_name:function(frm, cdt, cdn){
			  var row = locals[cdt][cdn];
			  frappe.db.get_doc('Item', row.fabric_name).then(doc=>{
				frappe.model.set_value(cdt, cdn, 'category', doc.item_sub_group);
				frappe.model.set_value(cdt, cdn, 'hs_code', doc.gst_hsn_code);
				frappe.model.set_value(cdt, cdn, 'description', doc.composition);
				frappe.model.set_value(cdt, cdn, 'unit', doc.stock_uom);
			  });			  

				cur_frm.refresh_field('fabric_table');				
			},
			fabric_type:function(frm, cdt, cdn){
				var row = locals[cdt][cdn];
				let readOnly_val = 0;
				if(row.fabric_type !== 'Import'){
					readOnly_val = 1;
				}
				frm.setupFabricProcessRoute(frm);
				cur_frm.fields_dict.fabric_table.grid.update_docfield_property('import_duty','read_only',readOnly_val);
				cur_frm.fields_dict.fabric_table.grid.update_docfield_property('handling_charges','read_only',readOnly_val);

				

				cur_frm.refresh_field('fabric_table');
			},
			garment_qty:function(frm, cdt, cdn){
				calulateFabricTotalRowQty(frm, cdt, cdn)
			},
			consumption:function(frm, cdt, cdn){
				calulateFabricTotalRowQty(frm, cdt, cdn)
			},
			purchase_extra:function(frm, cdt, cdn){
				calulateFabricTotalRowQty(frm, cdt, cdn)
			},
			production_extra:function(frm, cdt, cdn){
				calulateFabricTotalRowQty(frm, cdt, cdn)
			},
			garment_wastage:function(frm, cdt, cdn){
				calulateFabricTotalRowQty(frm, cdt, cdn)
			},
			sample_qty:function(frm, cdt, cdn){
				calulateFabricTotalRowQty(frm, cdt, cdn)
			},
			rate_our:function(frm, cdt, cdn){
				var row = locals[cdt][cdn];
				if(row.consumption == '' || row.consumption <= 0){
					frappe.throw("Please enter the consumption.");
				}
				if(row.total_req_qty == '' || row.total_req_qty <= 0){
					frappe.throw("Total Req. Qty. must be greater than 0.");
				}
				calculateFabricTotalRow(frm, cdt, cdn);
				
				frm.getCostingTable(frm);
				frm.refresh_field('fabric_table');
			},
			rate_buyer:function(frm, cdt, cdn){
					var row = locals[cdt][cdn];
					if(row.consumption_buyer == '' || row.consumption_buyer <= 0){
						frappe.throw("Please enter the consumption buyer.");
					}
					if(row.total_reqd_qty_buyer == '' || row.total_reqd_qty_buyer <= 0){
						frappe.throw("Total Req. Qty. (Buyer) must be greater than 0.");
					}
					calculateFabricTotalRow(frm, cdt, cdn);
					
					frm.getCostingTable(frm);
					frm.refresh_field('fabric_table');
					// frappe.model.set_value(cdt, cdn, 'amount_our', (row.rate_our * row.consumption));
					// frappe.model.set_value(cdt, cdn, 'amount_buyer', (row.rate_buyer * row.consumption_buyer));
					// frm.getCostingTable(frm);
				  	// frm.refresh_field('fabric_table');
			},
			insurance_amt:function(frm, cdt, cdn){
				calculateFabricTotalRow(frm, cdt, cdn);	
				frm.getCostingTable(frm);			
			},
			freight_based_on:function(frm, cdt, cdn){
				calculateFabricTotalRow(frm, cdt, cdn);	
				frm.getCostingTable(frm);			
			},
			freight_with_gst:function(frm, cdt, cdn){
				calculateFabricTotalRow(frm, cdt, cdn);		
				frm.getCostingTable(frm);		
			},
			import_duty:function(frm, cdt, cdn){
				calculateFabricTotalRow(frm, cdt, cdn);	
				frm.getCostingTable(frm);			
			},
			handling_charges:function(frm, cdt, cdn){
				calculateFabricTotalRow(frm, cdt, cdn);		
				frm.getCostingTable(frm);		
			},
			gst_percent:function(frm, cdt, cdn){
				calculateFabricTotalRow(frm, cdt, cdn);	
				frm.getCostingTable(frm);			
			},
		  });

		  

		  style_master_costing.on_child('Marker Table',{
			view_data:function(frm, cdt, cdn){
				let row = locals[cdt][cdn];
				if(frm.doc.marker_table.length > 1 && row.view_data > 0){
					frm.doc.marker_table.forEach(function(datarow){
						if(datarow.view_data == 1 && datarow.idx !== row.idx){
							datarow.view_data = 0;
							frm.refresh_field('marker_table');
						}
					});
				}
				loadMarkerView(frm, row);
			},
		  });
		  style_master_costing.on_child('Techpack Table',{
			form_render:function(frm, cdt, cdn){
				let row = locals[cdt][cdn];
				// frm.trigger('loadTechpack');	
				// loadTechpack(frm, row);
			},
			techpack_table_add:function(frm, cdt, cdn){
				let row = locals[cdt][cdn];
				hideTechpackEdit(frm);
				// frm.trigger('loadTechpack');	
				// loadTechpack(frm, row);
			},
			techpack_file:function(frm, cdt, cdn){
				let row = locals[cdt][cdn];
				// frm.trigger('loadTechpack');	
				// loadTechpack(frm, row);		  
			    // cur_frm.refresh_field('techpack_table');
			},
			view_data:function(frm, cdt, cdn){
				let row = locals[cdt][cdn];
				// frm.trigger('loadTechpack');	
				if(frm.doc.techpack_table.length > 1 && row.view_data > 0){
					frm.doc.techpack_table.forEach(function(datarow){
						if(datarow.view_data == 1 && datarow.idx !== row.idx){
							datarow.view_data = 0;
							frm.refresh_field('techpack_table');
						}
						// console.log(datarow);
					});
				}
				// if(row.view_data > 0)
				loadTechpack(frm, row);
			},
		  });
		  style_master_costing.on_child("Trims",{
			form_render:function(frm, cdt, cdn){
				let row = locals[cdt][cdn];
				frm.trigger('loadComponentSelectOptions');	
				frm.trigger('loadPanelSelectOptions');		
			},
			trims_table_add:function(frm){
				frm.trigger('loadComponentSelectOptions');
				frm.trigger('loadPanelSelectOptions');
			},
			trim_name:function(frm, cdt, cdn){
			  var row = locals[cdt][cdn];
			  frappe.db.get_doc('Item', row.trim_name).then(doc=>{
				frappe.model.set_value(cdt, cdn, 'category', doc.item_sub_group);
				frappe.model.set_value(cdt, cdn, 'hs_code', doc.gst_hsn_code);
				frappe.model.set_value(cdt, cdn, 'description', doc.composition);
				frappe.model.set_value(cdt, cdn, 'unit', doc.stock_uom);
			  });			  
			  cur_frm.refresh_field('trims_table');
			},
			trims_type:function(frm, cdt, cdn){
				var row = locals[cdt][cdn];
				let readOnly_val = 0;
				if(row.trims_type !== 'Import'){
					readOnly_val = 1;
				}
				cur_frm.fields_dict.trims_table.grid.update_docfield_property('import_duty','read_only',readOnly_val);
				cur_frm.fields_dict.trims_table.grid.update_docfield_property('handling_charges','read_only',readOnly_val);
				setupTrimProcessRoute(frm);
			},
			trims_qty:function(frm, cdt, cdn){
				calulateTrimsTotalRowQty(frm, cdt, cdn)
			},
			consumption:function(frm, cdt, cdn){
				calulateTrimsTotalRowQty(frm, cdt, cdn)
			},
			purchase_extra:function(frm, cdt, cdn){
				calulateTrimsTotalRowQty(frm, cdt, cdn)
			},
			production_extra:function(frm, cdt, cdn){
				calulateTrimsTotalRowQty(frm, cdt, cdn)
			},
			trims_wastage:function(frm, cdt, cdn){
				calulateTrimsTotalRowQty(frm, cdt, cdn)
			},
			sample_qty:function(frm, cdt, cdn){
				calulateTrimsTotalRowQty(frm, cdt, cdn)
			},					
			rate_our:function(frm, cdt, cdn){
				var row = locals[cdt][cdn];
				if(row.consumption == '' || row.consumption <= 0){
					frappe.throw("Please enter the consumption.");
				}
				if(row.total_req_qty == '' || row.total_req_qty <= 0){
					frappe.throw("Total Req. Qty. must be greater than 0.");
				}
				calculateTrimsTotalRow(frm, cdt, cdn);
				
				frm.getCostingTable(frm);
				frm.refresh_field('trims_table');
			},
			rate_buyer:function(frm, cdt, cdn){
					var row = locals[cdt][cdn];
					if(row.consumption_buyer == '' || row.consumption_buyer <= 0){
						frappe.throw("Please enter the consumption buyer.");
					}
					if(row.total_req_qty == '' || row.total_req_qty <= 0){
						frappe.throw("Total Req. Qty. must be greater than 0.");
					}
					calculateTrimsTotalRow(frm, cdt, cdn);
					// frappe.model.set_value(cdt, cdn, 'amount_buyer', (row.per_garment * (row.rate_buyer * row.consumption_buyer)));
					frm.getCostingTable(frm);
				  	frm.refresh_field('trims_table');
			},
			insurance_amt:function(frm, cdt, cdn){
				calculateTrimsTotalRow(frm, cdt, cdn);	
				frm.getCostingTable(frm);			
			},
			freight_based_on:function(frm, cdt, cdn){
				calculateTrimsTotalRow(frm, cdt, cdn);	
				frm.getCostingTable(frm);			
			},
			freight_with_gst:function(frm, cdt, cdn){
				calculateTrimsTotalRow(frm, cdt, cdn);				
				frm.getCostingTable(frm);
			},
			import_duty:function(frm, cdt, cdn){
				calculateTrimsTotalRow(frm, cdt, cdn);	
				frm.getCostingTable(frm);			
			},
			handling_charges:function(frm, cdt, cdn){
				calculateTrimsTotalRow(frm, cdt, cdn);	
				frm.getCostingTable(frm);			
			},
			gst_percent:function(frm, cdt, cdn){
				calculateTrimsTotalRow(frm, cdt, cdn);	
				frm.getCostingTable(frm);			
			},
		  });


		  style_master_costing.on_child("SMV Table",{
			process_name: function(frm, cdt, cdn){
				// frm.doc.manufacturing_cost.forEach(function(cst){
				// 	cost.mf_cost_our += cst.amount_our;
				// 	cost.mf_cost_buyer += cst.amount_buyer;
				// });
				// set_final_mf_rate(frm,cdt, cdn);
			},
			smv_cost: function(frm, cdt, cdn){
				// set_final_mf_rate(frm,cdt, cdn);
			}
		  });

		  style_master_costing.on_child('Value Addition Style', {
			form_render:function(frm, cdt, cdn){
				let row = locals[cdt][cdn];
				frm.trigger('loadComponentSelectOptions');	
				frm.trigger('loadPanelSelectOptions');		
			},
			value_addition_add:function(frm, cdt, cdn){
				let row = locals[cdt][cdn];
				row.garment_qty = frm.doc.garment_qty;
				frm.trigger('loadComponentSelectOptions');
				frm.trigger('loadPanelSelectOptions');
				cur_frm.refresh_field('value_addition');
			},
		  });
		style_master_costing.on_child('Manufacturing Cost', {
				form_render:function(frm, cdt, cdn){
					let row = locals[cdt][cdn];
					frm.trigger('loadComponentSelectOptions');					
				},
				manufacturing_cost_add:function(frm){
					frm.trigger('loadComponentSelectOptions');
				},
				based_on:function(frm, cdt, cdn){
					// var row = locals[cdt][cdn];
					// var df = frappe.meta.get_docfield("Manufacturing Cost","rate_our", cur_frm.doc.name);
					// df.read_only = 0;
					// if(row.based_on == 'SMV'){
					// 	df.read_only = 1;
					// }
					set_final_mf_rate(frm,cdt, cdn);
					frm.getCostingTable(frm);
					frm.refresh_field('manufacturing_cost');
					// frm.refresh_field('manufacturing_cost');
				},
				rate_our:function(frm, cdt, cdn){
					set_final_mf_rate(frm,cdt, cdn);
					frm.getCostingTable(frm);
					// update_stylecosting_table(frm);
					frm.refresh_field('manufacturing_cost');
				},
				rate_buyer:function(frm, cdt, cdn){
					set_final_mf_rate(frm,cdt, cdn);
					frm.getCostingTable(frm);
					// update_stylecosting_table(frm);
					frm.refresh_field('manufacturing_cost');
				},
				percent_extra:function(frm, cdt, cdn){
					set_final_mf_rate(frm,cdt, cdn);
					frm.getCostingTable(frm);
					// update_stylecosting_table(frm);
					frm.refresh_field('manufacturing_cost');
				},
				process_area:function(frm, cdt, cdn){
					let readonly = 1;
					let hidden = 1;
					let row = locals[cdt][cdn];
					if(row.process_area == 'External'){
						readonly = 0;
						hidden = 0;
					}
					cur_frm.fields_dict.manufacturing_cost.grid.update_docfield_property('supplier','read_only',readonly);
					cur_frm.fields_dict.manufacturing_cost.grid.update_docfield_property('gst_percent','read_only',readonly);
					cur_frm.fields_dict.manufacturing_cost.grid.update_docfield_property('gst_amt_our','read_only',readonly);
					cur_frm.fields_dict.manufacturing_cost.grid.update_docfield_property('gst_amt_buyer','read_only',readonly);
					
					cur_frm.fields_dict.manufacturing_cost.grid.update_docfield_property('supplier','hidden',hidden);
					cur_frm.fields_dict.manufacturing_cost.grid.update_docfield_property('gst_percent','hidden',hidden);
					cur_frm.fields_dict.manufacturing_cost.grid.update_docfield_property('gst_amt_our','hidden',hidden);
					cur_frm.fields_dict.manufacturing_cost.grid.update_docfield_property('gst_amt_buyer','hidden',hidden);
					frm.refresh_field('manufacturing_cost');
				},
				gst_percent:function(frm, cdt, cdn){
					set_final_mf_rate(frm,cdt, cdn)
				}
				
			// }
		});
		style_master_costing.on_child('Other Cost', {
			form_render:function(frm, cdt, cdn){
				let row = locals[cdt][cdn];
				frm.trigger('loadComponentSelectOptions');				
			},
			other_cost_add:function(frm){
				frm.trigger('loadComponentSelectOptions');
			},
			percent_our:function(frm, cdt, cdn){
				update_rate_our_oc(frm,cdt, cdn);
				frm.getCostingTable(frm);
			},
			percent_buyer:function(frm, cdt, cdn){
				update_rate_buyer_oc(frm,cdt, cdn);
				frm.getCostingTable(frm);
			},
			rate_our: function(frm, cdt, cdn) {
				frm.getCostingTable(frm);
				// update_stylecosting_table(frm);
				frm.refresh_field('other_cost');
			},
			rate_buyer: function(frm, cdt, cdn) {
				frm.getCostingTable(frm);
				// update_stylecosting_table(frm);
				frm.refresh_field('other_cost');
			}
		});
		style_master_costing.on_child('Incentive Cost', {
			percent:function(frm, cdt, cdn){
				let row = locals[cdt][cdn];
				row.amount = frm.doc.sales_price_target*row.percent/100;
				frm.getCostingTable(frm);
				frm.refresh_field('incentive_cost');
			  },
			amount: function(frm, cdt, cdn) {
				frm.getCostingTable(frm);
				// update_stylecosting_table(frm);
				frm.refresh_field('incentive_cost');
			}
		});

		style_master_costing.on_child('Size Data', {
			consumption:function(frm, cdt,cdn){
				calculateAverageSize(frm, cdt,cdn);
			}
		});

		style_master_costing.on_child('Fabric Process Route',{
			process_route_table_add: function(frm, cdt, cdn){
				let row = locals[cdt][cdn];
				row.fabric_name = frm.doc.fabric_for_process;

				frm.doc.fabric_table.forEach(function(fb){
					if(fb.fabric_name == row.fabric_name && fb.fabric_type == 'Process'){
						row.finished_cons = fb.consumption;
						row.finished_rate = fb.rate_our;
						row.finish_reqd_qty = fb.total_req_qty;
					}
				});
				frm.refresh_field('process_route_table')
			},
			loss_percent:function(frm, cdt, cdn){
				let row = locals[cdt][cdn];
				let loss_percent = row.loss_percent;
				let reqd_input_qty = 0;
				let finish_reqd_qty = row.finish_reqd_qty;

				if(finish_reqd_qty > 0){
					reqd_input_qty = (finish_reqd_qty/((100 - row.loss_percent)/100));
					row.reqd_input_qty = reqd_input_qty;
				}
				frm.refresh_field('process_route_table');
			},
			process_rate:function(frm, cdt, cdn){
				let row = locals[cdt][cdn];
				let total_input_rate = 0;
				let process_rate = row.process_rate;
				let reqd_input_qty = row.reqd_input_qty;
				let finish_reqd_qty = row.finish_reqd_qty;
				let calculated_rate = 0;
				if(process_rate > 0){
					calculated_rate = (reqd_input_qty * process_rate);
					total_input_rate = (calculated_rate / finish_reqd_qty)
				}
				row.total_input_rate = total_input_rate;
				frm.refresh_field('process_route_table');
			},
			item_rate:function(frm, cdt, cdn){
				let row = locals[cdt][cdn];
				let total_input_rate = 0;
				let item_rate = row.item_rate;
				let reqd_input_qty = row.reqd_input_qty;
				let finish_reqd_qty = row.finish_reqd_qty;
				let calculated_rate = 0;
				if(item_rate > 0){
					calculated_rate = (reqd_input_qty * item_rate);
					total_input_rate = (calculated_rate / finish_reqd_qty)
				}
				row.total_input_rate = total_input_rate;
				frm.refresh_field('process_route_table');
			}
		});

		

		style_master_costing.on_child('Trims Process Route',{
			trims_process_route_table_add: function(frm, cdt, cdn){
				let row = locals[cdt][cdn];
				row.trim_name = frm.doc.trims_for_process;

				frm.doc.trims_table.forEach(function(fb){
					if(fb.trim_name == row.trim_name && fb.trims_type == 'Process'){
						row.finished_cons = fb.consumption;
						row.finished_rate = fb.rate_our;
						row.finish_reqd_qty = fb.total_req_qty;
					}
				});
				frm.refresh_field('trims_process_route_table')
			},
			loss_percent:function(frm, cdt, cdn){
				let row = locals[cdt][cdn];
				let loss_percent = row.loss_percent;
				let reqd_input_qty = 0;
				let finish_reqd_qty = row.finish_reqd_qty;

				if(finish_reqd_qty > 0){
					reqd_input_qty = (finish_reqd_qty/((100 - row.loss_percent)/100));
					row.reqd_input_qty = reqd_input_qty;
				}
				frm.refresh_field('trims_process_route_table');
			},
			process_rate:function(frm, cdt, cdn){
				let row = locals[cdt][cdn];
				let total_input_rate = 0;
				let process_rate = row.process_rate;
				let reqd_input_qty = row.reqd_input_qty;
				let finish_reqd_qty = row.finish_reqd_qty;
				let calculated_rate = 0;
				if(process_rate > 0){
					calculated_rate = (reqd_input_qty * process_rate);
					total_input_rate = (calculated_rate / finish_reqd_qty)
				}
				row.total_input_rate = total_input_rate;
				frm.refresh_field('trims_process_route_table');
			},
			item_rate:function(frm, cdt, cdn){
				let row = locals[cdt][cdn];
				let total_input_rate = 0;
				let item_rate = row.item_rate;
				let reqd_input_qty = row.reqd_input_qty;
				let finish_reqd_qty = row.finish_reqd_qty;
				let calculated_rate = 0;
				if(item_rate > 0){
					calculated_rate = (reqd_input_qty * item_rate);
					total_input_rate = (calculated_rate / finish_reqd_qty)
				}
				row.total_input_rate = total_input_rate;
				frm.refresh_field('trims_process_route_table');
			}
		});
		
	},
	// techpack:function(frm){
	// 	loadTechpack(frm);	
	// },
	time_and_action:function(frm){
		if(frm.doc.time_and_action && frm.is_new()){
			frappe.call({
				method:"style_master_costing.style_master_costing.doctype.time_and_action.time_and_action.getTableData",
				args: {
					"time_and_action":frm.doc.time_and_action
				},
				callback:function(r){
					if(r.message)
						set_timeaction_data(frm, r.message);
				}
			});
		}
	},
	// production_process:function(frm){
	// 	frappe.db.get_doc('Production Process', frm.doc.production_process).then(doc=>{
	// 		frm.set_value('process_description',doc.process_description);
	// 	});
	// },
	// style_costing:function(frm){
	// 	// console.log("In Style Costing.");
	// },
	is_set:function(frm){
		frm.toggle_display('style_component_details', frm.doc.is_set > 0);
	},
	is_panel:function(frm){
		frm.toggle_display('panel_details', frm.doc.is_panel > 0);
	},
	is_pack:function(frm){
		frm.toggle_display('pcs_per_pack', frm.doc.is_pack > 0);
	},
	setup(frm) {
		frm.fields_dict['merchandiser'].get_query = function(doc) {
			return {
                query:
                    "style_master_costing.queries.get_merchandisers",
            }; 
			},
		frm.fields_dict['brand_name'].get_query = function(doc) {
			return {
				filters: {
				"is_customer_brand": true
				}
			}
			}
	},
	sales_price_our:function(frm){
		frm.getCostingTable(frm);
	},
	sales_price_buyer:function(frm){
		frm.getCostingTable(frm);
	},
	sales_price_target:function(frm){
		update_sales_price_target_dependencies(frm);
	},
	markup:function(frm){
		update_markup_table(frm);
	},
	increment_by:function(frm){
		update_markup_table(frm);
	},
	currency:function(frm){
		if(frm.doc.currency !== 'INR'){
			frappe.db.get_doc('Currency Exchange',null,{
				from_currency:'INR',
				to_currency:frm.doc.currency
			}).then(doc => {
				frm.set_value('exchange_rate',doc.exchange_rate)
			});		
		}
		frm.getCostingTable(frm);
	},
	size_series:function(frm){
		if(frm.doc.size_series !== ''){
			cur_frm.get_field('size').grid.grid_buttons.css({'visibility':'hidden'});			
			cur_frm.clear_table('size');
			let sizes = frappe.db.get_doc('Size Series',frm.doc.size_series);
			const sizes_promise = Promise.resolve(sizes);
			sizes_promise.then((sizeseries)=>{
				if(sizeseries.size_table.length > 0){
					sizeseries.size_table.forEach(function(size_val){
						let row = cur_frm.add_child('size', {							
							size:size_val.size							
						});
						cur_frm.refresh_field('size');
					});
					if(typeof cur_frm.doc.size !== 'undefined'){
						let row = cur_frm.add_child('size', {							
							size:'Average',
							consumption:0							
						});
						cur_frm.fields_dict.size.grid.wrapper.find('.grid-body').find('.btn-open-row').css({'visibility':'hidden'});
						
						cur_frm.refresh_field('size');
					}
				}
			});
			
		}
	},
	merchandiser:function(frm){				
		frappe.db.get_doc('Employee', frm.doc.merchandiser).then(doc=>{
			frm.set_value('merchandiser_name',doc.first_name);
		});
		frm.refresh_field('merchandiser_name');
	},
	fabric_for_process:function(frm){
		frm.showProcessRoute(frm);
	},
	syncSmvPrice:function(frm){
		if(typeof frm.is_new() !== 'undefined' && frm.is_new() !== 'undefined'){
			frappe.msgprint("Please save the style master first.");
		}
		else{
			
			frappe.db.get_doc('Operation Bulletin',null, {"style_no":frm.docname}).then(doc=>{
				// console.log(doc);
				if(doc.operation_bulletin_data !== ''){
					// frm.get_field('smv_table').grid.grid_buttons.css({'visibility':'hidden'});
					frm.clear_table('smv_table')
					let operation_bulletin_data_arr = JSON.parse(doc.operation_bulletin_data);
					operation_bulletin_data_arr.forEach(function(val,index){
						if(val.category == 'Total'){						
							let row = frm.add_child('smv_table', {
								process_name:val.parent,
								smv_cost:val.smv,
								no_of_machines:val.no_of_machines
							});
						}
					});

					// frm.fields_dict.smv_table.grid.wrapper.find('.grid-body').find('.btn-open-row').css({'visibility':'hidden'});							
					frm.refresh_field('smv_table');
				}
			}).catch(err=>{
				console.log("OB not found error.");
				console.log(err);
				// console.log(typeof err);
				// frappe.msgprint("Operation Bulletin link not found with this style master.");
			});					
		}		
	},
	loadPanelSelectOptions:function(frm){
		let table_arr = ['fabric_table','trims_table'];

		if(typeof table_arr !== 'undefined'){
			let panel = [];
			if(typeof frm.doc.panel_table !== 'undefined' && frm.doc.panel_table !== 'undefined'){
				frm.doc.panel_table.forEach(function(cmt){
					panel.push(cmt.panel_name);
				});
			}
			// return panel;
			for(let key in table_arr){
				
				let table_name = table_arr[key];
				// console.log(table_name);
				if(typeof cur_frm.fields_dict[table_name] !== 'undefined'){
					cur_frm.fields_dict[table_name].grid.update_docfield_property('panel','read_only',1);
					cur_frm.fields_dict[table_name].grid.update_docfield_property('panel','options',[""]);
					if(frm.doc.is_panel > 0){							
						if(panel.length > 0){
							cur_frm.fields_dict[table_name].grid.update_docfield_property('panel','options',[""].concat(panel));
							cur_frm.fields_dict[table_name].grid.update_docfield_property('panel','read_only',0);
						}
					}
					cur_frm.refresh_field(table_name);
				}
			}
		}
	},
	loadComponentSelectOptions:function(frm){
		// console.log(frm);
		// let table_name = frm.cur_grid.doc.parentfield;
		let table_arr = ['fabric_table','trims_table','manufacturing_cost','other_cost','value_addition'];

		if(typeof table_arr !== 'undefined'){
			let component = [];
			if(typeof frm.doc.style_component !== 'undefined' && frm.doc.style_component !== 'undefined'){
				frm.doc.style_component.forEach(function(cmt){
					component.push(cmt.component_name);
				});
			}
			// return component;
			for(let key in table_arr){
				
				let table_name = table_arr[key];
				// console.log(table_name);
				if(typeof cur_frm.fields_dict[table_name] !== 'undefined'){
					cur_frm.fields_dict[table_name].grid.update_docfield_property('component','read_only',1);
					cur_frm.fields_dict[table_name].grid.update_docfield_property('component','options',[""]);
					if(frm.doc.is_set > 0){							
						if(component.length > 0){
							cur_frm.fields_dict[table_name].grid.update_docfield_property('component','options',[""].concat(component));
							cur_frm.fields_dict[table_name].grid.update_docfield_property('component','read_only',0);
						}
					}
					cur_frm.refresh_field(table_name);
				}
			}
		}
	},
	
};


function loadMarkerView(frm, markerrow){
	let wrapper = frm.get_field("marker_preview").$wrapper;
	let htmlData = '';
	if(typeof frm.doc.marker_table !== 'undefined' && frm.doc.marker_table !== 'undefined'){
		if(frm.doc.marker_table.length > 0){
			if(typeof markerrow == 'undefined' || markerrow == ''){
				markerrow = frm.doc.marker_table[frm.doc.marker_table.length-1];
			}

			if(typeof markerrow !== 'undefined' && typeof markerrow.marker !== 'undefined' && markerrow.view_data > 0){
				let fileurl = markerrow.marker;
				htmlData = '<iframe src="'+fileurl+'" width="800" height="600"></iframe';
			}
		}
	}
	wrapper.html(htmlData);				
	frm.refresh_field('marker_preview');
}

function loadTechpack(frm, techpackrow){
	let wrapper = frm.get_field("techpack_preview").$wrapper;
	let htmlData = '';
	if(typeof frm.doc.techpack_table !== 'undefined' && frm.doc.techpack_table !== 'undefined'){
		if(frm.doc.techpack_table.length > 0){
			if(typeof techpackrow == 'undefined' || techpackrow == ''){
				techpackrow = frm.doc.techpack_table[frm.doc.techpack_table.length-1];
			}

			if(typeof techpackrow !== 'undefined' && typeof techpackrow.techpack_file !== 'undefined' && techpackrow.view_data > 0){			
				let fileurl = techpackrow.techpack_file;
				htmlData = '<iframe src="'+fileurl+'" width="800" height="600"></iframe';
			}
		}
	}
	wrapper.html(htmlData);				
	frm.refresh_field('techpack_preview');
}
function calculateAverageSize(frm, cdt,cdn){
	let avgCons = 0;
	let avgCount = 0;
	let result = 0;
	frm.doc.size.forEach(function(allcons){
		if(allcons.size !== 'Average'){
			avgCons += allcons.consumption
			avgCount += 1;
		}
	});
	if(frm.doc.size[avgCount].size == 'Average'){
		result = avgCons / avgCount;
		frm.doc.size[avgCount].consumption = result;
	}
	cur_frm.refresh_field('size');
} 





function calculateMfcost(frm){
	let mf_cost = 0;
	frm.doc.manufacturing_cost.forEach(function(mc){
		mf_cost += mc.rate_our;
	});
	return mf_cost;
}

function setupTableJson(dataList, frm){
	if(typeof dataList != 'undefined' && dataList.length > 0){
		let costhead_fields = [
			'cost_head',
			'cost_percent',
			'cost_our',
			'cost_buyer',
			'is_bold'
		];

		let currency_val = frm.doc.currency;

		if(currency_val !== 'INR'){
			costhead_fields.push('currency_our');
			costhead_fields.push('currency_buyer');
		}

		let costhead_json = {}
		if(costhead_fields.length == dataList.length){
			for(let i = 0; i<costhead_fields.length;i++){
				if(['cost_head','cost_percent','is_bold'].indexOf(costhead_fields[i]) == -1)
					costhead_json[costhead_fields[i]] = isNaN(dataList[i]) ? 0 : frappe.format(dataList[i],{fieldtype:"Float",precision:2});
				else
					costhead_json[costhead_fields[i]] = dataList[i];
			}
			return costhead_json;
		}
		else{
			frappe.throw(__('Invalid data in calculation.'))			
		}

	}
}

/**
 * For Trims Table
 * function to calculate the total amount on row basis data
 */
 function calculateTrimsTotalRow(frm, cdt, cdn){
	let row = locals[cdt][cdn];

	let total_amt = 0;
	let total_amt_buyer = 0;
	let total_req_qty = 0;
	let total_req_qty_buyer = 0;
	let insurance_amt = 0;
	let rate_our = 0;
	let rate_buyer = 0;
	let amount_our = 0;
	let amount_buyer = 0;

	if(row.total_req_qty > 0){
		total_req_qty = row.total_req_qty;
	}
	if(row.total_req_qty_buyer > 0){
		total_req_qty_buyer = row.total_req_qty_buyer;
	}
	if(row.rate_our > 0){
		rate_our = row.rate_our;
	}
	if(row.rate_buyer > 0){
		rate_buyer = row.rate_buyer;
	}

	amount_our = (row.per_garment * (rate_our * total_req_qty));
	frappe.model.set_value(cdt, cdn, 'amount_our', amount_our);

	amount_buyer = (row.per_garment * (rate_buyer * total_req_qty_buyer));
	frappe.model.set_value(cdt, cdn, 'amount_buyer', amount_buyer);

	if(row.insurance_amt > 0){
		insurance_amt = row.insurance_amt;
		amount_our = amount_our + insurance_amt;
		amount_buyer = amount_buyer + insurance_amt;
	}

	let freight_with_gst_our = row.freight_with_gst > 0 ? row.freight_with_gst : 0;
	let freight_with_gst_buyer = row.freight_with_gst > 0 ? row.freight_with_gst : 0;

	if(row.freight_based_on == 'Percentage'){
		freight_with_gst_our = ((amount_our*row.freight_with_gst)/100);
		freight_with_gst_buyer = ((amount_buyer*row.freight_with_gst)/100);
	}

	let freight_amt_our = freight_with_gst_our;

	amount_our = amount_our + freight_with_gst_our;
	amount_buyer = amount_buyer + freight_with_gst_buyer;
	frappe.model.set_value(cdt, cdn, 'freight_amt', freight_amt_our);

	if(row.trims_type == 'Import' && row.import_duty > 0){
		let import_duty_our = ((amount_our * row.import_duty)/100);
		amount_our = amount_our + import_duty_our;
		let import_duty_buyer = ((amount_buyer * row.import_duty)/100);
		amount_buyer = amount_buyer + import_duty_buyer;
		frappe.model.set_value(cdt, cdn, 'import_duty_amt', import_duty_our);
	}

	if(row.trims_type == 'Import' && row.handling_charges > 0){
		let handling_charges = row.handling_charges;
		amount_our = amount_our + handling_charges;
		amount_buyer = amount_buyer + handling_charges;
	}
	if(row.gst_percent > 0){
		let gst_percent = row.gst_percent;
		let gst_amt_our = ((amount_our*gst_percent)/100);
		let gst_amt_buyer = ((amount_buyer*gst_percent)/100);

		frappe.model.set_value(cdt, cdn, 'gst_amt', gst_amt_our);

		amount_our = amount_our + gst_amt_our;
		amount_buyer = amount_buyer + gst_amt_buyer;
	}

	total_amt = amount_our;
	total_amt_buyer = amount_buyer;

	frappe.model.set_value(cdt, cdn, 'total_amt', total_amt);
	frappe.model.set_value(cdt, cdn, 'total_amt_buyer', total_amt_buyer);

	let per_piece_value_our = (total_amt / row.trims_qty);

	frappe.model.set_value(cdt, cdn, 'per_piece_value', per_piece_value_our);

	let per_piece_value_buyer = (total_amt_buyer / row.trims_qty);

	frappe.model.set_value(cdt, cdn, 'per_piece_value_buyer', per_piece_value_buyer);

	frm.refresh_field('trims_table');

}
/**
 * For Trims table
 * function to calculate total qty on row basis data
 */
function calulateTrimsTotalRowQty(frm, cdt, cdn){
	let row = locals[cdt][cdn];
	let total_req_qty = 0;
	let total_req_qty_buyer = 0;
	let trims_qty = 0;
	let consumption = 0;
	let consumption_buyer = 0;
	let purchase_extra = 0;
	let production_extra = 0;
	let trims_wastage = 0;
	let sample_qty = 0;
	if(row.trims_qty > 0){
		trims_qty = row.trims_qty;
	}
	if(row.consumption > 0){
		consumption = row.consumption;
	}
	consumption_buyer = (row.consumption_buyer > 0) ? row.consumption_buyer : 0;
	if(row.purchase_extra > 0 && trims_qty > 0){
		purchase_extra = ((trims_qty*row.purchase_extra)/100);
	}
	if(row.production_extra > 0 && trims_qty > 0){
		production_extra = ((trims_qty*row.production_extra)/100);
	}
	if(row.trims_wastage > 0 && trims_qty > 0){
		trims_wastage = ((trims_qty*row.trims_wastage)/100);
	}
	if(row.sample_qty > 0){
		sample_qty = row.sample_qty;
	}

	total_req_qty = (((trims_qty + purchase_extra + production_extra + trims_wastage) * consumption) + sample_qty);
	total_req_qty_buyer = (((trims_qty + purchase_extra + production_extra + trims_wastage) * consumption_buyer) + sample_qty);

	frappe.model.set_value(cdt, cdn, 'total_req_qty', total_req_qty);
	frappe.model.set_value(cdt, cdn, 'total_req_qty_buyer', total_req_qty_buyer);

	frm.refresh_field('trims_table');
}

/**
 * function to calculate the total amount on row basis data
 */
function calculateFabricTotalRow(frm, cdt, cdn){
	let row = locals[cdt][cdn];

	let total_amt = 0;
	let total_amt_buyer = 0;
	let total_req_qty = 0;
	let total_reqd_qty_buyer = 0;
	let insurance_amt = 0;
	let rate_our = 0;
	let amount_our = 0;
	let rate_buyer = 0;
	let amount_buyer = 0;

	if(row.total_req_qty > 0){
		total_req_qty = row.total_req_qty;
	}
	if(row.total_reqd_qty_buyer > 0){
		total_reqd_qty_buyer = row.total_reqd_qty_buyer;
	}
	if(row.rate_our > 0){
		rate_our = row.rate_our;
	}
	if(row.rate_buyer > 0){
		rate_buyer = row.rate_buyer;
	}

	amount_our = (rate_our * total_req_qty);
	frappe.model.set_value(cdt, cdn, 'amount_our', amount_our);

	amount_buyer = (rate_buyer * total_reqd_qty_buyer);
	frappe.model.set_value(cdt, cdn, 'amount_buyer', amount_buyer);

	if(row.insurance_amt > 0){
		insurance_amt = row.insurance_amt;
		amount_our = amount_our + insurance_amt;
		amount_buyer = amount_buyer + insurance_amt;
	}

	let freight_with_gst_our = row.freight_with_gst > 0 ? row.freight_with_gst : 0;
	let freight_with_gst_buyer = row.freight_with_gst > 0 ? row.freight_with_gst : 0;

	if(row.freight_based_on == 'Percentage'){
		freight_with_gst_our = ((amount_our*row.freight_with_gst)/100);
		freight_with_gst_buyer = ((amount_buyer*row.freight_with_gst)/100);
	}

	let freight_amt = freight_with_gst_our;

	amount_our = amount_our + freight_with_gst_our;
	amount_buyer = amount_buyer + freight_with_gst_buyer
	frappe.model.set_value(cdt, cdn, 'freight_amt', freight_amt);

	if(row.fabric_type == 'Import' && row.import_duty > 0){
		let import_duty = ((amount_our * row.import_duty)/100);
		let import_duty_buyer = ((amount_buyer * row.import_duty)/100);
		amount_our = amount_our + import_duty;
		amount_buyer = amount_buyer + import_duty_buyer;
		frappe.model.set_value(cdt, cdn, 'import_duty_amt', import_duty);
	}

	if(row.fabric_type == 'Import' && row.handling_charges > 0){
		let handling_charges = row.handling_charges;
		amount_our = amount_our + handling_charges;
		amount_buyer = amount_buyer + handling_charges;
	}
	if(row.gst_percent > 0){
		let gst_percent = row.gst_percent;
		let gst_amt_our = ((amount_our*gst_percent)/100);
		let gst_amt_buyer = ((amount_buyer*gst_percent)/100);

		frappe.model.set_value(cdt, cdn, 'gst_amt', gst_amt_our);

		amount_our = amount_our + gst_amt_our;
		amount_buyer = amount_buyer + gst_amt_buyer;
	}

	total_amt = amount_our;
	total_amt_buyer = amount_buyer;

	frappe.model.set_value(cdt, cdn, 'total_amt', total_amt);
	frappe.model.set_value(cdt, cdn, 'total_amt_buyer', total_amt_buyer);

	let per_piece_value = (total_amt / row.garment_qty);

	frappe.model.set_value(cdt, cdn, 'per_piece_value', per_piece_value);
	let per_piece_value_buyer = (total_amt_buyer / row.garment_qty);

	frappe.model.set_value(cdt, cdn, 'per_piece_value_buyer', per_piece_value_buyer);

	frm.refresh_field('fabric_table');

}
/**
 * function to calculate total qty on row basis data
 */
function calulateFabricTotalRowQty(frm, cdt, cdn){
	let row = locals[cdt][cdn];
	let total_req_qty = 0;
	let total_reqd_qty_buyer = 0;
	let garment_qty = 0;
	let consumption = 0;
	let consumption_buyer = row.consumption_buyer > 0 ? row.consumption_buyer : 0;
	let purchase_extra = 0;
	let production_extra = 0;
	let garment_wastage = 0;
	let sample_qty = 0;
	if(row.garment_qty > 0){
		garment_qty = row.garment_qty;
	}
	if(row.consumption > 0){
		consumption = row.consumption;
	}
	if(row.purchase_extra > 0 && garment_qty > 0){
		purchase_extra = ((garment_qty*row.purchase_extra)/100);
	}
	if(row.production_extra > 0 && garment_qty > 0){
		production_extra = ((garment_qty*row.production_extra)/100);
	}
	if(row.garment_wastage > 0 && garment_qty > 0){
		garment_wastage = ((garment_qty*row.garment_wastage)/100);
	}
	if(row.sample_qty > 0){
		sample_qty = row.sample_qty;
	}

	total_req_qty = (((garment_qty + purchase_extra + production_extra + garment_wastage) * consumption) + sample_qty);
	total_reqd_qty_buyer = (((garment_qty + purchase_extra + production_extra + garment_wastage) * consumption_buyer) + sample_qty);

	frappe.model.set_value(cdt, cdn, 'total_req_qty', total_req_qty);
	frappe.model.set_value(cdt, cdn, 'total_reqd_qty_buyer', total_reqd_qty_buyer);
	
	frm.refresh_field('fabric_table');
}

function calculateTotalcost(frm){
	let cost = {
		'fb_cost_our_local':0,
		'fb_cost_our_import':0,
		'fb_cost_buyer_local':0,
		'fb_cost_buyer_import':0,
		'tr_cost_our_local':0,
		'tr_cost_our_import':0,
		'tr_cost_buyer_local':0,
		'tr_cost_buyer_import':0,
		'mf_cost_our':0,
		'mf_cost_buyer':0,
		'ot_cost_our':0,
		'ot_cost_buyer':0,
		'in_cost_our':0,
		'in_cost_buyer':0,
		'all_total_our':0,
		'all_total_buyer':0,
		'sales_price_buyer':0,
		'sales_price_our':0,
		'incentive_total':0,
	}
	let dataJson = [];

	var currency_val = frm.doc.currency;
	let all_total_our = 0;
	let all_total_buyer = 0;
	cost.sales_price_buyer = frm.doc.sales_price_target;
	cost.sales_price_our = frm.doc.sales_price_target;
	if(typeof frm.doc.fabric_table !== 'undefined' && frm.doc.fabric_table !== 'undefined'){
		frm.doc.fabric_table.forEach(function(cst){
			if(cst.fabric_type == "Import"){
				cost.fb_cost_our_import += cst.per_piece_value;
				cost.fb_cost_buyer_import += cst.per_piece_value_buyer;
			}
			else{
				cost.fb_cost_our_local += cst.per_piece_value;
				cost.fb_cost_buyer_local += cst.per_piece_value_buyer;
			}			
		});
		all_total_our += (cost.fb_cost_our_local + cost.fb_cost_our_import);
		all_total_buyer += (cost.fb_cost_buyer_local + cost.fb_cost_buyer_import);
		let post_local = ['Fabric Cost Local', 0, cost.fb_cost_our_local, cost.fb_cost_buyer_local, false];
		let post_import = ['Fabric Cost Import', 0, cost.fb_cost_our_import, cost.fb_cost_buyer_import, false];

		if(currency_val !== 'INR'){
			post_local.push((cost.fb_cost_our_local/frm.doc.exchange_rate));
			post_local.push((cost.fb_cost_buyer_local/frm.doc.exchange_rate));

			post_import.push((cost.fb_cost_our_import/frm.doc.exchange_rate));
			post_import.push((cost.fb_cost_buyer_import/frm.doc.exchange_rate));
		}

		dataJson.push(setupTableJson(post_local, frm));
		dataJson.push(setupTableJson(post_import, frm));
	}
	// console.log(dataJson);

	if(typeof frm.doc.trims_table !== 'undefined' && frm.doc.trims_table !== 'undefined'){
		frm.doc.trims_table.forEach(function(cst){
			if(cst.trims_type == "Import"){				
				cost.tr_cost_our_import += cst.per_piece_value;
				cost.tr_cost_buyer_import += cst.per_piece_value_buyer;
			}
			else{
				cost.tr_cost_our_local += cst.per_piece_value;
				cost.tr_cost_buyer_local += cst.per_piece_value_buyer;
			}			
		});
		all_total_our += (cost.tr_cost_our_local + cost.tr_cost_our_import);
		all_total_buyer += (cost.tr_cost_buyer_local + cost.tr_cost_buyer_import);

		let post_local = ['Trims Cost Local', 0, cost.tr_cost_our_local, cost.tr_cost_buyer_local, false];
		let post_import = ['Trims Cost Import', 0, cost.tr_cost_our_import, cost.tr_cost_buyer_import, false];

		if(currency_val !== 'INR'){
			post_local.push((cost.tr_cost_our_local/frm.doc.exchange_rate));
			post_local.push((cost.tr_cost_buyer_local/frm.doc.exchange_rate));

			post_import.push((cost.tr_cost_our_import/frm.doc.exchange_rate));
			post_import.push((cost.tr_cost_buyer_import/frm.doc.exchange_rate));
		}

		dataJson.push(setupTableJson(post_local, frm));
		dataJson.push(setupTableJson(post_import, frm));
	}

	if(typeof frm.doc.manufacturing_cost !== 'undefined' && frm.doc.manufacturing_cost !== 'undefined'){
		frm.doc.manufacturing_cost.forEach(function(cst){
			cost.mf_cost_our += cst.amount_our;
			cost.mf_cost_buyer += cst.amount_buyer;
		});
		all_total_our += cost.mf_cost_our;
		all_total_buyer += cost.mf_cost_buyer;

		let post_data = ['Manufacturing Cost', 0, cost.mf_cost_our, cost.mf_cost_buyer, false];
		
		if(currency_val !== 'INR'){
			post_data.push((cost.mf_cost_our/frm.doc.exchange_rate));
			post_data.push((cost.mf_cost_buyer/frm.doc.exchange_rate));
		}

		dataJson.push(setupTableJson(post_data, frm));
	}
	
	if(typeof frm.doc.other_cost !== 'undefined' && frm.doc.other_cost !== 'undefined'){
		frm.doc.other_cost.forEach(function(cst){
			cost.ot_cost_our += cst.rate_our;
			cost.ot_cost_buyer += cst.rate_buyer;
		});
		all_total_our += cost.ot_cost_our;
		all_total_buyer += cost.ot_cost_buyer;

		let post_data = ['Other Cost', 0, cost.ot_cost_our, cost.ot_cost_buyer, false];
		
		if(currency_val !== 'INR'){
			post_data.push((cost.ot_cost_our/frm.doc.exchange_rate));
			post_data.push((cost.ot_cost_buyer/frm.doc.exchange_rate));
		}

		dataJson.push(setupTableJson(post_data, frm));
	}

	if(dataJson.length > 0){
		cost.all_total_our = all_total_our;
		cost.all_total_buyer = all_total_buyer;
		// Total Cost
		let post_data = ['Total Cost(A)', 0, cost.all_total_our, cost.all_total_buyer, true];

		if(currency_val !== 'INR'){
			post_data.push((cost.all_total_our/frm.doc.exchange_rate));
			post_data.push((cost.all_total_buyer/frm.doc.exchange_rate));
		}

		dataJson.push(setupTableJson(post_data, frm));

		// Sales Proce Target
		let post_sales = ['Sales Price Target(B)', '-', cost.sales_price_our, cost.sales_price_buyer, true];

		if(currency_val !== 'INR'){
			post_sales.push((cost.sales_price_our/frm.doc.exchange_rate));
			post_sales.push((cost.sales_price_buyer/frm.doc.exchange_rate));
		}

		dataJson.push(setupTableJson(post_sales, frm));

		// Difference ( b-a)
		let diff_our = (cost.sales_price_our-cost.all_total_our);
		let diff_buyer = (cost.sales_price_buyer-cost.all_total_buyer);
		let post_diff = ['Difference(B-A)', '-', diff_our, diff_buyer, false];

		if(currency_val !== 'INR'){
			post_diff.push((diff_our/frm.doc.exchange_rate));
			post_diff.push((diff_buyer/frm.doc.exchange_rate));
		}
		dataJson.push(setupTableJson(post_diff, frm));
		
		// Incentive
		if(typeof frm.doc.incentive_cost !== 'undefined' && frm.doc.incentive_cost !== 'undefined'){
			frm.doc.incentive_cost.forEach(function(cst){
				cost.incentive_total += cst.amount;
			});
			
		}

		let post_incent = ['Incentive(C)', '-', cost.incentive_total, cost.incentive_total, false];

		if(currency_val !== 'INR'){
			post_incent.push((cost.incentive_total/frm.doc.exchange_rate));
			post_incent.push((cost.incentive_total/frm.doc.exchange_rate));
		}
		dataJson.push(setupTableJson(post_incent, frm));
		
		// Difference with Incentive
		let incent_our = ((cost.sales_price_our-cost.all_total_our) + cost.incentive_total); // (cost.incentive_total-cost.all_total_our);
		let incent_buyer = (cost.incentive_total-cost.all_total_buyer);
		let post_incent_diff = ['Difference with Incentive((B-A)+C)', '-', incent_our, incent_buyer, false];

		if(currency_val !== 'INR'){
			post_incent_diff.push((incent_our/frm.doc.exchange_rate));
			post_incent_diff.push((incent_buyer/frm.doc.exchange_rate));
		}
		dataJson.push(setupTableJson(post_incent_diff, frm));
	}

	return dataJson;
	// return cost;
}

function set_timeaction_data(frm, actiondata){
    if(actiondata.time_and_action){
	  frm.get_field('activity_table').grid.grid_buttons.css({'visibility':'hidden'});
      frm.clear_table('activity_table')
      actiondata.time_and_action.forEach(function(eh){
        let row = frm.add_child('activity_table', {
			activity:eh.activity,
			required_days:eh.required_days,
          	department:eh.department
        })
      });

	  
	  frm.fields_dict.activity_table.grid.wrapper.find('.grid-body').find('.btn-open-row').css({'visibility':'hidden'});
	//   console.log(frm.fields_dict.activity_table.grid.wrapper.find('.grid-body').find('.btn-open-row'));
      frm.refresh_field('activity_table');
    }
  }

  
function  update_sales_price_target_dependencies(frm){
	// Update incentives
	frm.get_field("incentive_cost").grid.grid_rows.forEach(function(inc){
		inc.doc.amount = frm.doc.sales_price_target*inc.doc.percent/100;
		inc.refresh_field("amount");
	})

	
	//Update Commission 
	frm.get_field("other_cost").grid.grid_rows.forEach(function(oc){
		if(oc.doc.cost_head=="COMMISSION"){
			oc.doc.rate_our = frm.doc.sales_price_target*oc.doc.percent_our/100;
			oc.doc.rate_buyer = frm.doc.sales_price_target*oc.doc.percent_buyer/100;
			oc.refresh_field("rate_our");
			oc.refresh_field("rate_buyer");
		}	
	})

}
// frappe.ui.form.on('Manufacturing Cost', {
	
// });

function set_final_mf_rate(frm,cdt, cdn){
	let row = locals[cdt][cdn];
	let ro = 0;
	let rb = 0;
	// console.log(row);
	ro = row.rate_our;
	rb = row.rate_buyer;
	let is_smv = 0; // no smv selected in based on
	if(row.based_on=="SMV"){
		is_smv = 1; // smv selected in based on
		frm.get_field("smv_table").grid.grid_rows.forEach(function(st){
			// console.log(st.doc.process_name);
			// console.log(row.order_type);
			if(st.doc.process_name == row.order_type){
				is_smv = 2; // smv process compare and found
				ro = row.rate_our*st.doc.smv_cost;
				rb = row.rate_buyer*st.doc.smv_cost;
			}
		});

		if(is_smv == 1){
			frappe.throw("SMV price not set for "+row.order_type+". Please check and try again later.");
		}
		// ro = row.rate_our*frm.doc.style_smv_costing;
		// rb = row.rate_buyer*frm.doc.style_smv_costing;
	}
	let gst_amt_our = 0;
	let gst_amt_buyer = 0;
	if(row.process_area == 'External' && row.gst_percent > 0){
		gst_amt_our = (ro*row.gst_percent)/100;
		gst_amt_buyer = (rb*row.gst_percent)/100;
	}
	
	let final_rate_our = ro + ro*row.percent_extra/100;
	row.amount_our = (final_rate_our + gst_amt_our);
	let final_rate_buyer = rb + rb*row.percent_extra/100;
	row.amount_buyer = (final_rate_buyer + gst_amt_buyer);
	frm.refresh_field('manufacturing_cost');
}

function update_rate_our_oc(frm, cdt, cdn){
	let row = locals[cdt][cdn];
	if(row.cost_head=="COMMISSION"){
		row.rate_our = frm.doc.sales_price_target*row.percent_our/100;		
	}
	frm.refresh_field('other_cost');
}
function update_rate_buyer_oc(frm, cdt, cdn){
	let row = locals[cdt][cdn];
	if(row.cost_head=="COMMISSION"){
		row.rate_buyer = frm.doc.sales_price_target*row.percent_buyer/100;		
	}
	frm.refresh_field('other_cost');
}

function update_markup_table(frm){
	let markup = frm.doc.markup;
	let increment_by = frm.doc.increment_by;
	let buyer_price = 0;
	let cost_data = calculateTotalcost(frm);
	// console.log(cost_data);
	if(typeof cost_data !== 'undefined' && cost_data.length > 0){
		for(let datakey in cost_data){
			if(cost_data[datakey]['cost_head'] == 'Total Cost(A)'){
				buyer_price = cost_data[datakey]['cost_our']; // cost_buyer
				buyer_price = parseFloat($(buyer_price).text().replace(',',''));
			}
		}
	
	
	// console.log("buyer_price",parseFloat($(buyer_price).text().replace(',','')));
		frm.clear_table('markup_differences');
		let i =0;
		while(i<5){
			let percent_markup = buyer_price*markup/100;
			frm.add_child('markup_differences', {
				percent_markup:markup,
				rate_in_rupees:buyer_price+percent_markup,
				diff_in_rs: percent_markup
			});
			markup+=increment_by;
			i+=1;
		}
	}
	frm.refresh_field('markup_differences');
}





function setupTrimProcessRoute(frm){
	let trims = [];
	let readonly = 1;
	if(typeof frm.doc.trims_table !== 'undefined'){
		frm.clear_table('trims_process_route_table');
		frm.doc.trims_table.forEach(function(prs){
			if(prs.trims_type == 'Process'){
				readonly = 0;
				trims.push(prs.trim_name);
			}
		});
		frm.showTrimsProcessRoute(frm);
		frm.set_df_property('trims_for_process', 'options', [""].concat(trims));
		frm.set_df_property('trims_for_process', 'read_only', readonly);
	}
	frm.toggle_display('trims_process_route_details', readonly == 0);
	frm.refresh_field('trims_process_route_table');
}

function saveTrimProcessRoute(frm){
	if(typeof cur_frm.is_new() !== 'undefined'){
		frappe.throw("Please save the style master first.");
	}
	else if(typeof cur_frm.doc.trims_for_process ==  'undefined' || cur_frm.doc.trims_for_process == 'undefined' || cur_frm.doc.trims_for_process == ''){
		frappe.throw('Please select trims.');
	}
	else if(cur_frm.doc.trims_process_route_table.length <= 0){
		frappe.throw("Atleast one record must be added in Trims Process Route.");
	}
	else{
		frappe.call({
			method: "style_master_costing.style_master_costing.doctype.trims_process_route.trims_process_route.saveProcessRoute",
			args: {
				'stylemaster':cur_frm.doc.name,
				'trim_name':cur_frm.doc.trims_for_process,
				'process_route':cur_frm.doc.trims_process_route_table
			},
			callback: function(r) {
				frappe.msgprint("Saved successfully.")
			}
		});
	}
}

function saveProcessRoute(frm){
	if(typeof cur_frm.is_new() !== 'undefined'){
		frappe.throw("Please save the style master first.");
	}
	else if(typeof cur_frm.doc.fabric_for_process ==  'undefined' || cur_frm.doc.fabric_for_process == 'undefined' || cur_frm.doc.fabric_for_process == ''){
		frappe.throw('Please select fabric.');
	}
	else if(cur_frm.doc.process_route_table.length <= 0){
		frappe.throw("Atleast one record must be added in Process Route.");
	}
	else{
		frappe.call({
			method: "style_master_costing.style_master_costing.doctype.fabric_process_route.fabric_process_route.saveProcessRoute",
			args: {
				'stylemaster':cur_frm.doc.name,
				'fabric_name':cur_frm.doc.fabric_for_process,
				'process_route':cur_frm.doc.process_route_table
			},
			callback: function(r) {
				// if(r.message){
				frappe.msgprint("Saved successfully.")
				// }
			}
		});
	}
}

function hideTechpackEdit(frm){
	if(frm.fields_dict['techpack_table'].grid.grid_rows.length > 1){
		for(let i = 0; i < (cur_frm.fields_dict['techpack_table'].grid.grid_rows.length -1); i++){
			cur_frm.fields_dict['techpack_table'].grid.grid_rows[i].open_form_button.hide();
		}
	}
}


function add_row_lab_template(rowData,dataType){
	// console.log(rowData);
	if(typeof rowData !== 'undefined' && rowData !== ''){
		let row = cur_frm.add_child('template_table', {
			code:(dataType == 'Fabric' ? rowData['fabric_name'] : rowData['trim_name']),
			item_type:dataType
			// lab_testing_template:eh.department
		})
		cur_frm.refresh_field('template_table');
	}
}